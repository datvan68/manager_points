import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { SystemRequest, SystemRequestDocument } from './schemas/system-request.schema';
import { DatabaseBackupJob, DatabaseBackupJobDocument } from './schemas/database-backup-job.schema';
import { DatabaseRestoreJob, DatabaseRestoreJobDocument } from './schemas/database-restore-job.schema';
import { LoginLog, LoginLogDocument } from '../auth/schemas/login-log.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { SystemPerformanceMetric, SystemPerformanceMetricDocument } from './schemas/system-performance-metric.schema';
import { SystemSetting, SystemSettingDocument } from './schemas/system-setting.schema';
import { GetLoginLogsQueryDto, GetLoginLogsSummaryQueryDto, CreateSystemRequestDto, UpdateSystemRequestDto, UpdateSystemRequestStatusDto, GetSystemRequestsQueryDto, GetBackupsQueryDto, CreateSystemPerformanceMetricDto, GetPerformanceSummaryQueryDto, GetPerformanceMetricsQueryDto, RestoreBackupImportDto, UpdateMailSettingsDto, UpdateModuleMaintenanceDto } from './dto/system.dto';
import { getRequesterRoleName, isStudent, isTeacher, isSupervisor, isAdmin, isAdminUser } from '../auth/utils/role.util';
import { MailService, MailConfigOptions } from '../core/mail/mail.service';
import { RestoreTypeRegistry } from './restore-type-registry';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { EJSON } from 'bson';
import { StringDecoder } from 'string_decoder';

const execFileAsync = promisify(execFile);
const MODULE_MAINTENANCE_SETTING_KEY = 'SYSTEM_MODULE_MAINTENANCE';

class DatabaseBackupStream extends Readable {
  private collectionNames: string[];
  private currentCollectionIndex = 0;
  private cursor: any = null;
  private db: any;

  constructor(collectionNames: string[], db: any) {
    super({ encoding: 'utf-8' });
    this.collectionNames = collectionNames;
    this.db = db;
  }

  async _read() {
    try {
      if (this.currentCollectionIndex >= this.collectionNames.length) {
        this.push(null); // EOF
        return;
      }

      const currentCollName = this.collectionNames[this.currentCollectionIndex];

      if (!this.cursor) {
        // Send collection header
        this.push(EJSON.stringify({ __collection: currentCollName }) + '\n');
        if (!this.db) {
          throw new Error('Kết nối cơ sở dữ liệu chưa sẵn sàng');
        }
        const dbCollection = this.db.collection(currentCollName);
        this.cursor = dbCollection.find({});
        return;
      }

      if (await this.cursor.hasNext()) {
        const doc = await this.cursor.next();
        this.push(EJSON.stringify(doc) + '\n');
      } else {
        // Close cursor and move to next collection
        this.cursor = null;
        this.currentCollectionIndex++;
        // push empty string to trigger next read
        this.push('');
      }
    } catch (err) {
      this.destroy(err);
    }
  }
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly backupDir = path.resolve(process.cwd(), 'storage', 'backups');

