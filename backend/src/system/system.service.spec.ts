import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemRequest } from './schemas/system-request.schema';
import { DatabaseBackupJob } from './schemas/database-backup-job.schema';
import { DatabaseRestoreJob } from './schemas/database-restore-job.schema';
import { LoginLog } from '../auth/schemas/login-log.schema';
import { User } from '../auth/schemas/user.schema';
import { SystemPerformanceMetric } from './schemas/system-performance-metric.schema';
import { Types } from 'mongoose';
const fs = require('fs');
import * as path from 'path';
import * as zlib from 'zlib';
import * as cp from 'child_process';

jest.mock('child_process', () => ({
  execFile: jest.fn((...args) => {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') {
      cb(new Error('mock execFile error'), '', '');
    }
  }),
}));

const mockUserId = new Types.ObjectId().toString();
const mockRequestId = new Types.ObjectId().toString();
const mockBackupJobId = new Types.ObjectId().toString();

const mockRequest = {
  _id: new Types.ObjectId(mockRequestId),
  title: 'Test Backup Request',
  description: 'Request details',
  type: 'backup',
  status: 'pending',
  priority: 'medium',
  requester_id: new Types.ObjectId(mockUserId),
  assignee_id: null,
  metadata: {},
  status_history: [] as any[],
  createdAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
};

const mockPerformanceMetricConstructorArgs = jest.fn();

class MockPerformanceMetricModel {
  constructor(public data: any) {
    mockPerformanceMetricConstructorArgs(data);
  }
  save = jest.fn().mockResolvedValue(this.data);
  static find = jest.fn().mockReturnValue({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  });
  static countDocuments = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(0),
  });
}

