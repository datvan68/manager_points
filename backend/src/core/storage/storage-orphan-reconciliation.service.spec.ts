import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StorageOrphanReconciliationService } from './storage-orphan-reconciliation.service';
import { StorageService } from './storage.service';
import { Activity } from '../../activities/schemas/activity.schema';
import { Invoice } from '../../dormitory/schemas/invoice.schema';
import { RoomFeeInvoice } from '../../dormitory/schemas/room-fee-invoice.schema';
import { UtilityConfig } from '../../dormitory/schemas/utility-config.schema';
import { RoomFeeConfig } from '../../dormitory/schemas/room-fee-config.schema';
import {
  StorageAuditLog,
  StorageReconciliationRun,
  StorageLock,
} from './schemas/storage-audit.schema';

describe('StorageOrphanReconciliationService', () => {
  let service: StorageOrphanReconciliationService;
  let storageServiceMock: any;
  let activityModelMock: any;
  let invoiceModelMock: any;
  let roomFeeInvoiceModelMock: any;
  let utilityConfigModelMock: any;
  let roomFeeConfigModelMock: any;
  let auditLogModelMock: any;
  let reconciliationRunModelMock: any;
  let storageLockModelMock: any;

  beforeEach(async () => {
    storageServiceMock = {
      extractStorageKey: jest.fn((url: string) => {
        if (!url) return null;
        if (url.startsWith('/api/media/public/')) return `public/${url.replace('/api/media/public/', '')}`;
        if (url.startsWith('/api/media/private/')) return `private/${url.replace('/api/media/private/', '')}`;
        if (url.startsWith('/uploads/')) return `public/activities/${url.replace('/uploads/', '')}`;
        return url;
      }),
      listManagedFiles: jest.fn(),
      listQuarantinedFiles: jest.fn().mockResolvedValue([
        {
          asset_id: 'asset-123',
          original_key: 'public/activities/unreferenced-old.png',
          size: 15000,
          sha256: 'hash123',
          quarantined_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        },
      ]),
      quarantineFile: jest.fn(),
      restoreFile: jest.fn(),
      purgeQuarantinedFile: jest.fn(),
      cleanStagingFiles: jest.fn().mockResolvedValue(2),
      getCapacityMetrics: jest.fn().mockResolvedValue({
        status: 'healthy',
        usagePercent: 35,
        usedBytes: 35000000,
        totalBytes: 100000000,
        freeBytes: 65000000,
      }),
      getCapabilities: jest.fn().mockReturnValue({
        canExecuteReconciliation: true,
        canRestore: true,
        canPurge: true,
        quarantineRetentionDays: 30,
      }),
    };

    activityModelMock = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: 'act-1',
                name: 'CLB Tin Học',
                code: 'IT_CLUB',
                logo_url: '/api/media/public/activities/logo1.png',
                cover_url: '/api/media/public/activities/cover1.jpg',
                background_config: {
                  backgroundImageUrl: '/api/media/public/activities/bg1.png',
                  backgroundFrameUrl: '/api/media/public/activities/frame1.png',
                },
              },
            ]),
          }),
        }),
      }),
    };

    invoiceModelMock = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: 'inv-1',
                invoice_code: 'HD-001',
                payment_proof: {
                  url: '/api/media/private/invoices/proofs/proof1.jpg',
                },
              },
            ]),
          }),
        }),
      }),
    };

    roomFeeInvoiceModelMock = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: 'rinv-1',
                invoice_code: 'RF-001',
                payment_proof: {
                  url: '/api/media/private/room-fee-invoices/proofs/proof2.jpg',
                },
              },
            ]),
          }),
        }),
      }),
    };

    utilityConfigModelMock = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: 'ucfg-1',
                transfer_qr_image: {
                  url: '/api/media/public/dormitory-qr/utility-qr.png',
                },
              },
            ]),
          }),
        }),
      }),
    };

    roomFeeConfigModelMock = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: 'rcfg-1',
                transfer_qr_image: {
                  url: '/api/media/public/dormitory-qr/room-fee-qr.png',
                },
              },
            ]),
          }),
        }),
      }),
    };

    auditLogModelMock = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };

    function MockRunModel(this: any, data: any) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    }
    MockRunModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      }),
    });
    reconciliationRunModelMock = MockRunModel;

    storageLockModelMock = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ resource: 'reconciliation' }),
      }),
      create: jest.fn().mockResolvedValue({}),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageOrphanReconciliationService,
        { provide: StorageService, useValue: storageServiceMock },
        { provide: getModelToken(Activity.name), useValue: activityModelMock },
        { provide: getModelToken(Invoice.name), useValue: invoiceModelMock },
        { provide: getModelToken(RoomFeeInvoice.name), useValue: roomFeeInvoiceModelMock },
        { provide: getModelToken(UtilityConfig.name), useValue: utilityConfigModelMock },
        { provide: getModelToken(RoomFeeConfig.name), useValue: roomFeeConfigModelMock },
        { provide: getModelToken(StorageAuditLog.name), useValue: auditLogModelMock },
        { provide: getModelToken(StorageReconciliationRun.name), useValue: reconciliationRunModelMock },
        { provide: getModelToken(StorageLock.name), useValue: storageLockModelMock },
      ],
    }).compile();

    service = module.get<StorageOrphanReconciliationService>(StorageOrphanReconciliationService);
  });

  describe('collectDatabaseReferences', () => {
    it('should extract all 8 reference fields from 5 models correctly', async () => {
      const refMap = await service.collectDatabaseReferences();

      expect(refMap.has('public/activities/logo1.png')).toBe(true);
      expect(refMap.has('public/activities/cover1.jpg')).toBe(true);
      expect(refMap.has('public/activities/bg1.png')).toBe(true);
      expect(refMap.has('public/activities/frame1.png')).toBe(true);
      expect(refMap.has('private/invoices/proofs/proof1.jpg')).toBe(true);
      expect(refMap.has('private/room-fee-invoices/proofs/proof2.jpg')).toBe(true);
      expect(refMap.has('public/dormitory-qr/utility-qr.png')).toBe(true);
      expect(refMap.has('public/dormitory-qr/room-fee-qr.png')).toBe(true);
    });
  });

  describe('runReconciliation & Distributed Locking', () => {
    it('preview mode: should scan without moving files and respect 24h grace period for new files', async () => {
      const now = Date.now();
      const freshMtime = new Date(now - 2 * 60 * 60 * 1000); // 2 hours old (< 24h) -> staged
      const oldMtime = new Date(now - 30 * 60 * 60 * 1000); // 30 hours old (> 24h) -> orphan candidate

      storageServiceMock.listManagedFiles.mockResolvedValue([
        {
          key: 'public/activities/logo1.png',
          filename: 'logo1.png',
          size: 5000,
          mime_type: 'image/png',
          mtime: oldMtime,
          ctime: oldMtime,
          visibility: 'public',
          namespace: 'activities',
        },
        {
          key: 'public/activities/fresh-unreferenced.png',
          filename: 'fresh-unreferenced.png',
          size: 12000,
          mime_type: 'image/png',
          mtime: freshMtime,
          ctime: freshMtime,
          visibility: 'public',
          namespace: 'activities',
        },
        {
          key: 'public/activities/old-unreferenced.png',
          filename: 'old-unreferenced.png',
          size: 25000,
          mime_type: 'image/png',
          mtime: oldMtime,
          ctime: oldMtime,
          visibility: 'public',
          namespace: 'activities',
        },
      ]);

      const result = await service.runReconciliation('preview', 'admin@example.com');

      expect(result.mode).toBe('preview');
      expect(result.scanned_files_count).toBe(3);
      expect(result.referenced_files_count).toBe(1);
      expect(result.orphan_files_count).toBe(1);
      expect(result.orphans[0].key).toBe('public/activities/old-unreferenced.png');
      expect(result.quarantined_count).toBe(0);
      expect(storageServiceMock.quarantineFile).not.toHaveBeenCalled();
      expect(auditLogModelMock.create).toHaveBeenCalled();
    });

    it('execute mode: should quarantine confirmed orphans and leave fresh staged files untouched', async () => {
      const now = Date.now();
      const freshMtime = new Date(now - 1 * 60 * 60 * 1000);
      const oldMtime = new Date(now - 48 * 60 * 60 * 1000);

      storageServiceMock.listManagedFiles.mockResolvedValue([
        {
          key: 'public/activities/logo1.png',
          filename: 'logo1.png',
          size: 5000,
          mime_type: 'image/png',
          mtime: oldMtime,
          ctime: oldMtime,
          visibility: 'public',
          namespace: 'activities',
        },
        {
          key: 'public/activities/fresh-unreferenced.png',
          filename: 'fresh-unreferenced.png',
          size: 12000,
          mime_type: 'image/png',
          mtime: freshMtime,
          ctime: freshMtime,
          visibility: 'public',
          namespace: 'activities',
        },
        {
          key: 'public/activities/old-unreferenced.png',
          filename: 'old-unreferenced.png',
          size: 25000,
          mime_type: 'image/png',
          mtime: oldMtime,
          ctime: oldMtime,
          visibility: 'public',
          namespace: 'activities',
        },
      ]);

      storageServiceMock.quarantineFile.mockResolvedValue({
        asset_id: 'asset-123',
        original_key: 'public/activities/old-unreferenced.png',
        quarantine_key: '.quarantine/asset-123.png',
        size: 25000,
        mime_type: 'image/png',
        sha256: 'abc123hash',
        quarantined_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        actor: 'admin@example.com',
        reason: 'reconciliation_orphan_run',
      });

      const result = await service.runReconciliation('execute', 'admin@example.com');

      expect(result.mode).toBe('execute');
      expect(result.orphan_files_count).toBe(1);
      expect(result.quarantined_count).toBe(1);
      expect(storageServiceMock.quarantineFile).toHaveBeenCalledTimes(1);
      expect(storageServiceMock.quarantineFile).toHaveBeenCalledWith(
        'public/activities/old-unreferenced.png',
        expect.stringContaining('reconciliation_orphan_run'),
        'admin@example.com',
      );
    });

    it('should throw ConflictException if cross-instance lock is held by another active process', async () => {
      // Active lock with future lease expiry
      storageLockModelMock.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          resource: 'reconciliation',
          owner: 'another-worker',
          lease_expires_at: new Date(Date.now() + 10 * 60 * 1000), // active
        }),
      });

      await expect(service.runReconciliation('preview')).rejects.toThrow(ConflictException);
    });

    it('should recover and take over stale lease when previous run crashed/expired', async () => {
      // Stale lock with past lease expiry
      storageLockModelMock.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          resource: 'reconciliation',
          owner: 'crashed-worker',
          lease_expires_at: new Date(Date.now() - 10 * 60 * 1000), // expired
        }),
      });
      storageLockModelMock.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          resource: 'reconciliation',
          owner: 'new-worker',
        }),
      });
      storageServiceMock.listManagedFiles.mockResolvedValue([]);

      const result = await service.runReconciliation('preview', 'new-worker');
      expect(result.run_id).toBeDefined();
      expect(storageLockModelMock.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should handle partial failure and record partial status when an item fails to quarantine', async () => {
      const now = Date.now();
      const oldMtime = new Date(now - 48 * 60 * 60 * 1000);

      storageServiceMock.listManagedFiles.mockResolvedValue([
        {
          key: 'public/activities/orphan1.png',
          filename: 'orphan1.png',
          size: 1000,
          mime_type: 'image/png',
          mtime: oldMtime,
          ctime: oldMtime,
          visibility: 'public',
          namespace: 'activities',
        },
        {
          key: 'public/activities/orphan2.png',
          filename: 'orphan2.png',
          size: 2000,
          mime_type: 'image/png',
          mtime: oldMtime,
          ctime: oldMtime,
          visibility: 'public',
          namespace: 'activities',
        },
      ]);

      // 1st succeeds, 2nd throws filesystem error
      storageServiceMock.quarantineFile
        .mockResolvedValueOnce({
          asset_id: 'asset-1',
          original_key: 'public/activities/orphan1.png',
          quarantine_key: '.quarantine/asset-1.png',
          size: 1000,
          sha256: 'hash1',
          quarantined_at: new Date(),
          expires_at: new Date(),
        })
        .mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const result = await service.runReconciliation('execute', 'admin@example.com');
      expect(result.quarantined_count).toBe(1);
      expect(auditLogModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'partial',
          details: expect.objectContaining({
            failed_quarantine_count: 1,
            quarantined_count: 1,
          }),
        }),
      );
    });
  });

  describe('restoreAsset and purgeAsset', () => {
    it('restoreAsset should restore file and record audit log', async () => {
      storageServiceMock.restoreFile.mockResolvedValue({
        asset_id: 'asset-123',
        original_key: 'public/activities/restored.png',
        size: 15000,
        sha256: 'hash123',
      });

      const res = await service.restoreAsset('asset-123', 'admin@example.com');
      expect(res.asset_id).toBe('asset-123');
      expect(storageServiceMock.restoreFile).toHaveBeenCalledWith('asset-123', 'admin@example.com');
      expect(auditLogModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'restore',
          actor: 'admin@example.com',
        }),
      );
    });

    it('purgeAsset should purge file when zero referenced and record audit log', async () => {
      storageServiceMock.purgeQuarantinedFile.mockResolvedValue({
        asset_id: 'asset-123',
        original_key: 'public/activities/unreferenced-old.png',
        size: 15000,
        sha256: 'hash123',
      });

      const res = await service.purgeAsset('asset-123', 'admin@example.com', true);
      expect(res.asset_id).toBe('asset-123');
      expect(storageServiceMock.purgeQuarantinedFile).toHaveBeenCalledWith('asset-123', true);
      expect(auditLogModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'purge',
          actor: 'admin@example.com',
        }),
      );
    });

    it('purgeAsset should throw ConflictException if asset is currently referenced in DB', async () => {
      storageServiceMock.listQuarantinedFiles.mockResolvedValue([
        {
          asset_id: 'referenced-asset',
          original_key: 'public/activities/logo1.png', // referenced in act-1
          size: 5000,
        },
      ]);

      await expect(service.purgeAsset('referenced-asset', 'admin@example.com')).rejects.toThrow(
        ConflictException,
      );
      expect(storageServiceMock.purgeQuarantinedFile).not.toHaveBeenCalled();
    });

    it('purgeAsset should throw NotFoundException if asset manifest does not exist', async () => {
      storageServiceMock.listQuarantinedFiles.mockResolvedValue([]);
      await expect(service.purgeAsset('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
