import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemRequest } from './schemas/system-request.schema';
import { DatabaseBackupJob } from './schemas/database-backup-job.schema';
import { LoginLog } from '../auth/schemas/login-log.schema';
import { User } from '../auth/schemas/user.schema';
import { Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

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

describe('SystemService', () => {
  let service: SystemService;
  let requestModel: any;
  let backupJobModel: any;
  let loginLogModel: any;
  let userModel: any;

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
            },
          },
        },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
    requestModel = module.get(getModelToken(SystemRequest.name));
    backupJobModel = module.get(getModelToken(DatabaseBackupJob.name));
    loginLogModel = module.get(getModelToken(LoginLog.name));
    userModel = module.get(getModelToken(User.name));
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
});