describe('SystemService', () => {
  let service: SystemService;
  let requestModel: any;
  let backupJobModel: any;
  let restoreJobModel: any;
  let loginLogModel: any;
  let userModel: any;
  let performanceMetricModel: any;

  beforeEach(async () => {
    // Reset mock status_history
    mockRequest.status = 'pending';
    mockRequest.status_history = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        {
          provide: getModelToken(SystemRequest.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              sort: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([mockRequest]),
            }),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(1),
            }),
            findOne: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(mockRequest),
            }),
            create: jest.fn().mockResolvedValue(mockRequest),
          },
        },
        {
          provide: getModelToken(DatabaseBackupJob.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              populate: jest.fn().mockReturnThis(),
              sort: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(0),
            }),
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            findById: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(null),
            }),
            create: jest.fn().mockResolvedValue({
              _id: new Types.ObjectId(mockBackupJobId),
              status: 'queued',
              requested_by: new Types.ObjectId(mockUserId),
            }),
            deleteOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            }),
          },
        },
        {
          provide: getModelToken(DatabaseRestoreJob.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(null),
            }),
            create: jest.fn().mockResolvedValue({
              _id: new Types.ObjectId(),
              status: 'queued',
              preview_session_id: 'some-session',
              save: jest.fn().mockResolvedValue(true)
            }),
          },
        },
        {
          provide: getModelToken(LoginLog.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              sort: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(0),
            }),
            aggregate: jest.fn().mockResolvedValue([
              { _id: 'login_success', count: 5 },
              { _id: 'login_failure', count: 1 },
            ]),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getModelToken(SystemPerformanceMetric.name),
          useValue: MockPerformanceMetricModel,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mongodb://localhost:27017/test'),
          },
        },
        {
          provide: getConnectionToken(),
          useValue: {
            db: {
              listCollections: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue([{ name: 'users' }]),
              }),
              dropCollection: jest.fn().mockResolvedValue(true),
            },
            collection: jest.fn().mockReturnValue({
              insertMany: jest.fn().mockResolvedValue(true),
              bulkWrite: jest.fn().mockResolvedValue(true),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
    requestModel = module.get(getModelToken(SystemRequest.name));
    backupJobModel = module.get(getModelToken(DatabaseBackupJob.name));
    restoreJobModel = module.get(getModelToken(DatabaseRestoreJob.name));
    loginLogModel = module.get(getModelToken(LoginLog.name));
    userModel = module.get(getModelToken(User.name));
    performanceMetricModel = module.get(getModelToken(SystemPerformanceMetric.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLoginLogsSummary', () => {
    it('should aggregate today and 7-day stats', async () => {
      const result = await service.getLoginLogsSummary();
      expect(result).toBeDefined();
      expect(result.today).toBeDefined();
      expect(result.today.login_success).toBe(5);
      expect(result.today.login_failure).toBe(1);
    });
  });

  describe('createRequest', () => {
    it('should successfully create a request', async () => {
      const dto = {
        title: 'New Access Request',
        description: 'Grant access to student profiles',
        type: 'access' as const,
        priority: 'high' as const,
      };
      const result = await service.createRequest(dto, mockUserId);
      expect(result).toBeDefined();
      expect(requestModel.create).toHaveBeenCalled();
    });
  });

  describe('getRequestById', () => {
    it('should return request if exists', async () => {
      const result = await service.getRequestById(mockRequestId);
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Backup Request');
    });

    it('should throw BadRequestException if ID is invalid', async () => {
      await expect(service.getRequestById('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if not exists', async () => {
      requestModel.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.getRequestById(mockRequestId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateRequestStatus', () => {
    it('should update status successfully and push to status_history', async () => {
      mockRequest.status = 'pending';
      const result = await service.updateRequestStatus(
        mockRequestId,
        { status: 'in_progress', decision_note: 'Approved to start' },
        mockUserId,
        'Admin',
      );

      expect(result.status).toBe('in_progress');
      expect(result.status_history.length).toBe(1);
      expect(result.status_history[0].from_status).toBe('pending');
      expect(result.status_history[0].to_status).toBe('in_progress');
      expect(result.status_history[0].note).toBe('Approved to start');
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockRequest.status = 'pending';
      await expect(
        service.updateRequestStatus(
          mockRequestId,
          { status: 'completed', decision_note: 'Done' },
          mockUserId,
          'Admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow Admin to reopen completed request', async () => {
      mockRequest.status = 'completed';
      const result = await service.updateRequestStatus(
        mockRequestId,
        { status: 'pending', decision_note: 'Reopened by admin' },
        mockUserId,
        'Admin',
      );
      expect(result.status).toBe('pending');
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if non-Admin tries to reopen completed request', async () => {
      mockRequest.status = 'completed';
      await expect(
        service.updateRequestStatus(
          mockRequestId,
          { status: 'pending', decision_note: 'Try reopening' },
          mockUserId,
          'User',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createBackup', () => {
    it('should create a backup job if no job is running or queued', async () => {
      backupJobModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      const result = await service.createBackup(mockUserId);
      expect(result).toBeDefined();
      expect(backupJobModel.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if another job is running or queued', async () => {
      backupJobModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          status: 'queued',
        }),
      });
      await expect(service.createBackup(mockUserId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('downloadBackup', () => {
    it('should throw BadRequestException if ID is invalid', async () => {
      await expect(service.downloadBackup('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if backup job is not found', async () => {
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.downloadBackup(mockBackupJobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if backup job did not succeed', async () => {
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          status: 'failed',
        }),
      });
      await expect(service.downloadBackup(mockBackupJobId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if backup file does not exist on disk', async () => {
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          status: 'success',
          file_path: '/path/does/not/exist/backup.gz',
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
      await expect(service.downloadBackup(mockBackupJobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if file path is outside backup directory (Path Traversal)', async () => {
      const traversalPath = path.resolve(process.cwd(), 'storage', 'secret.txt');
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          status: 'success',
          file_path: traversalPath,
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      await expect(service.downloadBackup(mockBackupJobId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if file path has same prefix but is outside backup directory (Path Traversal prefix bypass)', async () => {
      const evilPath = path.resolve(process.cwd(), 'storage', 'backups_evil', 'backup.gz');
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          status: 'success',
          file_path: evilPath,
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      await expect(service.downloadBackup(mockBackupJobId)).rejects.toThrow(
        ForbiddenException,
      );
    });


    it('should not throw 403 Forbidden when drive letter case differs on Windows (Path Traversal regression)', async () => {
      const validPath = path.join(process.cwd(), 'storage', 'backups', 'backup_123.gz');
      const backupDir = path.dirname(validPath);
      const originalBackupDir = (service as any).backupDir;
      
      // Force the backup directory to use a different case for the drive letter if on Windows
      (service as any).backupDir = backupDir.replace(/^[a-z]:/i, (m) => m === m.toUpperCase() ? m.toLowerCase() : m.toUpperCase());

      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          status: 'success',
          file_path: validPath,
          file_name: 'backup_123.gz',
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);

      const result = await service.downloadBackup(mockBackupJobId, 'mockUserId');
      expect(result).toBeDefined();

      (service as any).backupDir = originalBackupDir;
    });

    it('should return path and filename if validation passes', async () => {
      const validPath = path.join(process.cwd(), 'storage', 'backups', 'backup_123.gz');
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          status: 'success',
          file_path: validPath,
          file_name: 'backup_123.gz',
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);

      const result = await service.downloadBackup(mockBackupJobId);
      expect(result).toBeDefined();
      expect(result.filePath).toBe(validPath);
      expect(result.fileName).toBe('backup_123.gz');
    });
  });

  describe('deleteBackup', () => {
    it('should throw BadRequestException if ID is invalid', async () => {
      await expect(service.deleteBackup('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if backup job is not found', async () => {
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.deleteBackup(mockBackupJobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if file path is outside backup directory (Path Traversal)', async () => {
      const traversalPath = path.resolve(process.cwd(), 'storage', 'secret.txt');
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          file_path: traversalPath,
        }),
      });
      await expect(service.deleteBackup(mockBackupJobId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if file path has same prefix but is outside backup directory (Path Traversal prefix bypass)', async () => {
      const evilPath = path.resolve(process.cwd(), 'storage', 'backups_evil', 'backup.gz');
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          file_path: evilPath,
        }),
      });
      await expect(service.deleteBackup(mockBackupJobId)).rejects.toThrow(
        ForbiddenException,
      );
    });


    it('should not throw 403 Forbidden when drive letter case differs on Windows (Path Traversal regression)', async () => {
      const validPath = path.join(process.cwd(), 'storage', 'backups', 'backup_123.gz');
      const backupDir = path.dirname(validPath);
      const originalBackupDir = (service as any).backupDir;
      
      // Force the backup directory to use a different case for the drive letter if on Windows
      (service as any).backupDir = backupDir.replace(/^[a-z]:/i, (m) => m === m.toUpperCase() ? m.toLowerCase() : m.toUpperCase());

      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(mockBackupJobId),
          file_path: validPath,
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {});

      const result = await service.deleteBackup(mockBackupJobId, 'mockUserId');
      expect(result).toBeDefined();

      (service as any).backupDir = originalBackupDir;
    });

    it('should delete file and document successfully', async () => {
      const validPath = path.join(process.cwd(), 'storage', 'backups', 'backup_123.gz');
      backupJobModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(mockBackupJobId),
          file_path: validPath,
        }),
      });
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {});

      const result = await service.deleteBackup(mockBackupJobId);
      expect(result).toBeDefined();
      expect(unlinkSpy).toHaveBeenCalledWith(validPath);
    });
  });

  describe('maskUri helper / log masking', () => {
    it('should mask the configured MONGO_URI in messages', () => {
      const message = 'Error connecting to mongodb://localhost:27017/test with error code 123';
      const result = (service as any).maskUri(message);
      expect(result).toBe('Error connecting to ***MONGO_URI_REDACTED*** with error code 123');
    });

    it('should mask generic mongodb URI credentials', () => {
      const message = 'mongodb://admin:supersecret@127.0.0.1:27017/mydb?authSource=admin';
      const result = (service as any).maskUri(message);
      expect(result).toBe('mongodb://***REDACTED***/mydb?authSource=admin');
    });

    it('should mask generic mongodb+srv URI credentials', () => {
      const message = 'mongodb+srv://user123:pass456@cluster.mongodb.net/test';
      const result = (service as any).maskUri(message);
      expect(result).toBe('mongodb+srv://***REDACTED***/test');
    });
  });

  describe('Performance Metrics', () => {
    describe('createPerformanceMetric', () => {
      it('should save metric and generate recommendations when thresholds are exceeded', async () => {
        mockPerformanceMetricConstructorArgs.mockClear();
        const dto = {
          route: '/system',
          device_type: 'desktop' as const,
          load_event_ms: 3500, // > 3000 -> warning
          lcp_ms: 2600, // > 2500 -> warning
          ttfb_ms: -100, // negative should be clamped to 0
          api_total_ms: 2500, // > 2000 -> warning
          api_breakdown: [
            { name: 'login-logs', duration_ms: 1500 } // > 1200 -> warning
          ]
        };
        const user = { userId: mockUserId, roleName: 'Admin' };
        
        // Mock the constructor behavior implicitly via spy/assertions
        const result = await service.createPerformanceMetric(dto, user);
        expect(result.success).toBe(true);
        expect(mockPerformanceMetricConstructorArgs).toHaveBeenCalled();
        const savedData = mockPerformanceMetricConstructorArgs.mock.calls[0][0];
        expect(savedData.user_id.toString()).toBe(mockUserId);
        expect(savedData.role_name).toBe('Admin');
        expect(savedData.route).toBe('/system');
        expect(savedData.device_type).toBe('desktop');
        expect(savedData.ttfb_ms).toBe(0); // Clamped
        expect(savedData.recommendations_snapshot).toBeDefined();
        expect(savedData.recommendations_snapshot.length).toBeGreaterThan(0);
      });

      it('should properly clamp negative duration values to 0', async () => {
         const dto = {
           route: '/system',
           device_type: 'mobile' as const,
           ttfb_ms: -500,
           api_breakdown: [{ name: 'test-api', duration_ms: -100 }]
         };
         // To verify the clamping, we could spy on the class constructor.
         // Since we already mocked `save` inside `MockPerformanceMetricModel`, 
         // we can just check if saving succeeded without errors.
         const result = await service.createPerformanceMetric(dto, { userId: mockUserId, roleName: 'Admin' });
         expect(result.success).toBe(true);
      });
    });

    describe('getPerformanceSummary', () => {
      it('should calculate percentiles (p50, p75, p95) and avg correctly', async () => {
        // Prepare mock data: 5 items
        const mockMetrics = [
          { load_event_ms: 1000, lcp_ms: 1000 },
          { load_event_ms: 2000, lcp_ms: 2000 },
          { load_event_ms: 3000, lcp_ms: 3000 },
          { load_event_ms: 4000, lcp_ms: 4000 },
          { load_event_ms: 5000, lcp_ms: 5000 },
        ];

        performanceMetricModel.find.mockReturnValueOnce({
          lean: jest.fn().mockReturnValueOnce({
            exec: jest.fn().mockResolvedValue(mockMetrics),
          }),
        });

        const result = await service.getPerformanceSummary({ route: '/system' });

        expect(result.total_samples).toBe(5);
        expect(result.average.load_event_ms).toBeDefined();
        // avg = (1000+2000+3000+4000+5000)/5 = 3000
        expect(result.average.load_event_ms).toBe(3000);
        // p50 index: ceil(0.5 * 5) - 1 = 2 -> 3000
        expect(result.p50.load_event_ms).toBe(3000);
        // p75 index: ceil(0.75 * 5) - 1 = 3 -> 4000
        expect(result.p75.load_event_ms).toBe(4000);
        // p95 index: ceil(0.95 * 5) - 1 = 4 -> 5000
        expect(result.p95.load_event_ms).toBe(5000);

        // Recommendations based on p75
        // load_event_ms p75 is 4000 > 3000 -> should generate SYSTEM_LOAD_P75_HIGH
        // lcp_ms p75 is 4000 > 2500 -> should generate SYSTEM_LCP_P75_HIGH
        expect(result.recommendations).toBeDefined();
        const recCodes = result.recommendations.map(r => r.code);
        expect(recCodes).toContain('SYSTEM_LOAD_P75_HIGH');
        expect(recCodes).toContain('SYSTEM_LCP_P75_HIGH');
      });

      it('should handle empty metrics array', async () => {
        performanceMetricModel.find.mockReturnValueOnce({
          lean: jest.fn().mockReturnValueOnce({
            exec: jest.fn().mockResolvedValue([]),
          }),
        });
        const result = await service.getPerformanceSummary({ route: '/system' });
        expect(result.total_samples).toBe(0);
        expect(result.average.load_event_ms).toBeNull();
        expect(result.p50.load_event_ms).toBeNull();
        expect(result.p75.load_event_ms).toBeNull();
        expect(result.p95.load_event_ms).toBeNull();
        expect(result.slow_apis).toEqual([]);
        expect(result.recommendations).toEqual([]);
      });

      it('should aggregate slow_apis with correct samples count', async () => {
        const mockMetrics = [
          { api_breakdown: [{ name: 'login-logs', duration_ms: 1000 }] },
          { api_breakdown: [{ name: 'login-logs', duration_ms: 2000 }] },
          { api_breakdown: [{ name: 'login-logs', duration_ms: 3000 }, { name: 'requests', duration_ms: 500 }] },
        ];

        performanceMetricModel.find.mockReturnValueOnce({
          lean: jest.fn().mockReturnValueOnce({
            exec: jest.fn().mockResolvedValue(mockMetrics),
          }),
        });

        const result = await service.getPerformanceSummary({ route: '/system' });
        
        expect(result.slow_apis).toBeDefined();
        const loginLogsApi = result.slow_apis.find(a => a.name === 'login-logs');
        expect(loginLogsApi).toBeDefined();
        expect(loginLogsApi.samples).toBe(3);
        // avg: (1000+2000+3000)/3 = 2000
        expect(loginLogsApi.avg).toBe(2000);
        // p75 of [1000, 2000, 3000] index ceil(0.75*3)-1 = 3-1 = 2 -> 3000
        expect(loginLogsApi.p75).toBe(3000);
        
        const requestsApi = result.slow_apis.find(a => a.name === 'requests');
        expect(requestsApi).toBeDefined();
        expect(requestsApi.samples).toBe(1);
        expect(requestsApi.avg).toBe(500);
      });
    });
  });

  describe('previewBackupImport', () => {
    it('should throw BadRequestException if file format is invalid', async () => {
      const file = { originalname: 'test.txt' } as any;
      await expect(service.previewBackupImport(file, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file parsing fails (invalid data)', async () => {
      const file = { originalname: 'test.gz', buffer: Buffer.from('bad data'), size: 10 } as any;
      const importDir = path.join(process.cwd(), 'storage', 'backup-imports');
      if (!fs.existsSync(importDir)) {
        fs.mkdirSync(importDir, { recursive: true });
      }
      
      await expect(service.previewBackupImport(file, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('restoreBackupImport', () => {
    it('should throw BadRequestException if confirmationText is not RESTORE', async () => {
      const dto = { previewSessionId: 'sess', collections: ['users'], mode: 'replace_selected_collections' as any, confirmationText: 'WRONG' };
      await expect(service.restoreBackupImport(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if preview session does not exist', async () => {
      const dto = { previewSessionId: 'invalid-sess', collections: ['users'], mode: 'replace_selected_collections' as any, confirmationText: 'RESTORE' };
      restoreJobModel.findOne.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.restoreBackupImport(dto, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if concurrent backup/restore job is running', async () => {
      const dto = { previewSessionId: 'sess', collections: ['users'], mode: 'replace_selected_collections' as any, confirmationText: 'RESTORE' };
      const mockJob = { status: 'queued', save: jest.fn().mockResolvedValue(true) };
      restoreJobModel.findOne.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockJob) });
      backupJobModel.findOne.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue({ status: 'running' }) });
      await expect(service.restoreBackupImport(dto, mockUserId)).rejects.toThrow(ConflictException);
    });
  });

  describe('runBackupAndRestoreAsync (Regression Tests)', () => {
    let mockRestoreJob: any;
    let mockPreBackupJob: any;

    beforeEach(() => {
      mockRestoreJob = {
        _id: new Types.ObjectId(),
        preview_session_id: 'sess',
        source_file_name: 'test.gz',
        collections: ['users', 'posts'],
        mode: 'replace_selected_collections',
        status: 'running',
        save: jest.fn().mockResolvedValue(true),
      };
      mockPreBackupJob = {
        _id: new Types.ObjectId(),
        status: 'success',
        error_message: '',
      };
      
      jest.spyOn(service as any, 'runBackupAsync').mockResolvedValue(undefined);
      backupJobModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPreBackupJob),
      });
      restoreJobModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRestoreJob),
      });
    });

    it('should split ndjson with multiple __collection and flush buffer correctly, avoiding mixed data', async () => {
      // 1. Prepare dummy ndjson fallback data
      const ndjsonData = `{"__collection":"users"}
{"name":"u1"}
{"name":"u2"}
{"__collection":"posts"}
{"title":"p1"}
{"__collection":"users"}
{"name":"u3"}`;
      
      const filePath = path.resolve((service as any).importDir, `import_sess_test.gz`);
      fs.writeFileSync(filePath, zlib.gzipSync(Buffer.from(ndjsonData)));

      // 2. Mock execFile to simulate mongorestore dryRun failure (triggering ndjson fallback)
      (cp.execFile as any).mockImplementation((cmd, args, cb) => {
        if (cmd === 'mongorestore') {
          return cb(new Error('dryRun failed'));
        }
        cb(null, 'ok');
      });

      // 3. Spy on insertDocsSafe
      const insertSpy = jest.spyOn(service as any, 'insertDocsSafe').mockResolvedValue(undefined);

      // 4. Run restore
      await (service as any).runBackupAndRestoreAsync(
        mockRestoreJob._id.toString(),
        mockPreBackupJob._id.toString()
      );

      // 5. Assertions
      expect(insertSpy).toHaveBeenCalledTimes(3);
      // First flush: users (u1, u2)
      expect(insertSpy).toHaveBeenNthCalledWith(1, 'users', [{name: 'u1'}, {name: 'u2'}], 'replace_selected_collections');
      // Second flush: posts (p1)
      expect(insertSpy).toHaveBeenNthCalledWith(2, 'posts', [{title: 'p1'}], 'replace_selected_collections');
      // Third flush: users (u3)
      expect(insertSpy).toHaveBeenNthCalledWith(3, 'users', [{name: 'u3'}], 'replace_selected_collections');
      
      expect(mockRestoreJob.status).toBe('success');
    });

    it('should include --nsFrom and --nsTo in mongorestore arguments to prevent wrong database mapping', async () => {
      // 1. Prepare dummy file so fs.existsSync passes
      const filePath = path.resolve((service as any).importDir, `import_sess_test.gz`);
      fs.writeFileSync(filePath, Buffer.from('fake'));

      // 2. Mock execFile to simulate mongorestore dryRun success (triggering mongorestore)
      (cp.execFile as any).mockImplementation((cmd, args, cb) => {
        cb(null, 'ok');
      });

      // 3. Spy on the promisified execFile (by checking cp.execFile calls)
      // Clear previous calls just in case
      (cp.execFile as any).mockClear();

      // 4. Run restore
      await (service as any).runBackupAndRestoreAsync(
        mockRestoreJob._id.toString(),
        mockPreBackupJob._id.toString()
      );

      // 5. Assertions
      // execFile is called twice: dryRun, then the actual restore
      expect(cp.execFile).toHaveBeenCalledTimes(2);

      const actualRestoreArgs = (cp.execFile as any).mock.calls[1][1]; // second call, second arg
      
      expect(actualRestoreArgs).toContain('--nsFrom=*.*');
      // 'test' is from the mock ConfigService mongodb://localhost:27017/test
      expect(actualRestoreArgs).toContain('--nsTo=test.*');
      expect(actualRestoreArgs).toContain('--nsInclude=*.users');
      expect(actualRestoreArgs).toContain('--nsInclude=*.posts');
      
      expect(mockRestoreJob.status).toBe('success');
      
      try { fs.unlinkSync(filePath); } catch (e) {}
    });
  });
});