  constructor(
    @InjectModel(SystemRequest.name) private systemRequestModel: Model<SystemRequestDocument>,
    @InjectModel(DatabaseBackupJob.name) private backupJobModel: Model<DatabaseBackupJobDocument>,
    @InjectModel(DatabaseRestoreJob.name) private restoreJobModel: Model<DatabaseRestoreJobDocument>,
    @InjectModel(LoginLog.name) private loginLogModel: Model<LoginLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SystemPerformanceMetric.name) private performanceMetricModel: Model<SystemPerformanceMetricDocument>,
    @InjectModel(SystemSetting.name) private systemSettingModel: Model<SystemSettingDocument>,
    private mailService: MailService,
    private configService: ConfigService,
    @InjectConnection() private connection: Connection,
    private restoreTypeRegistry: RestoreTypeRegistry,
  ) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    this.importDir = path.resolve(process.cwd(), 'storage', 'backup-imports');
    if (!fs.existsSync(this.importDir)) {
      fs.mkdirSync(this.importDir, { recursive: true });
    }
  }

  private readonly importDir: string;

  private toObjectId(id: string): Types.ObjectId {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }
    return new Types.ObjectId(id);
  }

  private maskUri(message: string): string {
    const mongoUri = this.configService.get<string>('MONGO_URI');
    if (mongoUri && message.includes(mongoUri)) {
      return message.replace(new RegExp(this.escapeRegExp(mongoUri), 'g'), '***MONGO_URI_REDACTED***');
    }
    return message.replace(/mongodb(\+srv)?:\/\/[^/]+/g, 'mongodb$1://***REDACTED***');
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ─── LOGIN LOGS ─────────────────────────────────────────────────────────────

  async getLoginLogs(query: GetLoginLogsQueryDto) {
    const { page = 1, limit = 20, action, userId, ip, from, to, search } = query;
    const filter: any = {};

    if (action) filter.action = action;
    
    // Safely parse userId
    if (userId && Types.ObjectId.isValid(userId)) {
      filter.user_id = new Types.ObjectId(userId);
    }
    
    if (ip) filter.ip_address = { $regex: ip, $options: 'i' };
    
    if (from || to) {
      filter.login_time = {};
      if (from) filter.login_time.$gte = new Date(from);
      if (to) filter.login_time.$lte = new Date(to);
    }

    if (search) {
      const users = await this.userModel.find({
        $or: [
          { user_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').exec();
      const userIds = users.map(u => u._id);

      filter.$or = [
        { ip_address: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } }
      ];

      if (userIds.length > 0) {
        filter.$or.push({ user_id: { $in: userIds } });
      }
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.loginLogModel.find(filter)
        .populate({
          path: 'user_id',
          select: 'user_name email role',
          populate: { path: 'role', select: 'name role_code' }
        })
        .sort({ login_time: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.loginLogModel.countDocuments(filter).exec()
    ]);

    const totalPages = Math.ceil(total / limit);
    return { items, total, page, limit, totalPages };
  }

  async getLoginLogsSummary(query?: GetLoginLogsSummaryQueryDto) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const selectedFrom = query?.from ? new Date(query.from) : todayStart;
    const selectedTo = query?.to ? new Date(query.to) : undefined;

    const selectedMatch: any = { login_time: { $gte: selectedFrom } };
    if (selectedTo) selectedMatch.login_time.$lte = selectedTo;

    const sevenDaysStart = new Date();
    sevenDaysStart.setDate(sevenDaysStart.getDate() - 7);
    sevenDaysStart.setHours(0, 0, 0, 0);

    const [todayStats, sevenDaysStats] = await Promise.all([
      this.loginLogModel.aggregate([
        { $match: selectedMatch },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      this.loginLogModel.aggregate([
        { $match: { login_time: { $gte: sevenDaysStart } } },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ])
    ]);

    const formatStats = (stats: any[]) => {
      const result = {
        login_success: 0,
        login_failure: 0,
        logout: 0,
        password_reset: 0,
        password_change: 0,
        admin_reset_password: 0,
        total: 0
      };
      for (const item of stats) {
        if (item._id in result) {
          result[item._id as keyof typeof result] = item.count;
        }
        result.total += item.count;
      }
      return result;
    };

    return {
      today: formatStats(todayStats),
      sevenDays: formatStats(sevenDaysStats)
    };
  }

  // ─── SYSTEM REQUESTS ─────────────────────────────────────────────────────────

  async getRequests(query: GetSystemRequestsQueryDto) {
    const { page = 1, limit = 20, status, type, priority, requesterId, assigneeId, search, from, to } = query;
    const filter: any = { deletedAt: null };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    
    if (requesterId && Types.ObjectId.isValid(requesterId)) {
      filter.requester_id = new Types.ObjectId(requesterId);
    }
    
    if (assigneeId && Types.ObjectId.isValid(assigneeId)) {
      filter.assignee_id = new Types.ObjectId(assigneeId);
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      const users = await this.userModel.find({
        $or: [
          { user_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').exec();
      const userIds = users.map(u => u._id);

      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];

      if (userIds.length > 0) {
        filter.$or.push({ requester_id: { $in: userIds } });
      }
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.systemRequestModel.find(filter)
        .populate('requester_id', 'user_name email')
        .populate('assignee_id', 'user_name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.systemRequestModel.countDocuments(filter).exec()
    ]);

    const totalPages = Math.ceil(total / limit);
    return { items, total, page, limit, totalPages };
  }

  async getRequestById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID yêu cầu không hợp lệ');
    }
    const request = await this.systemRequestModel.findOne({ _id: id, deletedAt: null })
      .populate('requester_id', 'user_name email')
      .populate('assignee_id', 'user_name email')
      .exec();
    if (!request) {
      throw new NotFoundException('Yêu cầu không tồn tại');
    }
    return request;
  }

  async createRequest(dto: CreateSystemRequestDto, userId: string) {
    const requester_id = this.toObjectId(userId);
    const newRequest = await this.systemRequestModel.create({
      ...dto,
      requester_id,
      created_by: requester_id,
      updated_by: requester_id,
    });
    return newRequest;
  }

  async updateRequest(id: string, dto: UpdateSystemRequestDto, userId: string) {
    const request = await this.getRequestById(id);
    const updateData: any = {
      ...dto,
      updated_by: this.toObjectId(userId),
    };
    if (dto.assignee_id) {
      if (!Types.ObjectId.isValid(dto.assignee_id)) {
        throw new BadRequestException('ID người phân công không hợp lệ');
      }
      updateData.assignee_id = new Types.ObjectId(dto.assignee_id);
    }
    Object.assign(request, updateData);
    await request.save();
    return request;
  }

  async updateRequestStatus(id: string, dto: UpdateSystemRequestStatusDto, userId: string, userRole: string) {
    const request = await this.getRequestById(id);
    const currentStatus = request.status;
    const nextStatus = dto.status;

    // 1. Terminal state rules
    const terminalStates = ['completed', 'rejected', 'cancelled'];
    if (terminalStates.includes(currentStatus) && userRole !== 'Admin') {
      throw new BadRequestException('Chỉ có Quản trị viên mới được mở lại yêu cầu đã kết thúc.');
    }

    // 2. Allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      pending: ['in_progress', 'approved', 'rejected', 'cancelled'],
      in_progress: ['approved', 'rejected', 'completed', 'cancelled'],
      approved: ['completed', 'cancelled'],
      completed: ['pending', 'in_progress'],
      rejected: ['pending', 'in_progress'],
      cancelled: ['pending', 'in_progress'],
    };

    const isAllowed = allowedTransitions[currentStatus]?.includes(nextStatus);
    if (!isAllowed && currentStatus !== nextStatus) {
      throw new BadRequestException(`Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`);
    }

    // Apply updates
    request.status = nextStatus;
    request.decision_note = dto.decision_note;
    request.updated_by = this.toObjectId(userId);

    // Save history using status_history field
    request.status_history.push({
      from_status: currentStatus,
      to_status: nextStatus,
      note: dto.decision_note,
      changed_by: this.toObjectId(userId),
      changed_at: new Date(),
    });

    await request.save();
    this.logger.log(`AUDIT: User ${userId} updated status of request ${id} from ${currentStatus} to ${nextStatus}. Note: ${dto.decision_note}`);
    return request;
  }

  async deleteRequest(id: string, userId: string) {
    const request = await this.getRequestById(id);
    request.deletedAt = new Date();
    request.updated_by = this.toObjectId(userId);
    await request.save();
    this.logger.log(`AUDIT: User ${userId} soft-deleted system request ${id}`);
    return { message: 'Xóa yêu cầu thành công' };
  }

  // ─── DATABASE BACKUPS ────────────────────────────────────────────────────────

  async getSystemActivity() {
    const now = new Date();
    const staleQueuedThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes
    const staleRunningThreshold = new Date(now.getTime() - 60 * 60 * 1000); // 60 minutes

    // Find all queued/running jobs
    const activeBackups = await this.backupJobModel.find({ status: { $in: ['queued', 'running'] } }).exec();
    const activeRestores = await this.restoreJobModel.find({ status: { $in: ['queued', 'running'] } }).exec();

    let hasActiveBackup = false;
    let hasActiveRestore = false;
    let staleJobsFound = false;
    let activeJobInfo: any = null;

    const checkJob = (job: any, type: string) => {
      const isStaleQueued = job.status === 'queued' && job.createdAt < staleQueuedThreshold;
      const isStaleRunning = job.status === 'running' && job.createdAt < staleRunningThreshold;
      const isStale = isStaleQueued || isStaleRunning;

      if (isStale) {
        staleJobsFound = true;
      } else {
        if (type === 'backup') hasActiveBackup = true;
        if (type === 'restore') hasActiveRestore = true;
        if (!activeJobInfo) {
          activeJobInfo = {
            id: job._id,
            type,
            status: job.status,
            createdAt: job.createdAt,
            started_at: job.started_at
          };
        }
      }
    };

    activeBackups.forEach(job => checkJob(job, 'backup'));
    activeRestores.forEach(job => checkJob(job, 'restore'));

    return {
      hasActiveBackup,
      hasActiveRestore,
      activeJob: activeJobInfo,
      hasStaleJobs: staleJobsFound
    };
  }

  async cleanupStaleJobs() {
    const now = new Date();
    const staleQueuedThreshold = new Date(now.getTime() - 5 * 60 * 1000);
    const staleRunningThreshold = new Date(now.getTime() - 60 * 60 * 1000);

    const errorMessage = 'Tiến trình bị gián đoạn và quá thời gian chờ (Stale)';

    // Cleanup Backup Jobs
    const staleBackupQuery = {
      $or: [
        { status: 'queued', createdAt: { $lt: staleQueuedThreshold } },
        { status: 'running', createdAt: { $lt: staleRunningThreshold } }
      ]
    };
    await this.backupJobModel.updateMany(staleBackupQuery, {
      $set: { status: 'failed', error_message: errorMessage, finished_at: now }
    });

    // Cleanup Restore Jobs
    const staleRestoreQuery = {
      $or: [
        { status: 'queued', createdAt: { $lt: staleQueuedThreshold } },
        { status: 'running', createdAt: { $lt: staleRunningThreshold } }
      ]
    };
    await this.restoreJobModel.updateMany(staleRestoreQuery, {
      $set: { status: 'failed', error_message: errorMessage, finished_at: now }
    });

    this.logger.log('AUDIT: Cleaned up stale backup/restore jobs.');
    return { success: true, message: 'Đã dọn dẹp các tiến trình bị kẹt.' };
  }

  async markJobFailed(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }
    
    const backupJob = await this.backupJobModel.findById(id).exec();
    if (backupJob && ['queued', 'running'].includes(backupJob.status)) {
      backupJob.status = 'failed';
      backupJob.error_message = 'Bị hủy bằng tay do kẹt (Force Cancel)';
      backupJob.finished_at = new Date();
      await backupJob.save();
      return { success: true, message: 'Đã hủy tiến trình sao lưu.' };
    }

    const restoreJob = await this.restoreJobModel.findById(id).exec();
    if (restoreJob && ['queued', 'running'].includes(restoreJob.status)) {
      restoreJob.status = 'failed';
      restoreJob.error_message = 'Bị hủy bằng tay do kẹt (Force Cancel)';
      restoreJob.finished_at = new Date();
      await restoreJob.save();
      return { success: true, message: 'Đã hủy tiến trình khôi phục.' };
    }

    throw new NotFoundException('Không tìm thấy tiến trình đang chạy với ID này.');
  }

  async getBackups(query: GetBackupsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.backupJobModel.find()
        .select('-file_path') // Do not expose absolute paths to client
        .populate('requested_by', 'user_name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.backupJobModel.countDocuments().exec()
    ]);

    const totalPages = Math.ceil(total / limit);
    return { items, total, page, limit, totalPages };
  }

  async getBackupById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID sao lưu không hợp lệ');
    }
    const job = await this.backupJobModel.findById(id)
      .select('-file_path')
      .populate('requested_by', 'user_name email')
      .exec();
    if (!job) {
      throw new NotFoundException('Yêu cầu sao lưu không tồn tại');
    }
    return job;
  }

  async createBackup(userId: string, format?: 'auto' | 'archive' | 'ndjson') {
    const activity = await this.getSystemActivity();

    if (activity.hasActiveBackup || activity.hasActiveRestore) {
      throw new ConflictException({
        message: 'Hiện tại đang có tiến trình sao lưu hoặc khôi phục khác đang chạy.',
        activeJob: activity.activeJob
      });
    }

    const job = await this.backupJobModel.create({
      status: 'queued',
      requested_by: this.toObjectId(userId),
    });

    this.logger.log(`AUDIT: User ${userId} requested backup creation. Job ID: ${job._id}, format: ${format || 'auto'}`);

    // Run async backup
    this.runBackupAsync(job._id.toString(), format || 'auto').catch((err) => {
      this.logger.error(`Error running backup job ${job._id}:`, err);
    });

    return job;
  }

  private async runBackupAsync(jobId: string, format: 'auto' | 'archive' | 'ndjson' = 'auto') {
    const job = await this.backupJobModel.findById(jobId).exec();
    if (!job) return;

    job.status = 'running';
    job.started_at = new Date();
    await job.save();

    const timestamp = Date.now();
    const fileName = `backup_${timestamp}.gz`;
    const filePath = path.resolve(this.backupDir, fileName);

    const mongoUri = this.configService.get<string>('MONGO_URI');

    try {
      if (!mongoUri) {
        throw new Error('Cấu hình MONGO_URI bị thiếu');
      }

      if (!this.connection.db) {
        throw new Error('Kết nối cơ sở dữ liệu chưa sẵn sàng');
      }

      const collectionsObj = await this.connection.db.listCollections().toArray();
      const collections = collectionsObj.map(c => c.name).filter(name => !name.startsWith('system.'));

      if (collections.length === 0) {
        throw new Error('Không tìm thấy bất kỳ collection nào để sao lưu.');
      }

      if (format === 'ndjson') {
        // User explicitly requested NDJSON format — skip mongodump entirely
        this.logger.log(`Using NDJSON format as requested for backup job ${jobId}`);
        await this.runMongooseBackupFallback(filePath, collections);
        this.logger.log(`NDJSON streaming backup completed for job ${jobId}`);
        job.backup_format = 'ndjson_gzip';
      } else if (format === 'archive') {
        // User explicitly requested Archive format — fail if mongodump not available
        this.logger.log(`Starting mongodump (archive mode) for backup job ${jobId}`);
        await execFileAsync('mongodump', [`--uri=${mongoUri}`, `--archive=${filePath}`, '--gzip']);
        this.logger.log(`mongodump completed successfully for job ${jobId}`);
        job.backup_format = 'mongodump_archive';
      } else {
        // Auto mode: try mongodump first, fallback to NDJSON
        this.logger.log(`Starting mongodump execFile for backup job ${jobId}`);
        try {
          await execFileAsync('mongodump', [`--uri=${mongoUri}`, `--archive=${filePath}`, '--gzip']);
          this.logger.log(`mongodump completed successfully for job ${jobId}`);
          job.backup_format = 'mongodump_archive';
        } catch (err) {
          const maskedMsg = this.maskUri(err.message || '');
          this.logger.warn(`mongodump failed, trying fallback mongoose stream: ${maskedMsg}`);
          // Fallback to Mongoose custom NDJSON stream
          await this.runMongooseBackupFallback(filePath, collections);
          this.logger.log(`Fallback mongoose streaming backup completed for job ${jobId}`);
          job.backup_format = 'ndjson_gzip';
        }
      }

      const stat = fs.statSync(filePath);

      job.status = 'success';
      job.finished_at = new Date();
      job.file_name = fileName;
      job.file_path = filePath;
      job.file_size = stat.size;
      job.collections = collections;
      await job.save();

      this.logger.log(`AUDIT: Backup job ${jobId} finished successfully. Size: ${stat.size} bytes`);
    } catch (err) {
      const maskedError = this.maskUri(err.message || 'Lỗi không xác định xảy ra trong lúc sao lưu');
      this.logger.error(`AUDIT: Backup job ${jobId} failed: ${maskedError}`);

      job.status = 'failed';
      job.finished_at = new Date();
      job.error_message = maskedError;
      await job.save();

      // Clean up file if created partially
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }
  }

  private async runMongooseBackupFallback(filePath: string, collections: string[]) {
    const backupStream = new DatabaseBackupStream(collections, this.connection.db);
    const gzipStream = zlib.createGzip();
    const fileWriteStream = fs.createWriteStream(filePath);

    await pipeline(backupStream, gzipStream, fileWriteStream);
  }

  async downloadBackup(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID sao lưu không hợp lệ');
    }
    const job = await this.backupJobModel.findById(id).exec();
    if (!job) {
      throw new NotFoundException('Yêu cầu sao lưu không tồn tại');
    }
    
    if (job.status !== 'success') {
      throw new BadRequestException('Không thể tải bản sao lưu chưa hoàn thành hoặc bị lỗi.');
    }

    if (!job.file_path || !fs.existsSync(job.file_path)) {
      throw new NotFoundException('Tệp sao lưu không tồn tại trên máy chủ.');
    }

    // Path traversal check
    const absoluteFilePath = path.resolve(job.file_path);
    const absoluteBackupDir = path.resolve(this.backupDir);
    const safePrefix = absoluteBackupDir.endsWith(path.sep) ? absoluteBackupDir : absoluteBackupDir + path.sep;
    const relative = path.relative(safePrefix, absoluteFilePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isSafe) {
      throw new ForbiddenException('Truy cập tệp tin ngoài thư mục sao lưu bị từ chối');
    }

    this.logger.log(`AUDIT: User ${userId} downloaded backup ${id}. File path: ${job.file_path}`);

    return {
      filePath: job.file_path,
      fileName: job.file_name,
    };
  }

  async deleteBackup(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID sao lưu không hợp lệ');
    }
    const job = await this.backupJobModel.findById(id).exec();
    if (!job) {
      const rawDoc = await this.connection.collection('database_backup_jobs').findOne({ _id: id as any });
      if (rawDoc) {
        throw new ConflictException('Dữ liệu backup job sai BSON type, cần chạy công cụ sửa lỗi trước khi xóa');
      }
      throw new NotFoundException('Yêu cầu sao lưu không tồn tại');
    }
    
    if (job.status === 'queued' || job.status === 'running') {
      throw new ConflictException('Không thể xóa backup đang chạy. Vui lòng đợi hoàn tất hoặc dùng thao tác hủy nếu được hỗ trợ.');
    }
    
    let fileExists = false;
    let fileDeleted = false;

    // Path traversal check
    if (job.file_path) {
      const absoluteFilePath = path.resolve(job.file_path);
      const absoluteBackupDir = path.resolve(this.backupDir);
      const safePrefix = absoluteBackupDir.endsWith(path.sep) ? absoluteBackupDir : absoluteBackupDir + path.sep;
      const relative = path.relative(safePrefix, absoluteFilePath);
      const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
      if (!isSafe) {
        throw new ForbiddenException('Truy cập tệp tin ngoài thư mục sao lưu bị từ chối');
      }

      fileExists = fs.existsSync(job.file_path);
      if (fileExists) {
        try {
          fs.unlinkSync(job.file_path);
          fileDeleted = true;
        } catch (err) {
          this.logger.error(`Failed to delete backup file: ${job.file_path}`, err);
        }
      }
    }

    await this.backupJobModel.deleteOne({ _id: id }).exec();
    this.logger.log(`AUDIT: User ${userId} deleted backup ${id}. File path: ${job.file_path}. File exists: ${fileExists}. File deleted: ${fileDeleted}`);
    return { message: 'Xóa bản sao lưu thành công' };
  }

  async getRestoreJobs(query: GetBackupsQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.restoreJobModel.find()
        .populate('requested_by', 'user_name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.restoreJobModel.countDocuments().exec()
    ]);

    const totalPages = Math.ceil(total / limit);
    return { items, total, page, limit, totalPages };
  }

  public normalizeMongoTypes(collectionName: string, doc: Record<string, any>): Record<string, any> {
    return this.restoreTypeRegistry.normalizeDocument(collectionName, doc);
  }

  /**
   * Processes the uploaded backup file, saves it temporarily, and analyzes its content.
   * Supports both mongodump archives and custom NDJSON gzip formats.
   * Creates a DatabaseRestoreJob in 'queued' state.
   */
  async previewBackupImport(file: any, userId: string) {
    if (!file.originalname.match(/\.(gz|archive|zip)$/)) {
      throw new BadRequestException('Định dạng file không được hỗ trợ: Chỉ chấp nhận file .gz, .archive, .zip');
    }

    const previewSessionId = crypto.randomBytes(16).toString('hex');
    const sanitizedFileName = path.basename(file.originalname);
    const tempFileName = `import_${previewSessionId}_${sanitizedFileName}`;
    const filePath = path.resolve(this.importDir, tempFileName);

    const safePrefix = this.importDir.endsWith(path.sep) ? this.importDir : this.importDir + path.sep;
    const relative = path.relative(safePrefix, filePath);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isSafe) {
      throw new BadRequestException('Tên file không hợp lệ');
    }

    fs.writeFileSync(filePath, file.buffer);

    // Calculate hash
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Parse logic
    const collectionMap = new Map<string, number>();
    let detectedFormat: 'mongodump_archive' | 'ndjson_gzip' | 'unknown' = 'unknown';
    const encodingErrors = new Set<string>();

    try {
      try {
        const sampleBuffer = await new Promise<Buffer>((resolve, reject) => {
          const stream = fs.createReadStream(filePath).pipe(zlib.createGunzip());
          stream.once('data', (chunk) => {
             stream.destroy();
             resolve(chunk as Buffer);
          });
          stream.once('error', (err) => {
             reject(err);
          });
          stream.once('end', () => {
             resolve(Buffer.alloc(0));
          });
        });

        const sampleText = sampleBuffer.toString('utf8', 0, Math.min(sampleBuffer.length, 500));
        if (sampleText.trimStart().startsWith('{')) {
           detectedFormat = 'ndjson_gzip';
        } else {
           detectedFormat = 'mongodump_archive';
        }
      } catch (e: any) {
        throw new BadRequestException('File không đúng định dạng gzip hoặc bị lỗi giải nén: ' + e.message);
      }

      if (detectedFormat === 'mongodump_archive') {
        try {
          await execFileAsync('mongorestore', [`--archive=${filePath}`, '--gzip', '--dryRun']);
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            throw new BadRequestException('Lỗi thiếu công cụ hệ thống: Phát hiện định dạng Archive backup, nhưng MongoDB Database Tools chưa được cài đặt. Để khôi phục, vui lòng cài đặt mongorestore hoặc sử dụng server có sẵn bộ công cụ này. Nếu không thể cài đặt, hãy sử dụng tính năng sao lưu với định dạng fallback (NDJSON) thay vì Archive.');
          }
          throw new Error('Lỗi xác thực file archive bằng mongorestore. File có thể bị hỏng hoặc không đúng định dạng mongodump.');
        }
      }

      if (detectedFormat === 'ndjson_gzip') {
        const gzip = fs.createReadStream(filePath).pipe(zlib.createGunzip());
        const decoder = new StringDecoder('utf8');
        let currentCollection = 'unknown';
        let lineBuffer = '';
        let lineCount = 0;
        let hasTypeMismatch = false;

        for await (const chunk of gzip) {
          lineBuffer += decoder.write(chunk as Buffer);
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            lineCount++;
            try {
              if (line.includes('\uFFFD')) {
                encodingErrors.add(currentCollection);
              }
              const doc = EJSON.parse(line);
              if (doc.__collection) {
                currentCollection = doc.__collection;
                if (!collectionMap.has(currentCollection)) {
                  collectionMap.set(currentCollection, 0);
                }
              } else if (currentCollection !== 'unknown') {
                collectionMap.set(currentCollection, (collectionMap.get(currentCollection) || 0) + 1);
                
                // Validate all documents
                try {
                  const normalizedDoc = this.normalizeMongoTypes(currentCollection, doc);
                  // Strict check: if collection requires ObjectId _id but it's still string after normalization
                  if (normalizedDoc._id && typeof normalizedDoc._id === 'string' && this.restoreTypeRegistry.hasRule(currentCollection)) {
                    hasTypeMismatch = true;
                  }
                } catch (typeErr: any) {
                  throw new Error(`Type validation error: ${typeErr.message}`);
                }
              }
            } catch (e: any) {
               throw new Error(`Lỗi parse JSON tại dòng ${lineCount} (collection: ${currentCollection}): ${e.message}`);
            }
          }
        }
        
        lineBuffer += decoder.end();
        
        if (lineBuffer.trim()) {
           if (lineBuffer.includes('\uFFFD')) {
             encodingErrors.add(currentCollection);
           }
           try {
              const doc = EJSON.parse(lineBuffer);
              if (doc.__collection) {
                 collectionMap.set(doc.__collection, 0);
              } else if (currentCollection !== 'unknown') {
                 collectionMap.set(currentCollection, (collectionMap.get(currentCollection) || 0) + 1);
              }
           } catch(e: any) {
              throw new Error(`Lỗi parse JSON tại dòng cuối cùng (collection: ${currentCollection}): ${e.message}`);
           }
        }

        if (hasTypeMismatch) {
           throw new BadRequestException('File import có field sai BSON type (VD: _id không phải ObjectId hợp lệ), không thể khôi phục an toàn. Vui lòng kiểm tra lại file import.');
        }

      } else {
        collectionMap.set('Archive Content (Full Restore Available)', 1);
      }

      if (collectionMap.size === 0) {
        throw new Error('Không tìm thấy dữ liệu hợp lệ trong file');
      }

      const summaries = [];
      const operationalCollections = ['database_backup_jobs', 'database_restore_jobs', 'refresh_tokens', 'login_logs'];
      for (const [name, countInBackup] of collectionMap.entries()) {
        let countInDb = 0;
        try {
          if (!name.startsWith('Archive')) {
            const dbCollection = this.connection.collection(name);
            countInDb = await dbCollection.countDocuments();
          }
        } catch (e) { }

        let status = countInDb > 0 ? 'warning' : 'valid';
        if (operationalCollections.includes(name)) {
          status = 'operational';
        } else if (encodingErrors.has(name)) {
          status = 'encoding_error';
        }

        summaries.push({
          name,
          document_count_in_backup: countInBackup,
          document_count_in_db: countInDb,
          status: status
        });
      }

      const restoreJob = await this.restoreJobModel.create({
        status: 'preview',
        requested_by: this.toObjectId(userId),
        source_file_name: file.originalname,
        source_file_size: file.size,
        source_file_hash: hash,
        preview_session_id: previewSessionId,
        format: detectedFormat,
        collection_summaries: summaries
      });

      return {
        previewSessionId,
        fileName: file.originalname,
        fileSize: file.size,
        format: detectedFormat,
        hash,
        collections: summaries
      };
    } catch (err: any) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      const maskedMessage = this.maskUri(err.message);
      
      if (err instanceof BadRequestException) {
        throw err;
      }
      
      if (maskedMessage.startsWith('Nội dung file không hợp lệ:') || 
          maskedMessage.startsWith('Định dạng file không được hỗ trợ:') ||
          maskedMessage.startsWith('Công cụ xác thực ngoại vi không khả dụng:')) {
        throw new BadRequestException(maskedMessage);
      }
      

      if (maskedMessage.includes('Lỗi xác thực file archive') || 
          maskedMessage.includes('Lỗi parse JSON') || 
          maskedMessage.includes('không hợp lệ') || 
          maskedMessage.includes('không đúng định dạng gzip') ||
          maskedMessage.includes('Không tìm thấy dữ liệu hợp lệ trong file') ||
          maskedMessage.includes('sai BSON type')) {
        throw new BadRequestException(`Nội dung file không hợp lệ: ${maskedMessage}`);
      }
      
      throw new BadRequestException(`Lỗi hệ thống không xác định: ${maskedMessage}`);
    }
  }

  /**
   * Starts the background restoration process from a previewed backup file.
   * Validates state, locks other backup/restore jobs, and queues a pre-restore backup
   * before actually restoring the data.
   */
  async restoreBackupImport(dto: RestoreBackupImportDto, userId: string) {
    if (dto.confirmationText !== 'RESTORE') {
      throw new BadRequestException('Vui lòng gõ chữ RESTORE để xác nhận');
    }

    const job = await this.restoreJobModel.findOne({ preview_session_id: dto.previewSessionId }).exec();
    if (!job) {
      throw new NotFoundException('Phiên import không tồn tại hoặc đã hết hạn');
    }

    if (job.status !== 'preview') {
      throw new ConflictException('Phiên xem trước không hợp lệ hoặc tiến trình khôi phục đã được chạy');
    }

    const activity = await this.getSystemActivity();
    if (activity.hasActiveBackup || activity.hasActiveRestore) {
      throw new ConflictException({
        message: 'Hiện tại đang có tiến trình backup/restore khác đang chạy.',
        activeJob: activity.activeJob
      });
    }

    job.collections = dto.collections;
    job.mode = dto.mode;
    job.status = 'running';
    job.started_at = new Date();
    job.requested_by = this.toObjectId(userId);
    await job.save();

    this.logger.log(`AUDIT: User ${userId} started restore job ${job._id}`);

    // Auto backup pre-restore
    const preBackupJob = await this.backupJobModel.create({
      status: 'queued',
      requested_by: this.toObjectId(userId),
    });
    job.pre_restore_backup_job_id = preBackupJob._id as Types.ObjectId;
    await job.save();

    // Run actual backup and then restore
    this.runBackupAndRestoreAsync(job._id.toString(), preBackupJob._id.toString()).catch((err) => {
      this.logger.error(`Error running restore job ${job._id}:`, err);
    });

    const requiresRelogin = job.collections && job.collections.some(c => ['users', 'roles', 'permissions', 'refresh_tokens'].includes(c));

    // @ts-ignore
    return {
      ...job.toObject(),
      requiresRelogin
    };
  }

  async cancelBackupPreview(previewSessionId: string) {
    const job = await this.restoreJobModel.findOne({ preview_session_id: previewSessionId }).exec();
    if (!job) {
      throw new NotFoundException('Phiên import không tồn tại');
    }

    if (job.status === 'preview') {
      job.status = 'cancelled';
      await job.save();

      // Attempt to delete temp file
      const tempFileName = `import_${previewSessionId}_${job.source_file_name}`;
      const filePath = path.resolve(this.importDir, tempFileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          this.logger.error(`Failed to delete temp preview file: ${filePath}`, err);
        }
      }
    }
    return { message: 'Đã hủy phiên xem trước' };
  }

  private async runBackupAndRestoreAsync(restoreJobId: string, preBackupJobId: string) {
    const restoreJob = await this.restoreJobModel.findById(restoreJobId).exec();
    if (!restoreJob) return;

    try {
      // 1. Run backup
      await this.runBackupAsync(preBackupJobId);
      const preBackupJob = await this.backupJobModel.findById(preBackupJobId).exec();
      if (preBackupJob?.status !== 'success') {
        throw new Error('Auto pre-restore backup failed: ' + preBackupJob?.error_message);
      }

      // 2. Run restore
      const sanitizedFileName = path.basename(restoreJob.source_file_name);
      const filePath = path.resolve(this.importDir, `import_${restoreJob.preview_session_id}_${sanitizedFileName}`);
      const safePrefix = this.importDir.endsWith(path.sep) ? this.importDir : this.importDir + path.sep;
      const relative = path.relative(safePrefix, filePath);
      const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
      if (!isSafe) {
        throw new Error('Tên file không hợp lệ');
      }

      if (!fs.existsSync(filePath)) {
        throw new Error('Không tìm thấy file backup để khôi phục');
      }

      const mongoUri = this.configService.get<string>('MONGO_URI');
      if (!mongoUri) {
        throw new Error('Cấu hình MONGO_URI bị thiếu, không thể khôi phục dữ liệu');
      }
      
      let isArchive = restoreJob.format === 'mongodump_archive';
      if (!restoreJob.format) {
        try {
          await execFileAsync('mongorestore', [`--archive=${filePath}`, '--gzip', '--dryRun']);
          isArchive = true;
        } catch(e) {}
      }

      if (isArchive) {
        // mongorestore
        const args = [`--uri=${mongoUri}`, `--archive=${filePath}`, '--gzip'];
        
        let dbName = '';
        const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
        if (match && match[1]) {
          dbName = match[1];
        }

        if (restoreJob.mode === 'replace_selected_collections') {
          args.push('--drop');
        }
        if (restoreJob.collections && restoreJob.collections.length > 0) {
          if (dbName) {
            args.push('--nsFrom=*.*');
            args.push(`--nsTo=${dbName}.*`);
          }
          for (const col of restoreJob.collections) {
            args.push(`--nsInclude=*.${col}`);
          }
        }
        try {
          await execFileAsync('mongorestore', args);
        } catch (execErr: any) {
          if (execErr.code === 'ENOENT') {
            throw new Error('Lỗi thiếu công cụ hệ thống: Không tìm thấy công cụ mongorestore trên hệ thống để thực hiện khôi phục. Vui lòng cài đặt MongoDB Database Tools.');
          }
          throw execErr;
        }
      } else {
        // ndjson fallback
        const gzip = fs.createReadStream(filePath).pipe(zlib.createGunzip());
        const decoder = new StringDecoder('utf8');
        let currentCollection = 'unknown';
        let lineBufferStr = '';
        let lineCount = 0;

        let buffer = [];
        for await (const chunk of gzip) {
          lineBufferStr += decoder.write(chunk as Buffer);
          const lines = lineBufferStr.split('\n');
          lineBufferStr = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            lineCount++;
            try {
              const doc = EJSON.parse(line);
              if (doc.__collection) {
                if (doc.__collection !== currentCollection) {
                  if (currentCollection !== 'unknown' && buffer.length > 0) {
                    await this.insertDocsSafe(currentCollection, buffer, restoreJob.mode);
                  }
                  buffer = [];
                  currentCollection = doc.__collection;
                }
                
                if (restoreJob.collections.includes(currentCollection) && restoreJob.mode === 'replace_selected_collections') {
                  try {
                    await this.connection.db?.dropCollection(currentCollection);
                  } catch(e) {}
                }
              } else if (currentCollection !== 'unknown' && restoreJob.collections.includes(currentCollection)) {
                const normalizedDoc = this.normalizeMongoTypes(currentCollection, doc);
                buffer.push(normalizedDoc);
                if (buffer.length >= 500) {
                  await this.insertDocsSafe(currentCollection, buffer, restoreJob.mode);
                  buffer = [];
                }
              }
            } catch (e: any) {
              throw new Error(`Lỗi parse JSON tại dòng ${lineCount} (collection: ${currentCollection}): ${e.message}`);
            }
          }
        }

        lineBufferStr += decoder.end();
        if (lineBufferStr.trim()) {
           try {
             const doc = EJSON.parse(lineBufferStr);
             if (!doc.__collection && currentCollection !== 'unknown' && restoreJob.collections.includes(currentCollection)) {
                const normalizedDoc = this.normalizeMongoTypes(currentCollection, doc);
                buffer.push(normalizedDoc);
             }
           } catch(e: any) {
             throw new Error(`Lỗi parse JSON tại dòng cuối cùng (collection: ${currentCollection}): ${e.message}`);
           }
        }

        if (buffer.length > 0) {
          await this.insertDocsSafe(currentCollection, buffer, restoreJob.mode);
        }
      }

      // Clear refresh tokens if auth-related collections were replaced
      if (restoreJob.mode === 'replace_selected_collections' && 
          restoreJob.collections.some((c: string) => ['users', 'roles', 'permissions', 'refresh_tokens'].includes(c))) {
        try {
          await this.connection.collection('refresh_tokens').deleteMany({});
          this.logger.log('AUDIT: Cleared all refresh tokens due to auth-related collection restore.');
        } catch(e) {}
      }

      restoreJob.status = 'success';
      restoreJob.finished_at = new Date();
      try {
        await restoreJob.save();
      } catch (e: any) {
        if (e.name === 'DocumentNotFoundError' || e.name === 'VersionError') {
          await this.restoreJobModel.updateOne(
            { _id: restoreJob._id },
            { $set: { status: restoreJob.status, finished_at: restoreJob.finished_at } }
          );
        } else {
          throw e;
        }
      }

      try { fs.unlinkSync(filePath); } catch(e){}

    } catch (err) {
      restoreJob.status = 'failed';
      restoreJob.finished_at = new Date();
      restoreJob.error_message = this.maskUri(err.message);
      try {
        await restoreJob.save();
      } catch (e: any) {
        if (e.name === 'DocumentNotFoundError' || e.name === 'VersionError') {
          await this.restoreJobModel.updateOne(
            { _id: restoreJob._id },
            { $set: { status: restoreJob.status, finished_at: restoreJob.finished_at, error_message: restoreJob.error_message } }
          );
        } else {
          throw e;
        }
      }
    }
  }

  private async insertDocsSafe(collectionName: string, docs: any[], mode: string) {
    if (docs.length === 0) return;
    const dbColl = this.connection.collection(collectionName);
    
    // Strict check for ObjectId collections
    const rule = this.restoreTypeRegistry.getRule(collectionName);
    const requiresObjectId = rule && (rule.objectIds?.includes('_id') || rule.source === 'schema');

    if (collectionName === 'database_backup_jobs' || collectionName === 'database_restore_jobs') {
      for (const doc of docs) {
        if (doc.status === 'queued' || doc.status === 'running') {
          doc.status = 'failed';
          doc.error_message = 'Imported historical job was not active in this environment';
        }
      }
    }
    
    try {
      if (mode === 'merge_upsert') {
        const operations = docs.map(doc => {
          let id = doc._id;
          if (id && id.$oid) id = new Types.ObjectId(id.$oid);
          
          if (requiresObjectId && typeof id === 'string') {
             throw new Error(`Document in collection ${collectionName} has invalid _id (string) but requires ObjectId: ${id}`);
          }
          
          return {
            updateOne: {
              filter: { _id: id },
              update: { $set: doc },
              upsert: true
            }
          };
        });
        await dbColl.bulkWrite(operations);
      } else {
        // Validate _id for strict collections
        if (requiresObjectId) {
           for (const doc of docs) {
              let id = doc._id;
              if (id && id.$oid) id = new Types.ObjectId(id.$oid);
              if (typeof id === 'string') {
                 throw new Error(`Document in collection ${collectionName} has invalid _id (string) but requires ObjectId: ${id}`);
              }
           }
        }
        await dbColl.insertMany(docs);
      }
    } catch(err) {
      this.logger.error(`Error inserting docs into ${collectionName}: ${err.message}`);
      throw new Error(`Error inserting docs into ${collectionName}: ${err.message}`);
    }
  }

  async checkBsonTypes() {
    const issues = [];
    const collectionsToCheck = ['users', 'roles', 'permissions', 'students', 'classes', 'departments', 'academicrecords', 'summarypoints', 'studenttasks', 'database_backup_jobs', 'login_logs'];

    for (const collectionName of collectionsToCheck) {
      try {
        const rule = this.restoreTypeRegistry.getRule(collectionName);
        if (!rule) continue;
        
        const projectStage: any = { _id: 1 };
        const orConditions: any[] = [];
        
        if (rule.objectIds) {
           for (const field of rule.objectIds) {
             projectStage[`${field}Type`] = { $type: `$${field}` };
             orConditions.push({ [`${field}Type`]: { $nin: ["objectId", "missing", "null"] } });
           }
        }
        
        if (rule.dates) {
           for (const field of rule.dates) {
             projectStage[`${field}Type`] = { $type: `$${field}` };
             orConditions.push({ [`${field}Type`]: { $nin: ["date", "missing", "null"] } });
           }
        }
        
        if (orConditions.length === 0) continue;

        const coll = this.connection.collection(collectionName);
        const wrongDocs = await coll.aggregate([
          { $project: projectStage },
          { $match: { $or: orConditions } },
          { $limit: 5 }
        ]).toArray();
        
        if (wrongDocs.length > 0) {
          issues.push({ collection: collectionName, count: wrongDocs.length, sample: wrongDocs });
        }
      } catch (e: any) {
          this.logger.error(`checkBsonTypes error on ${collectionName}: ${e.message}`);
      }
    }
    
    return {
      status: issues.length > 0 ? 'issues_found' : 'ok',
      issues
    };
  }

  async repairBsonTypes(collectionName?: string) {
     const targetCollections = collectionName ? [collectionName] : ['database_backup_jobs', 'database_restore_jobs', 'users', 'roles', 'permissions', 'students', 'classes', 'departments', 'academicrecords', 'summarypoints', 'studenttasks', 'studenttaskprogresses', 'login_logs', 'notifications', 'system_requests'];
     let totalRepaired = 0;
     let totalFailed = 0;
     const results: any = {};

     for (const cName of targetCollections) {
        const rule = this.restoreTypeRegistry.getRule(cName);
        if (!rule && cName !== 'database_backup_jobs') continue;
        
        const coll = this.connection.collection(cName);
        // Documents imported from buggy NDJSON fallback will always have string _id
        const docs = await coll.find({ _id: { $type: "string" } }).toArray();
        let repaired = 0;
        let failed = 0;

        for (const doc of docs) {
           try {
              const oldIdStr = doc._id;
              if (!Types.ObjectId.isValid(oldIdStr)) {
                 failed++;
                 continue;
              }
              
              const normalizedDoc = this.restoreTypeRegistry.normalizeDocument(cName, doc);
              normalizedDoc._id = new Types.ObjectId(oldIdStr);

              if (cName === 'database_backup_jobs' || cName === 'database_restore_jobs') {
                  if (normalizedDoc.file_path && !fs.existsSync(normalizedDoc.file_path)) {
                      normalizedDoc.status = 'failed';
                      normalizedDoc.error_message = 'File sao lưu không tồn tại trên máy chủ (Repair BSON)';
                  } else if (normalizedDoc.status === 'queued' || normalizedDoc.status === 'running') {
                      normalizedDoc.status = 'failed';
                      normalizedDoc.error_message = 'Job chưa hoàn thành từ phiên làm việc trước (Repair BSON)';
                  }
              }

              await coll.insertOne(normalizedDoc);
              await coll.deleteOne({ _id: oldIdStr });
              repaired++;
           } catch(e: any) {
              this.logger.error(`Failed to repair document ${doc._id} in ${cName}: ${e.message}`);
              failed++;
           }
        }
        totalRepaired += repaired;
        totalFailed += failed;
        if (repaired > 0 || failed > 0) {
           results[cName] = { repaired, failed };
        }
     }

     return {
        message: 'Repair BSON process completed',
        total_repaired: totalRepaired,
        total_failed: totalFailed,
        details: results
     };
  }

  async checkMongoDbTools(): Promise<{ mongodump: boolean, mongorestore: boolean }> {
    let mongodump = false;
    let mongorestore = false;
    try {
      await execFileAsync('mongodump', ['--version']);
      mongodump = true;
    } catch (e) {}
    try {
      await execFileAsync('mongorestore', ['--version']);
      mongorestore = true;
    } catch (e) {}
    return { mongodump, mongorestore };
  }

  // ─── PERFORMANCE METRICS ───────────────────────────────────────────────────

  private calculateRecommendations(dto: CreateSystemPerformanceMetricDto) {
    const recommendations: Array<{ severity: 'critical' | 'warning' | 'info'; code: string; message: string }> = [];

    if (dto.load_event_ms && dto.load_event_ms > 3000) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_LOAD_HIGH', message: 'Thời gian tải trang vượt 3s. Cần lazy load các tab nặng trong /system.' });
    }
    if (dto.lcp_ms && dto.lcp_ms > 2500) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_LCP_HIGH', message: 'LCP vượt 2.5s. Kiểm tra skeleton/loading state, bundle size và render blocking.' });
    }
    if (dto.ttfb_ms && dto.ttfb_ms > 800) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_TTFB_HIGH', message: 'TTFB vượt 800ms. Kiểm tra backend query, index MongoDB, cache response summary.' });
    }
    if (dto.api_total_ms && dto.api_total_ms > 2000) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_API_TOTAL_HIGH', message: 'Tổng thời gian gọi API vượt 2s. Xác định API chậm nhất từ api_breakdown.' });
    }
    if (dto.cls && dto.cls > 0.1) {
      recommendations.push({ severity: 'info', code: 'SYSTEM_CLS_HIGH', message: 'CLS vượt 0.1. Cố định chiều cao table/skeleton, tránh layout shift khi data về.' });
    }
    if (dto.inp_ms && dto.inp_ms > 200) {
      recommendations.push({ severity: 'info', code: 'SYSTEM_INP_HIGH', message: 'INP vượt 200ms. Giảm rerender, debounce search/filter, memoize bảng dữ liệu lớn.' });
    }

    if (dto.api_breakdown) {
      for (const api of dto.api_breakdown) {
        if (api.name.includes('login-logs') && api.duration_ms > 1200) {
          recommendations.push({ severity: 'warning', code: 'API_LOGIN_LOGS_SLOW', message: 'API login-logs vượt 1200ms. Xem lại filter, index login_time, action, user_id.' });
        }
        if (api.name.includes('requests') && api.duration_ms > 1200) {
          recommendations.push({ severity: 'warning', code: 'API_REQUESTS_SLOW', message: 'API requests vượt 1200ms. Xem lại index status, type, createdAt, populate user.' });
        }
        if (api.name.includes('backups') && api.duration_ms > 1200) {
          recommendations.push({ severity: 'warning', code: 'API_BACKUPS_SLOW', message: 'API backups vượt 1200ms. Đảm bảo list backup không expose/scan file path nặng.' });
        }
      }
    }

    return recommendations;
  }

  async createPerformanceMetric(dto: CreateSystemPerformanceMetricDto, user: { userId: string; roleName: string }) {
    const recommendations = this.calculateRecommendations(dto);

    // Sanitize and validate data
    const metric = new this.performanceMetricModel({
      route: dto.route,
      user_id: user?.userId ? this.toObjectId(user.userId) : undefined,
      role_name: user?.roleName,
      device_type: dto.device_type,
      network_effective_type: dto.network_effective_type,
      navigation_type: dto.navigation_type,
      ttfb_ms: dto.ttfb_ms ? Math.max(0, dto.ttfb_ms) : undefined,
      dom_content_loaded_ms: dto.dom_content_loaded_ms ? Math.max(0, dto.dom_content_loaded_ms) : undefined,
      load_event_ms: dto.load_event_ms ? Math.max(0, dto.load_event_ms) : undefined,
      fcp_ms: dto.fcp_ms ? Math.max(0, dto.fcp_ms) : undefined,
      lcp_ms: dto.lcp_ms ? Math.max(0, dto.lcp_ms) : undefined,
      cls: dto.cls ? Math.max(0, dto.cls) : undefined,
      inp_ms: dto.inp_ms ? Math.max(0, dto.inp_ms) : undefined,
      api_total_ms: dto.api_total_ms ? Math.max(0, dto.api_total_ms) : undefined,
      api_breakdown: dto.api_breakdown?.map(api => ({
        name: api.name,
        duration_ms: Math.max(0, api.duration_ms),
        status: api.status,
        ok: api.ok,
      })),
      recommendations_snapshot: recommendations.length > 0 ? recommendations : undefined,
    });

    await metric.save();
    return { success: true, message: 'Metric saved' };
  }

  async getPerformanceSummary(query: GetPerformanceSummaryQueryDto) {
    const filter: any = {};
    if (query.route) filter.route = query.route;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }

    const metrics = await this.performanceMetricModel.find(filter).lean().exec();

    const keys = ['ttfb_ms', 'dom_content_loaded_ms', 'load_event_ms', 'fcp_ms', 'lcp_ms', 'cls', 'inp_ms', 'api_total_ms'];

    if (!metrics.length) {
      const emptyKeys: Record<string, null> = keys.reduce((acc, k) => ({...acc, [k]: null}), {});
      return { 
        p50: { ...emptyKeys }, 
        p75: { ...emptyKeys }, 
        p95: { ...emptyKeys }, 
        average: { ...emptyKeys }, 
        total_samples: 0, 
        slow_apis: [], 
        recommendations: [] 
      };
    }

    const sortMetrics = (arr: any[], key: string) => {
      return arr.map(m => m[key]).filter(v => v != null).sort((a, b) => a - b);
    };

    const getPercentile = (sortedArray: number[], percentile: number) => {
      if (sortedArray.length === 0) return null;
      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
      return sortedArray[index];
    };

    const getAvg = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sum = arr.reduce((a, b) => a + b, 0);
      return sum / arr.length;
    };

    const p50: Record<string, number | null> = {};
    const p75: Record<string, number | null> = {};
    const p95: Record<string, number | null> = {};
    const average: Record<string, number | null> = {};

    keys.forEach(key => {
      const sorted = sortMetrics(metrics, key);
      p50[key] = getPercentile(sorted, 50);
      p75[key] = getPercentile(sorted, 75);
      p95[key] = getPercentile(sorted, 95);
      average[key] = getAvg(sorted);
    });

    // Aggregate slow APIs
    const apiMap = new Map<string, number[]>();
    metrics.forEach(m => {
      if (m.api_breakdown) {
        m.api_breakdown.forEach(api => {
          if (!apiMap.has(api.name)) {
            apiMap.set(api.name, []);
          }
          apiMap.get(api.name)!.push(api.duration_ms);
        });
      }
    });

    const slowApis: any[] = [];
    apiMap.forEach((durations, name) => {
      durations.sort((a, b) => a - b);
      const avg = getAvg(durations);
      const apiP75 = getPercentile(durations, 75);
      const apiP95 = getPercentile(durations, 95);
      slowApis.push({ name, avg, p75: apiP75, p95: apiP95, samples: durations.length });
    });

    // Generate summary recommendations based on percentiles
    const recommendations: any[] = [];
    if (p75.load_event_ms && p75.load_event_ms > 3000) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_LOAD_P75_HIGH', message: 'Thời gian tải trang (p75) vượt 3s. Đề xuất lazy load các tab nặng trong /system.' });
    }
    if (p75.lcp_ms && p75.lcp_ms > 2500) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_LCP_P75_HIGH', message: 'LCP (p75) vượt 2.5s. Đề xuất giảm bundle/render-blocking, thêm skeleton ổn định.' });
    }
    if (p75.ttfb_ms && p75.ttfb_ms > 800) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_TTFB_P75_HIGH', message: 'TTFB (p75) vượt 800ms. Đề xuất kiểm tra query backend, index MongoDB, cache summary.' });
    }
    if (p95.api_total_ms && p95.api_total_ms > 2000) {
      recommendations.push({ severity: 'warning', code: 'SYSTEM_API_TOTAL_P95_HIGH', message: 'Tổng thời gian gọi API (p95) vượt 2s. Đề xuất tìm API chậm nhất từ bảng Slow APIs.' });
    }
    if (p75.cls && p75.cls > 0.1) {
      recommendations.push({ severity: 'info', code: 'SYSTEM_CLS_P75_HIGH', message: 'CLS (p75) vượt 0.1. Đề xuất cố định chiều cao table/skeleton.' });
    }
    if (p75.inp_ms && p75.inp_ms > 200) {
      recommendations.push({ severity: 'info', code: 'SYSTEM_INP_P75_HIGH', message: 'INP (p75) vượt 200ms. Đề xuất giảm rerender, debounce filter/search, memoize table lớn.' });
    }

    // Check slow apis
    for (const api of slowApis) {
      if (api.name.includes('login-logs') && api.p95 > 1200) {
        recommendations.push({ severity: 'warning', code: 'API_LOGIN_LOGS_SLOW', message: 'API login-logs (p95) vượt 1200ms. Kiểm tra index login_time, action, user_id.' });
      }
      if (api.name.includes('requests') && api.p95 > 1200) {
        recommendations.push({ severity: 'warning', code: 'API_REQUESTS_SLOW', message: 'API requests (p95) vượt 1200ms. Kiểm tra index status, type, createdAt, populate user.' });
      }
      if (api.name.includes('backups') && api.p95 > 1200) {
        recommendations.push({ severity: 'warning', code: 'API_BACKUPS_SLOW', message: 'API backups (p95) vượt 1200ms. Bảo đảm list backup không scan file system hoặc expose path nặng.' });
      }
    }

    return {
      p50,
      p75,
      p95,
      average,
      total_samples: metrics.length,
      slow_apis: slowApis.sort((a, b) => (b.p95 || 0) - (a.p95 || 0)),
      recommendations
    };
  }

  async getPerformanceMetricsList(query: GetPerformanceMetricsQueryDto) {
    const { page = 1, limit = 20, from, to, route } = query;
    const filter: any = {};
    if (route) filter.route = route;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.performanceMetricModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.performanceMetricModel.countDocuments(filter).exec()
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDashboardMetrics(requester: any, semesterId?: string) {
    const studentModel = this.connection.model('Student');
    const classModel = this.connection.model('Class');
    const departmentModel = this.connection.model('Department');
    const semesterModel = this.connection.model('Semester');
    const evaluationPeriodModel = this.connection.model('EvaluationPeriod');
    const summaryPointModel = this.connection.model('SummaryPoint');
    const academicRecordModel = this.connection.model('AcademicRecord');
    const studentTaskModel = this.connection.model('StudentTask');
    const notificationModel = this.connection.model('Notification');
    const criterionModel = this.connection.model('Criterion');

    const role = getRequesterRoleName(requester);
    let roleScope: 'admin' | 'teacher' | 'student' | 'system' | 'unknown' = 'unknown';

    if (isAdminUser(requester)) {
      roleScope = 'admin';
    } else if (isTeacher(requester)) {
      roleScope = 'teacher';
    } else if (isStudent(requester)) {
      roleScope = 'student';
    } else if ((requester?.permissions || []).some((p: any) => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ'].includes(p))) {
      roleScope = 'system';
    }

    const semesters = (await semesterModel.find().lean().exec()) as any[];
    const activeSem = semesters.find(s => s.status === 'active') || semesters.find(s => s.status === 'upcoming') || null;
    const targetSemesterId = semesterId && Types.ObjectId.isValid(semesterId)
      ? new Types.ObjectId(semesterId)
      : (activeSem ? activeSem._id : null);

    let activePeriod = null;
    if (targetSemesterId) {
      activePeriod = await evaluationPeriodModel.findOne({
        semester_id: targetSemesterId,
        status: { $ne: 'closed' }
      }).lean().exec();
    } else {
      activePeriod = await evaluationPeriodModel.findOne({
        status: { $ne: 'closed' }
      }).lean().exec();
    }

    let teacherClassIds: Types.ObjectId[] = [];
    let studentIds: Types.ObjectId[] = [];
    let student: any = null;
    let summariesMap = new Map<string, any>();

    if (roleScope === 'teacher') {
      const teacherClasses = await classModel.find({ advisor_id: new Types.ObjectId(requester.userId) }).select('_id').lean().exec();
      teacherClassIds = teacherClasses.map(c => c._id);
    } else if (roleScope === 'student') {
      student = await studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).lean().exec();
      if (student) {
        studentIds = [student._id];
      }
    }

    // ─── KPIs ────────────────────────────────────────────────────────────────
    let totalStudents = 0;
    if (roleScope === 'teacher') {
      totalStudents = await studentModel.countDocuments({ class_id: { $in: teacherClassIds } });
    } else if (roleScope === 'student') {
      totalStudents = studentIds.length;
    } else {
      totalStudents = await studentModel.countDocuments();
    }

    let totalClasses = 0;
    if (roleScope === 'teacher') {
      totalClasses = teacherClassIds.length;
    } else if (roleScope === 'student') {
      totalClasses = student?.class_id ? 1 : 0;
    } else {
      totalClasses = await classModel.countDocuments();
    }

    const totalDepartments = await departmentModel.countDocuments();

    // Average Score
    let averageScore = 0;
    if (targetSemesterId) {
      let avgResult;
      if (roleScope === 'teacher') {
        avgResult = await summaryPointModel.aggregate([
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $match: {
              semester_id: targetSemesterId,
              period_id: null,
              total_score: { $ne: null },
              'student.class_id': { $in: teacherClassIds }
            }
          },
          { $group: { _id: null, avgScore: { $avg: '$total_score' } } }
        ]);
      } else {
        const matchSummaryFilter: any = {
          semester_id: targetSemesterId,
          period_id: null,
          total_score: { $ne: null }
        };
        if (roleScope === 'student') {
          matchSummaryFilter.student_id = { $in: studentIds };
        }
        avgResult = await summaryPointModel.aggregate([
          { $match: matchSummaryFilter },
          { $group: { _id: null, avgScore: { $avg: '$total_score' } } }
        ]);
      }
      averageScore = avgResult.length > 0 ? Math.round(avgResult[0].avgScore * 10) / 10 : 0;
    }

    // Pending My Review Count
    let pendingMyReviewCount = 0;
    if (targetSemesterId) {
      if (roleScope === 'teacher') {
        const result = await summaryPointModel.aggregate([
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $match: {
              semester_id: targetSemesterId,
              period_id: null,
              status: 'sv_submitted',
              'student.class_id': { $in: teacherClassIds }
            }
          },
          { $count: 'count' }
        ]);
        pendingMyReviewCount = result.length > 0 ? result[0].count : 0;
      } else if (roleScope === 'student') {
        pendingMyReviewCount = await summaryPointModel.countDocuments({
          semester_id: targetSemesterId,
          period_id: null,
          status: 'draft',
          student_id: { $in: studentIds }
        });
      } else if (roleScope === 'admin') {
        pendingMyReviewCount = await summaryPointModel.countDocuments({
          semester_id: targetSemesterId,
          period_id: null,
          status: { $in: ['gv_reviewed', 'sv_submitted'] }
        });
      }
    }

    // Urgent Tasks
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    const taskFilter: any = {
      status: { $ne: 'completed' },
      deletedAt: null,
      $or: [
        { priority: 'high' },
        { deadline: { $gte: now, $lte: threeDaysLater } }
      ]
    };

    if (roleScope === 'student' && student) {
      taskFilter.$or = [
        { targetType: 'student', targetScope: 'all' },
        { targetType: 'student', targetScope: 'specific', targetStudentIds: student._id }
      ];
    } else if (roleScope === 'teacher') {
      taskFilter.$or = [
        { targetType: 'teacher', targetScope: 'all' },
        { targetType: 'teacher', targetScope: 'specific', targetTeacherIds: new Types.ObjectId(requester.userId) },
        { createdBy: new Types.ObjectId(requester.userId) }
      ];
    }

    const urgentTasks = await studentTaskModel.find(taskFilter).sort({ deadline: 1 }).limit(5).lean().exec();
    const urgentTasksCount = await studentTaskModel.countDocuments(taskFilter);

    // Notifications
    const normalizedRoleLower = role.toLowerCase();
    const notifFilter: any = {
      deletedAt: null,
      $or: [
        { recipientUserId: new Types.ObjectId(requester.userId) },
        { recipientUserId: null, targetRole: { $in: ['all', normalizedRoleLower] } }
      ]
    };
    const recentNotifications = await notificationModel.find(notifFilter).sort({ createdAt: -1 }).limit(5).lean().exec();
    const unreadNotificationsCount = await notificationModel.countDocuments({
      ...notifFilter,
      readByUserIds: { $ne: new Types.ObjectId(requester.userId) }
    });

    // ─── DISTRIBUTIONS ───────────────────────────────────────────────────────
    // Student Status
    const studentStatusMatch = roleScope === 'teacher' ? { class_id: { $in: teacherClassIds } } : {};
    const statusResult = await studentModel.aggregate([
      { $match: studentStatusMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const studentStatus: Record<string, number> = {};
    statusResult.forEach(item => {
      studentStatus[item._id] = item.count;
    });

    // Evaluation Status
    const evaluationStatus: Record<string, number> = {
      draft: 0,
      sv_submitted: 0,
      gv_reviewed: 0,
      locked: 0,
    };
    if (targetSemesterId) {
      let evalResult;
      if (roleScope === 'teacher') {
        evalResult = await summaryPointModel.aggregate([
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $match: {
              semester_id: targetSemesterId,
              period_id: null,
              'student.class_id': { $in: teacherClassIds }
            }
          },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
      } else {
        const evalMatch: any = { semester_id: targetSemesterId, period_id: null };
        if (roleScope === 'student') {
          evalMatch.student_id = { $in: studentIds };
        }
        evalResult = await summaryPointModel.aggregate([
          { $match: evalMatch },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
      }
      evalResult.forEach(item => {
        if (evaluationStatus[item._id] !== undefined) {
          evaluationStatus[item._id] = item.count;
        }
      });
    }

    // Class Distribution by Dept
    const classMatch = roleScope === 'teacher' ? { advisor_id: new Types.ObjectId(requester.userId) } : {};
    const classDistResult = await classModel.aggregate([
      { $match: classMatch },
      { $group: { _id: '$dept_id', count: { $sum: 1 } } }
    ]);
    const deptIds = classDistResult.map(c => c._id).filter(Boolean);
    const depts = (await departmentModel.find({ _id: { $in: deptIds } }).select('_id name').lean().exec()) as any[];
    const deptMap = new Map(depts.map((d: any) => [d._id.toString(), d.name]));
    const classDistributionByDept: Record<string, number> = {};
    classDistResult.forEach(item => {
      const deptName = item._id ? (deptMap.get(item._id.toString()) || 'Chưa phân khoa') : 'Chưa phân khoa';
      classDistributionByDept[deptName] = item.count;
    });

    // Score Distribution
    const scoreDistribution = {
      xuatsac: 0,
      tot: 0,
      kha: 0,
      trungbinh: 0,
      yeu: 0,
    };
    if (targetSemesterId) {
      let scoreDistResult;
      if (roleScope === 'teacher') {
        scoreDistResult = await summaryPointModel.aggregate([
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $match: {
              semester_id: targetSemesterId,
              period_id: null,
              total_score: { $ne: null },
              'student.class_id': { $in: teacherClassIds }
            }
          },
          {
            $project: {
              bucket: {
                $cond: [
                  { $gte: ['$total_score', 90] }, 'xuatsac',
                  {
                    $cond: [
                      { $gte: ['$total_score', 80] }, 'tot',
                      {
                        $cond: [
                          { $gte: ['$total_score', 65] }, 'kha',
                          {
                            $cond: [
                              { $gte: ['$total_score', 50] }, 'trungbinh', 'yeu'
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          { $group: { _id: '$bucket', count: { $sum: 1 } } }
        ]);
      } else {
        const scoreDistMatch: any = { semester_id: targetSemesterId, period_id: null, total_score: { $ne: null } };
        if (roleScope === 'student') {
          scoreDistMatch.student_id = { $in: studentIds };
        }
        scoreDistResult = await summaryPointModel.aggregate([
          { $match: scoreDistMatch },
          {
            $project: {
              bucket: {
                $cond: [
                  { $gte: ['$total_score', 90] }, 'xuatsac',
                  {
                    $cond: [
                      { $gte: ['$total_score', 80] }, 'tot',
                      {
                        $cond: [
                          { $gte: ['$total_score', 65] }, 'kha',
                          {
                            $cond: [
                              { $gte: ['$total_score', 50] }, 'trungbinh', 'yeu'
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          { $group: { _id: '$bucket', count: { $sum: 1 } } }
        ]);
      }
      scoreDistResult.forEach(item => {
        if (item._id in scoreDistribution) {
          scoreDistribution[item._id as keyof typeof scoreDistribution] = item.count;
        }
      });
    }

    // ─── RECENT LISTS & HIGHLIGHTS ───────────────────────────────────────────
    let recentAcademicRecords: any[] = [];
    let topScores: any[] = [];
    let topRewards: any[] = [];
    let topBonus: any[] = [];
    let topDiscipline: any[] = [];
    let mySpotlight: any = undefined;

    if (targetSemesterId) {
      if (roleScope === 'teacher') {
        recentAcademicRecords = await academicRecordModel.aggregate([
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student_id'
            }
          },
          { $unwind: '$student_id' },
          {
            $match: {
              semester_id: targetSemesterId,
              status: 'active',
              is_deleted: { $ne: true },
              'student_id.class_id': { $in: teacherClassIds }
            }
          },
          { $sort: { recorded_at: -1, createdAt: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'criteria',
              localField: 'criterion_id',
              foreignField: '_id',
              as: 'criterion_id'
            }
          },
          { $unwind: { path: '$criterion_id', preserveNullAndEmptyArrays: true } }
        ]);
      } else {
        const academicRecordFilter: any = {
          semester_id: targetSemesterId,
          status: 'active',
          is_deleted: { $ne: true }
        };
        if (roleScope === 'student') {
          academicRecordFilter.student_id = { $in: studentIds };
        }
        recentAcademicRecords = await academicRecordModel.find(academicRecordFilter)
          .populate('student_id', 'full_name student_code class_id')
          .populate('criterion_id', 'criterion_name criterion_type score_per_unit')
          .sort({ recorded_at: -1, createdAt: -1 })
          .limit(5)
          .lean()
          .exec();
      }

      // Top Scores
      let topScoresRaw: any[] = [];
      if (roleScope === 'teacher') {
        topScoresRaw = await summaryPointModel.aggregate([
          {
            $lookup: {
              from: 'students',
              localField: 'student_id',
              foreignField: '_id',
              as: 'student_id'
            }
          },
          { $unwind: '$student_id' },
          {
            $match: {
              semester_id: targetSemesterId,
              period_id: null,
              total_score: { $ne: null },
              'student_id.class_id': { $in: teacherClassIds }
            }
          },
          { $sort: { total_score: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'classes',
              localField: 'student_id.class_id',
              foreignField: '_id',
              as: 'student_id.class_id'
            }
          },
          { $unwind: { path: '$student_id.class_id', preserveNullAndEmptyArrays: true } }
        ]);
      } else {
        const topScoresMatch: any = {
          semester_id: targetSemesterId,
          period_id: null,
          total_score: { $ne: null }
        };
        if (roleScope === 'student') {
          topScoresMatch.student_id = { $in: studentIds };
        }
        topScoresRaw = await summaryPointModel.find(topScoresMatch)
          .populate({
            path: 'student_id',
            select: 'full_name student_code class_id',
            populate: { path: 'class_id', select: 'class_name' }
          })
          .sort({ total_score: -1 })
          .limit(5)
          .lean()
          .exec();
      }

      // Preload latestRecord for top scores to avoid N+1 query pattern
      const topStudentIds = topScoresRaw.map((s: any) => s.student_id?._id).filter(Boolean);
      const latestRecordsRaw = await academicRecordModel.aggregate([
        {
          $match: {
            student_id: { $in: topStudentIds },
            semester_id: targetSemesterId,
            status: 'active',
            is_deleted: { $ne: true }
          }
        },
        { $sort: { recorded_at: -1, createdAt: -1 } },
        {
          $group: {
            _id: '$student_id',
            latestRecordId: { $first: '$_id' }
          }
        }
      ]);
      
      const latestRecordIds = latestRecordsRaw.map(r => r.latestRecordId);
      const latestRecords = await academicRecordModel.find({ _id: { $in: latestRecordIds } })
        .populate('criterion_id', 'criterion_name')
        .lean()
        .exec();
        
      const latestRecordMap = new Map<string, any>(latestRecords.map((r: any) => [r.student_id.toString(), r]));

      topScores = topScoresRaw.map((s: any) => {
        const latestRecord = latestRecordMap.get(s.student_id?._id?.toString() || '');
        const classId = s.student_id?.class_id?._id || s.student_id?.class_id;
        const className = s.student_id?.class_id?.class_name || '';

        return {
          studentId: s.student_id?._id,
          classId,
          studentName: s.student_id?.full_name || '',
          studentCode: s.student_id?.student_code || '',
          className,
          currentScore: s.total_score,
          grading: s.grading,
          recordCount: 0,
          impactScore: 0,
          latestRecordTitle: latestRecord?.record_title || latestRecord?.criterion_id?.criterion_name || 'Không có ghi nhận',
          latestRecordAt: latestRecord?.recorded_at || latestRecord?.createdAt || null,
          dominantCriterionName: latestRecord?.criterion_id?.criterion_name || null,
          type: 'score',
          href: classId ? `/students/${classId}/${s.student_id._id}` : `/students`
        };
      });

      // 1. Build base match filter for academic records
      const getHighlightBaseStages = () => {
        if (roleScope === 'teacher') {
          return [
            {
              $lookup: {
                from: 'students',
                localField: 'student_id',
                foreignField: '_id',
                as: 'student_doc'
              }
            },
            { $unwind: '$student_doc' },
            {
              $match: {
                semester_id: targetSemesterId,
                status: 'active',
                is_deleted: { $ne: true },
                'student_doc.class_id': { $in: teacherClassIds }
              }
            }
          ];
        }
        const match: any = {
          semester_id: targetSemesterId,
          status: 'active',
          is_deleted: { $ne: true }
        };
        if (roleScope === 'student') {
          match.student_id = { $in: studentIds };
        }
        return [{ $match: match }];
      };

      // 2. Fetch top highlights using MongoDB Aggregation Pipelines
      const [rewardsAgg, bonusAgg, disciplineAgg] = await Promise.all([
        academicRecordModel.aggregate([
          ...getHighlightBaseStages(),
          {
            $lookup: {
              from: criterionModel.collection.name,
              localField: 'criterion_id',
              foreignField: '_id',
              as: 'criterion'
            }
          },
          { $unwind: '$criterion' },
          { $match: { 'criterion.criterion_type': 'khen_thuong' } },
          { $sort: { recorded_at: -1, createdAt: -1 } },
          {
            $group: {
              _id: '$student_id',
              recordCount: { $sum: 1 },
              impactScore: {
                $sum: { $ifNull: ['$points_effect', '$criterion.score_per_unit'] }
              },
              latestRecord: { $first: '$$ROOT' }
            }
          },
          {
            $sort: {
              recordCount: -1,
              impactScore: -1,
              'latestRecord.recorded_at': -1
            }
          },
          { $limit: 5 },
          {
            $lookup: {
              from: studentModel.collection.name,
              localField: '_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $lookup: {
              from: classModel.collection.name,
              localField: 'student.class_id',
              foreignField: '_id',
              as: 'class'
            }
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: summaryPointModel.collection.name,
              let: { studentId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$student_id', '$$studentId'] },
                        { $eq: ['$semester_id', targetSemesterId] },
                        { $eq: ['$period_id', null] }
                      ]
                    }
                  }
                }
              ],
              as: 'summary'
            }
          },
          { $unwind: { path: '$summary', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              studentId: '$_id',
              classId: '$student.class_id',
              studentName: '$student.full_name',
              studentCode: '$student.student_code',
              className: { $ifNull: ['$class.class_name', ''] },
              currentScore: { $ifNull: ['$summary.total_score', null] },
              grading: { $ifNull: ['$summary.grading', null] },
              recordCount: 1,
              impactScore: 1,
              latestRecordTitle: {
                $ifNull: [
                  '$latestRecord.record_title',
                  '$latestRecord.criterion.criterion_name',
                  'Không có ghi nhận'
                ]
              },
              latestRecordAt: {
                $ifNull: [
                  '$latestRecord.recorded_at',
                  '$latestRecord.createdAt',
                  null
                ]
              },
              dominantCriterionName: { $ifNull: ['$latestRecord.criterion.criterion_name', null] },
              type: { $literal: 'khen_thuong' },
              href: {
                $cond: [
                  { $not: ['$student.class_id'] },
                  '/students',
                  { $concat: ['/students/', { $toString: '$student.class_id' }, '/', { $toString: '$_id' }] }
                ]
              }
            }
          }
        ]).exec(),

        academicRecordModel.aggregate([
          ...getHighlightBaseStages(),
          {
            $lookup: {
              from: criterionModel.collection.name,
              localField: 'criterion_id',
              foreignField: '_id',
              as: 'criterion'
            }
          },
          { $unwind: '$criterion' },
          {
            $match: {
              $or: [
                { 'criterion.criterion_type': 'cong_diem' },
                { points_effect: { $gt: 0 } },
                { $and: [ { points_effect: null }, { 'criterion.score_per_unit': { $gt: 0 } } ] }
              ]
            }
          },
          { $sort: { recorded_at: -1, createdAt: -1 } },
          {
            $group: {
              _id: '$student_id',
              recordCount: { $sum: 1 },
              impactScore: {
                $sum: { $ifNull: ['$points_effect', '$criterion.score_per_unit'] }
              },
              latestRecord: { $first: '$$ROOT' }
            }
          },
          {
            $sort: {
              impactScore: -1,
              recordCount: -1,
              'latestRecord.recorded_at': -1
            }
          },
          { $limit: 5 },
          {
            $lookup: {
              from: studentModel.collection.name,
              localField: '_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $lookup: {
              from: classModel.collection.name,
              localField: 'student.class_id',
              foreignField: '_id',
              as: 'class'
            }
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: summaryPointModel.collection.name,
              let: { studentId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$student_id', '$$studentId'] },
                        { $eq: ['$semester_id', targetSemesterId] },
                        { $eq: ['$period_id', null] }
                      ]
                    }
                  }
                }
              ],
              as: 'summary'
            }
          },
          { $unwind: { path: '$summary', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              studentId: '$_id',
              classId: '$student.class_id',
              studentName: '$student.full_name',
              studentCode: '$student.student_code',
              className: { $ifNull: ['$class.class_name', ''] },
              currentScore: { $ifNull: ['$summary.total_score', null] },
              grading: { $ifNull: ['$summary.grading', null] },
              recordCount: 1,
              impactScore: 1,
              latestRecordTitle: {
                $ifNull: [
                  '$latestRecord.record_title',
                  '$latestRecord.criterion.criterion_name',
                  'Không có ghi nhận'
                ]
              },
              latestRecordAt: {
                $ifNull: [
                  '$latestRecord.recorded_at',
                  '$latestRecord.createdAt',
                  null
                ]
              },
              dominantCriterionName: { $ifNull: ['$latestRecord.criterion.criterion_name', null] },
              type: { $literal: 'cong_diem' },
              href: {
                $cond: [
                  { $not: ['$student.class_id'] },
                  '/students',
                  { $concat: ['/students/', { $toString: '$student.class_id' }, '/', { $toString: '$_id' }] }
                ]
              }
            }
          }
        ]).exec(),

        academicRecordModel.aggregate([
          ...getHighlightBaseStages(),
          {
            $lookup: {
              from: criterionModel.collection.name,
              localField: 'criterion_id',
              foreignField: '_id',
              as: 'criterion'
            }
          },
          { $unwind: '$criterion' },
          {
            $match: {
              $or: [
                { 'criterion.criterion_type': 'ky_luat' },
                { points_effect: { $lt: 0 } },
                { $and: [ { points_effect: null }, { 'criterion.score_per_unit': { $lt: 0 } } ] }
              ]
            }
          },
          { $sort: { recorded_at: -1, createdAt: -1 } },
          {
            $group: {
              _id: '$student_id',
              recordCount: { $sum: 1 },
              impactScore: {
                $sum: { $ifNull: ['$points_effect', '$criterion.score_per_unit'] }
              },
              latestRecord: { $first: '$$ROOT' }
            }
          },
          {
            $sort: {
              recordCount: -1,
              impactScore: 1,
              'latestRecord.recorded_at': -1
            }
          },
          { $limit: 5 },
          {
            $lookup: {
              from: studentModel.collection.name,
              localField: '_id',
              foreignField: '_id',
              as: 'student'
            }
          },
          { $unwind: '$student' },
          {
            $lookup: {
              from: classModel.collection.name,
              localField: 'student.class_id',
              foreignField: '_id',
              as: 'class'
            }
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: summaryPointModel.collection.name,
              let: { studentId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$student_id', '$$studentId'] },
                        { $eq: ['$semester_id', targetSemesterId] },
                        { $eq: ['$period_id', null] }
                      ]
                    }
                  }
                }
              ],
              as: 'summary'
            }
          },
          { $unwind: { path: '$summary', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              studentId: '$_id',
              classId: '$student.class_id',
              studentName: '$student.full_name',
              studentCode: '$student.student_code',
              className: { $ifNull: ['$class.class_name', ''] },
              currentScore: { $ifNull: ['$summary.total_score', null] },
              grading: { $ifNull: ['$summary.grading', null] },
              recordCount: 1,
              impactScore: 1,
              latestRecordTitle: {
                $ifNull: [
                  '$latestRecord.record_title',
                  '$latestRecord.criterion.criterion_name',
                  'Không có ghi nhận'
                ]
              },
              latestRecordAt: {
                $ifNull: [
                  '$latestRecord.recorded_at',
                  '$latestRecord.createdAt',
                  null
                ]
              },
              dominantCriterionName: { $ifNull: ['$latestRecord.criterion.criterion_name', null] },
              type: { $literal: 'ky_luat' },
              href: {
                $cond: [
                  { $not: ['$student.class_id'] },
                  '/students',
                  { $concat: ['/students/', { $toString: '$student.class_id' }, '/', { $toString: '$_id' }] }
                ]
              }
            }
          }
        ]).exec()
      ]);

      topRewards = rewardsAgg;
      topBonus = bonusAgg;
      topDiscipline = disciplineAgg;

      // Student spotlight
      if (roleScope === 'student' && studentIds.length > 0) {
        const sId = studentIds[0];
        
        // Find discipline criterion IDs
        const disciplineCriteria = await criterionModel.find({ criterion_type: 'ky_luat' }).select('_id').lean().exec();
        const disciplineIds = disciplineCriteria.map(c => c._id);

        const [studentInfo, summary, totalPositiveCount, totalWarningCount, positiveRecordsRaw, warningRecordsRaw] = await Promise.all([
          studentModel.findById(sId).lean().exec() as any,
          summaryPointModel.findOne({
            student_id: sId,
            semester_id: targetSemesterId,
            period_id: null
          }).lean().exec() as any,
          academicRecordModel.countDocuments({
            student_id: sId,
            semester_id: targetSemesterId,
            status: 'active',
            is_deleted: { $ne: true },
            points_effect: { $gte: 0 },
            criterion_id: { $not: { $in: disciplineIds } }
          }),
          academicRecordModel.countDocuments({
            student_id: sId,
            semester_id: targetSemesterId,
            status: 'active',
            is_deleted: { $ne: true },
            $or: [
              { points_effect: { $lt: 0 } },
              { criterion_id: { $in: disciplineIds } }
            ]
          }),
          academicRecordModel.find({
            student_id: sId,
            semester_id: targetSemesterId,
            status: 'active',
            is_deleted: { $ne: true },
            points_effect: { $gte: 0 },
            criterion_id: { $not: { $in: disciplineIds } }
          })
          .populate('criterion_id', 'criterion_name criterion_type score_per_unit')
          .sort({ recorded_at: -1, createdAt: -1 })
          .limit(10)
          .lean()
          .exec() as any,
          academicRecordModel.find({
            student_id: sId,
            semester_id: targetSemesterId,
            status: 'active',
            is_deleted: { $ne: true },
            $or: [
              { points_effect: { $lt: 0 } },
              { criterion_id: { $in: disciplineIds } }
            ]
          })
          .populate('criterion_id', 'criterion_name criterion_type score_per_unit')
          .sort({ recorded_at: -1, createdAt: -1 })
          .limit(10)
          .lean()
          .exec() as any
        ]);

        if (studentInfo) {
          const classObj = studentInfo.class_id ? await classModel.findById(studentInfo.class_id).select('class_name').lean().exec() as any : null;
          const className = classObj?.class_name || '';

          const score = summary ? summary.total_score : null;
          const grading = summary ? summary.grading : null;
          const evaluationStatus = summary ? summary.status : null;

          const mapRecord = (r: any, defaultType: string) => {
            const pointsEffect = r.points_effect !== undefined && r.points_effect !== null
              ? Number(r.points_effect)
              : (r.criterion_id?.score_per_unit || 0);

            return {
              studentId: sId.toString(),
              classId: studentInfo.class_id,
              studentName: studentInfo.full_name || '',
              studentCode: studentInfo.student_code || '',
              className,
              currentScore: score,
              grading,
              recordCount: 1,
              impactScore: pointsEffect,
              latestRecordTitle: r.record_title || r.criterion_id?.criterion_name || 'Ghi nhận mới',
              latestRecordAt: r.recorded_at || r.createdAt,
              dominantCriterionName: r.criterion_id?.criterion_name || null,
              type: defaultType,
              href: studentInfo.class_id ? `/students/${studentInfo.class_id}/${sId}` : `/students`
            };
          };

          const positiveRecords = positiveRecordsRaw.map((r: any) => mapRecord(r, 'cong_diem'));
          const warningRecords = warningRecordsRaw.map((r: any) => mapRecord(r, 'ky_luat'));

          let nextActionLabel = 'Tự đánh giá điểm rèn luyện';
          let nextActionHref = '/grading/score';
          if (evaluationStatus === 'sv_submitted') {
            nextActionLabel = 'Xem hồ sơ đã nộp';
          } else if (evaluationStatus === 'gv_reviewed') {
            nextActionLabel = 'Hồ sơ đã được duyệt';
          } else if (evaluationStatus === 'locked') {
            nextActionLabel = 'Xem kết quả chính thức';
          }

          mySpotlight = {
            studentId: sId.toString(),
            classId: studentInfo.class_id,
            currentScore: score,
            grading,
            evaluationStatus,
            positiveRecords,
            warningRecords,
            totalPositiveCount,
            totalWarningCount,
            nextAction: {
              label: nextActionLabel,
              href: nextActionHref
            }
          };
        }
      }
    }

    // ─── OPERATOR KPIs ───────────────────────────────────────────────────────
    let todayLoginSuccess = 0;
    let todayLoginFailure = 0;
    let pendingSystemRequests = 0;
    let lastBackupStatus: string | null = null;
    let lastBackupTime: Date | null = null;
    let systemRequestsList: any[] = [];
    let backupsList: any[] = [];

    if (roleScope === 'admin' || roleScope === 'system') {
      const loginLogsSummary = await this.getLoginLogsSummary();
      todayLoginSuccess = loginLogsSummary?.today?.login_success || 0;
      todayLoginFailure = loginLogsSummary?.today?.login_failure || 0;

      const requestModel = this.connection.model('SystemRequest');
      pendingSystemRequests = await requestModel.countDocuments({ status: 'pending', deletedAt: null });
      systemRequestsList = await requestModel.find({ deletedAt: null })
        .populate('requester_id', 'user_name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();

      backupsList = await this.backupJobModel.find()
        .populate('requested_by', 'user_name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec();

      const latestBackup = backupsList[0];
      lastBackupStatus = latestBackup ? latestBackup.status : null;
      lastBackupTime = latestBackup ? latestBackup.createdAt : null;
    }

    // Student specific
    let myCurrentScore: number | null = null;
    let myGrading: string | null = null;
    let myEvaluationStatus: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked' | null = null;
    if (roleScope === 'student' && studentIds.length > 0) {
      const summary = summariesMap.get(studentIds[0].toString());
      if (summary) {
        myCurrentScore = summary.total_score;
        myGrading = summary.grading;
        myEvaluationStatus = summary.status;
      }
    }

    return {
      roleScope,
      activeSemester: activeSem,
      activePeriod,
      systemData: {
        systemRequests: systemRequestsList,
        backups: backupsList
      },
      kpis: {
        totalStudents,
        totalClasses,
        totalDepartments,
        averageScore,
        pendingMyReviewCount,
        urgentTasksCount,
        unreadNotificationsCount,
        
        myCurrentScore,
        myGrading,
        myEvaluationStatus,
        
        todayLoginSuccess,
        todayLoginFailure,
        pendingSystemRequests,
        lastBackupStatus,
        lastBackupTime,
      },
      distributions: {
        studentStatus,
        evaluationStatus,
        classDistributionByDept,
        scoreDistribution,
        attendanceRate: 100,
        attendanceTodaySubmitted: 0,
        attendanceTodayPending: 0,
      },
      recentNotifications,
      urgentTasks,
      recentAcademicRecords,
      recentDailyReports: [],
      studentHighlights: {
        topScores,
        topRewards,
        topBonus,
        topDiscipline,
        mySpotlight: mySpotlight || undefined
      }
    };
  }
  // ─── MAIL SETTINGS ─────────────────────────────────────────────────────────

  private normalizeModuleMaintenanceStates(value: any): Record<string, boolean> {
    const rawStates = value?.states && typeof value.states === 'object' ? value.states : value;
    if (!rawStates || typeof rawStates !== 'object' || Array.isArray(rawStates)) return {};

    return Object.entries(rawStates).reduce<Record<string, boolean>>((acc, [moduleId, isMaintenance]) => {
      if (moduleId && typeof moduleId === 'string') {
        acc[moduleId] = isMaintenance === true;
      }
      return acc;
    }, {});
  }

  async getModuleMaintenanceStates() {
    const setting: any = await this.systemSettingModel
      .findOne({ key: MODULE_MAINTENANCE_SETTING_KEY })
      .lean()
      .exec();

    return {
      states: this.normalizeModuleMaintenanceStates(setting?.value),
      updatedAt: setting?.updatedAt || null,
    };
  }

  async updateModuleMaintenanceState(moduleId: string, dto: UpdateModuleMaintenanceDto, userId?: string) {
    const normalizedModuleId = String(moduleId || '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{1,79}$/i.test(normalizedModuleId)) {
      throw new BadRequestException('Invalid module id');
    }

    const currentSetting: any = await this.systemSettingModel
      .findOne({ key: MODULE_MAINTENANCE_SETTING_KEY })
      .lean()
      .exec();
    const states = this.normalizeModuleMaintenanceStates(currentSetting?.value);
    states[normalizedModuleId] = dto.isMaintenance === true;

    const updatedSetting: any = await this.systemSettingModel
      .findOneAndUpdate(
        { key: MODULE_MAINTENANCE_SETTING_KEY },
        {
          key: MODULE_MAINTENANCE_SETTING_KEY,
          value: { states },
          description: 'Per-module maintenance mode flags',
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    this.logger.log(
      `AUDIT: User ${userId || 'unknown'} set maintenance for module ${normalizedModuleId} to ${states[normalizedModuleId]}`,
    );

    return {
      states: this.normalizeModuleMaintenanceStates(updatedSetting?.value),
      updatedAt: updatedSetting?.updatedAt || null,
    };
  }

  private readonly ENCRYPTION_ALGORITHM = 'aes-256-cbc';

  private encrypt(text: string): { iv: string, content: string } {
    const keyString = this.configService.get<string>('SETTINGS_ENCRYPTION_KEY');
    if (!keyString) throw new Error('SETTINGS_ENCRYPTION_KEY is missing. Please contact administrator.');
    const key = crypto.createHash('sha256').update(String(keyString)).digest('base64').substring(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
  }

  private decrypt(hash: { iv: string, content: string }): string {
    const keyString = this.configService.get<string>('SETTINGS_ENCRYPTION_KEY');
    if (!keyString) throw new Error('SETTINGS_ENCRYPTION_KEY is missing. Please contact administrator.');
    const key = crypto.createHash('sha256').update(String(keyString)).digest('base64').substring(0, 32);
    const iv = Buffer.from(hash.iv, 'hex');
    const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, Buffer.from(key), iv);
    let decrypted = decipher.update(Buffer.from(hash.content, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  async onModuleInit() {
    try {
      const mailConfig = await this.systemSettingModel.findOne({ key: 'MAIL_SMTP_CONFIG' }).lean();
      if (mailConfig && mailConfig.value) {
        const { host, port, secure, user, pass: encryptedPass, from } = mailConfig.value;
        const pass = encryptedPass ? this.decrypt(encryptedPass) : undefined;
        if (pass) {
          this.mailService.reloadConfig({ host, port, secure, user, pass, from });
          this.logger.log('Loaded SMTP configurations from database');
        }
      }
    } catch (error) {
      this.logger.error('Failed to load SMTP config from DB on startup, fallback to ENV.', error);
    }
  }

  async getMailSettings() {
    const mailConfig = await this.systemSettingModel.findOne({ key: 'MAIL_SMTP_CONFIG' }).lean();
    if (!mailConfig || !mailConfig.value) {
      return {
        host: this.configService.get<string>('MAIL_HOST') || '',
        port: parseInt(this.configService.get<string>('MAIL_PORT') || '587', 10),
        secure: this.configService.get<string>('MAIL_SECURE') === 'true',
        user: this.configService.get<string>('MAIL_USER') || '',
        from: this.configService.get<string>('MAIL_FROM') || '',
        hasPassword: !!this.configService.get<string>('MAIL_PASS')
      };
    }
    
    const { host, port, secure, user, pass, from } = mailConfig.value;
    return {
      host,
      port,
      secure,
      user,
      from,
      hasPassword: !!pass // mask the password
    };
  }

  async updateMailSettings(dto: UpdateMailSettingsDto) {
    let encryptedPass: { iv: string, content: string } | undefined;

    if (dto.pass && dto.pass.trim() !== '') {
      encryptedPass = this.encrypt(dto.pass);
    }

    const currentConfig = await this.systemSettingModel.findOne({ key: 'MAIL_SMTP_CONFIG' });
    
    let passToSave = encryptedPass;
    if (!passToSave && currentConfig && currentConfig.value && currentConfig.value.pass) {
      passToSave = currentConfig.value.pass; // keep old password
    }

    if (!passToSave && !this.configService.get('MAIL_PASS')) {
      throw new BadRequestException('Vui lòng nhập mật khẩu SMTP');
    }

    const value = {
      host: dto.host,
      port: dto.port,
      secure: dto.secure,
      user: dto.user,
      pass: passToSave,
      from: dto.from
    };

    await this.systemSettingModel.findOneAndUpdate(
      { key: 'MAIL_SMTP_CONFIG' },
      { key: 'MAIL_SMTP_CONFIG', value, description: 'Cấu hình kết nối MAIL SMTP' },
      { upsert: true, new: true }
    );

    // Apply new config
    const plainPass = passToSave ? this.decrypt(passToSave) : this.configService.get<string>('MAIL_PASS');
    this.mailService.reloadConfig({
      host: dto.host,
      port: dto.port,
      secure: dto.secure,
      user: dto.user,
      pass: plainPass!,
      from: dto.from
    });

    return { message: 'Cập nhật cấu hình SMTP thành công' };
  }

  async testMailConnection(testConfig?: UpdateMailSettingsDto) {
    let configForTest: MailConfigOptions | undefined;
    if (testConfig) {
      const pass = testConfig.pass && testConfig.pass.trim() !== '' 
        ? testConfig.pass 
        : undefined;

      let passToUse = pass;
      if (!passToUse) {
        const currentConfig = await this.systemSettingModel.findOne({ key: 'MAIL_SMTP_CONFIG' });
        if (currentConfig && currentConfig.value && currentConfig.value.pass) {
          passToUse = this.decrypt(currentConfig.value.pass);
        } else {
          passToUse = this.configService.get<string>('MAIL_PASS');
        }
      }

      if (!passToUse) throw new BadRequestException('Mật khẩu SMTP chưa được cấu hình');

      configForTest = {
        host: testConfig.host,
        port: testConfig.port,
        secure: testConfig.secure,
        user: testConfig.user,
        pass: passToUse,
        from: testConfig.from
      };
    }
    
    await this.mailService.verifyConnection(configForTest);
    return { message: 'Kiểm tra kết nối thành công' };
  }

  async sendTestMail(to: string, testConfig?: UpdateMailSettingsDto) {
    let configForTest: MailConfigOptions | undefined;
    if (testConfig) {
      const pass = testConfig.pass && testConfig.pass.trim() !== '' 
        ? testConfig.pass 
        : undefined;

      let passToUse = pass;
      if (!passToUse) {
        const currentConfig = await this.systemSettingModel.findOne({ key: 'MAIL_SMTP_CONFIG' });
        if (currentConfig && currentConfig.value && currentConfig.value.pass) {
          passToUse = this.decrypt(currentConfig.value.pass);
        } else {
          passToUse = this.configService.get<string>('MAIL_PASS');
        }
      }

      if (!passToUse) throw new BadRequestException('Mật khẩu SMTP chưa được cấu hình');

      configForTest = {
        host: testConfig.host,
        port: testConfig.port,
        secure: testConfig.secure,
        user: testConfig.user,
        pass: passToUse,
        from: testConfig.from
      };
    }

    await this.mailService.sendTestEmail(to, configForTest);
    return { message: 'Đã gửi email thử nghiệm thành công' };
  }
}
