import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { SystemRequest, SystemRequestDocument } from './schemas/system-request.schema';
import { DatabaseBackupJob, DatabaseBackupJobDocument } from './schemas/database-backup-job.schema';
import { LoginLog, LoginLogDocument } from '../auth/schemas/login-log.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { GetLoginLogsQueryDto, CreateSystemRequestDto, UpdateSystemRequestDto, UpdateSystemRequestStatusDto, GetSystemRequestsQueryDto, GetBackupsQueryDto } from './dto/system.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const execFileAsync = promisify(execFile);

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
        this.push(JSON.stringify({ __collection: currentCollName }) + '\n');
        if (!this.db) {
          throw new Error('Kết nối cơ sở dữ liệu chưa sẵn sàng');
        }
        const dbCollection = this.db.collection(currentCollName);
        this.cursor = dbCollection.find({});
        return;
      }

      if (await this.cursor.hasNext()) {
        const doc = await this.cursor.next();
        this.push(JSON.stringify(doc) + '\n');
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
    @InjectModel(LoginLog.name) private loginLogModel: Model<LoginLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
    @InjectConnection() private connection: Connection,
  ) {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

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

  async getLoginLogsSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysStart = new Date();
    sevenDaysStart.setDate(sevenDaysStart.getDate() - 7);
    sevenDaysStart.setHours(0, 0, 0, 0);

    const [todayStats, sevenDaysStats] = await Promise.all([
      this.loginLogModel.aggregate([
        { $match: { login_time: { $gte: todayStart } } },
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

  async createBackup(userId: string) {
    // Block both running and queued backup jobs
    const activeJob = await this.backupJobModel.findOne({
      status: { $in: ['queued', 'running'] }
    }).exec();

    if (activeJob) {
      throw new ConflictException('Hiện tại đang có tiến trình sao lưu khác đang chờ hoặc đang chạy.');
    }

    const job = await this.backupJobModel.create({
      status: 'queued',
      requested_by: this.toObjectId(userId),
    });

    this.logger.log(`AUDIT: User ${userId} requested backup creation. Job ID: ${job._id}`);

    // Run async backup
    this.runBackupAsync(job._id.toString()).catch((err) => {
      this.logger.error(`Error running backup job ${job._id}:`, err);
    });

    return job;
  }

  private async runBackupAsync(jobId: string) {
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
      if (!this.connection.db) {
        throw new Error('Kết nối cơ sở dữ liệu chưa sẵn sàng');
      }

      const collectionsObj = await this.connection.db.listCollections().toArray();
      const collections = collectionsObj.map(c => c.name).filter(name => !name.startsWith('system.'));

      if (collections.length === 0) {
        throw new Error('Không tìm thấy bất kỳ collection nào để sao lưu.');
      }

      // Safe child process execution with execFile (no shell injection)
      this.logger.log(`Starting mongodump execFile for backup job ${jobId}`);
      try {
        // execFile args are passed safely as an array
        await execFileAsync('mongodump', [`--uri=${mongoUri}`, `--archive=${filePath}`, '--gzip']);
        this.logger.log(`mongodump completed successfully for job ${jobId}`);
      } catch (err) {
        const maskedMsg = this.maskUri(err.message || '');
        this.logger.warn(`mongodump failed, trying fallback mongoose stream: ${maskedMsg}`);
        // Fallback to Mongoose custom NDJSON stream
        await this.runMongooseBackupFallback(filePath, collections);
        this.logger.log(`Fallback mongoose streaming backup completed for job ${jobId}`);
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
    if (!absoluteFilePath.startsWith(safePrefix)) {
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
      throw new NotFoundException('Yêu cầu sao lưu không tồn tại');
    }
    
    let fileExists = false;
    let fileDeleted = false;

    // Path traversal check
    if (job.file_path) {
      const absoluteFilePath = path.resolve(job.file_path);
      const absoluteBackupDir = path.resolve(this.backupDir);
      const safePrefix = absoluteBackupDir.endsWith(path.sep) ? absoluteBackupDir : absoluteBackupDir + path.sep;
      if (!absoluteFilePath.startsWith(safePrefix)) {
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
}
