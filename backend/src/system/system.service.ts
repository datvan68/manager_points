import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { SystemRequest, SystemRequestDocument } from './schemas/system-request.schema';
import { DatabaseBackupJob, DatabaseBackupJobDocument } from './schemas/database-backup-job.schema';
import { LoginLog, LoginLogDocument } from '../auth/schemas/login-log.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { SystemPerformanceMetric, SystemPerformanceMetricDocument } from './schemas/system-performance-metric.schema';
import { GetLoginLogsQueryDto, CreateSystemRequestDto, UpdateSystemRequestDto, UpdateSystemRequestStatusDto, GetSystemRequestsQueryDto, GetBackupsQueryDto, CreateSystemPerformanceMetricDto, GetPerformanceSummaryQueryDto, GetPerformanceMetricsQueryDto } from './dto/system.dto';
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
    @InjectModel(SystemPerformanceMetric.name) private performanceMetricModel: Model<SystemPerformanceMetricDocument>,
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
}
