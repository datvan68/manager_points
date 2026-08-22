import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { StorageAdminController } from './storage-admin.controller';
import { StorageOrphanReconciliationService } from './storage-orphan-reconciliation.service';
import {
  StorageInventoryQueryDto,
  StorageAuditLogQueryDto,
  StorageAssetParamDto,
  StoragePurgeDto,
} from './dto/storage-admin.dto';

describe('StorageAdminController', () => {
  let controller: StorageAdminController;
  let reconciliationServiceMock: any;

  beforeEach(async () => {
    reconciliationServiceMock = {
      getSummary: jest.fn().mockResolvedValue({
        capacity: { status: 'normal', usagePercent: 20 },
        capabilities: {
          canExecuteReconciliation: false,
          canRestore: false,
          canPurge: false,
          quarantineRetentionDays: 30,
        },
        live_files_count: 10,
      }),
      getInventory: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      runReconciliation: jest.fn().mockResolvedValue({
        run_id: 'test-run-123',
        mode: 'preview',
        orphan_files_count: 0,
      }),
      restoreAsset: jest.fn().mockResolvedValue({
        asset_id: 'asset-123',
        original_key: 'public/activities/logo.png',
      }),
      purgeAsset: jest.fn().mockResolvedValue({
        message: 'Đã xóa vĩnh viễn tệp tin khỏi vùng cách ly',
        asset_id: 'asset-123',
      }),
      getAuditLogs: jest.fn().mockResolvedValue([]),
      getCapabilities: jest.fn().mockReturnValue({
        canExecuteReconciliation: false,
        canRestore: false,
        canPurge: false,
        quarantineRetentionDays: 30,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageAdminController],
      providers: [
        {
          provide: StorageOrphanReconciliationService,
          useValue: reconciliationServiceMock,
        },
      ],
    }).compile();

    controller = module.get<StorageAdminController>(StorageAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return storage summary and capabilities', async () => {
      const result = await controller.getSummary();
      expect(result.live_files_count).toBe(10);
      expect(reconciliationServiceMock.getSummary).toHaveBeenCalled();
    });
  });

  describe('getInventory', () => {
    it('should pass DTO query parameters to reconciliation service', async () => {
      const query: StorageInventoryQueryDto = {
        page: 2,
        limit: 15,
        status: 'active',
        domain: 'activities',
        namespace: 'activities',
        search: 'club',
      };

      await controller.getInventory(query);
      expect(reconciliationServiceMock.getInventory).toHaveBeenCalledWith(query);
    });
  });

  describe('previewReconciliation', () => {
    it('should allow preview reconciliation by default', async () => {
      const req = { user: { email: 'admin@system.local' } };
      const res = await controller.previewReconciliation(req);
      expect(res.run_id).toBe('test-run-123');
      expect(reconciliationServiceMock.runReconciliation).toHaveBeenCalledWith(
        'preview',
        'admin@system.local',
      );
    });
  });

  describe('executeReconciliation capability gating', () => {
    it('should throw ForbiddenException when execute capability is disabled', async () => {
      reconciliationServiceMock.getCapabilities.mockReturnValue({
        canExecuteReconciliation: false,
        canRestore: false,
        canPurge: false,
        quarantineRetentionDays: 30,
      });

      const req = { user: { email: 'admin@system.local' } };
      await expect(controller.executeReconciliation(req)).rejects.toThrow(ForbiddenException);
      expect(reconciliationServiceMock.runReconciliation).not.toHaveBeenCalled();
    });

    it('should execute reconciliation when capability is explicitly enabled', async () => {
      reconciliationServiceMock.getCapabilities.mockReturnValue({
        canExecuteReconciliation: true,
        canRestore: false,
        canPurge: false,
        quarantineRetentionDays: 30,
      });
      reconciliationServiceMock.runReconciliation.mockResolvedValue({
        run_id: 'exec-run-123',
        mode: 'execute',
        quarantined_count: 2,
      });

      const req = { user: { email: 'admin@system.local' } };
      const res = await controller.executeReconciliation(req);
      expect(res.run_id).toBe('exec-run-123');
      expect(reconciliationServiceMock.runReconciliation).toHaveBeenCalledWith(
        'execute',
        'admin@system.local',
      );
    });
  });

  describe('restoreAsset capability gating', () => {
    it('should throw ForbiddenException when restore capability is disabled', async () => {
      reconciliationServiceMock.getCapabilities.mockReturnValue({
        canExecuteReconciliation: false,
        canRestore: false,
        canPurge: false,
        quarantineRetentionDays: 30,
      });

      const params: StorageAssetParamDto = { assetId: 'asset-123' };
      const req = { user: { email: 'admin@system.local' } };
      await expect(controller.restoreAsset(params, req)).rejects.toThrow(ForbiddenException);
      expect(reconciliationServiceMock.restoreAsset).not.toHaveBeenCalled();
    });

    it('should restore asset when restore capability is enabled', async () => {
      reconciliationServiceMock.getCapabilities.mockReturnValue({
        canExecuteReconciliation: false,
        canRestore: true,
        canPurge: false,
        quarantineRetentionDays: 30,
      });

      const params: StorageAssetParamDto = { assetId: 'asset-123' };
      const req = { user: { email: 'admin@system.local' } };
      const res = await controller.restoreAsset(params, req);
      expect(res.asset_id).toBe('asset-123');
      expect(reconciliationServiceMock.restoreAsset).toHaveBeenCalledWith(
        'asset-123',
        'admin@system.local',
      );
    });
  });

  describe('purgeAsset capability gating', () => {
    it('should throw ForbiddenException when purge capability is disabled', async () => {
      reconciliationServiceMock.getCapabilities.mockReturnValue({
        canExecuteReconciliation: false,
        canRestore: false,
        canPurge: false,
        quarantineRetentionDays: 30,
      });

      const params: StorageAssetParamDto = { assetId: 'asset-123' };
      const body: StoragePurgeDto = { confirmationToken: 'CONFIRM' };
      const req = { user: { email: 'admin@system.local' } };
      await expect(controller.purgeAsset(params, body, req)).rejects.toThrow(ForbiddenException);
      expect(reconciliationServiceMock.purgeAsset).not.toHaveBeenCalled();
    });

    it('should purge asset when purge capability is enabled', async () => {
      reconciliationServiceMock.getCapabilities.mockReturnValue({
        canExecuteReconciliation: false,
        canRestore: false,
        canPurge: true,
        quarantineRetentionDays: 30,
      });

      const params: StorageAssetParamDto = { assetId: 'asset-123' };
      const body: StoragePurgeDto = { confirmationToken: 'CONFIRM' };
      const req = { user: { email: 'admin@system.local' } };
      const res = await controller.purgeAsset(params, body, req);
      expect(res.asset_id).toBe('asset-123');
      expect(reconciliationServiceMock.purgeAsset).toHaveBeenCalledWith(
        'asset-123',
        'admin@system.local',
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should pass query limit to getAuditLogs', async () => {
      const query: StorageAuditLogQueryDto = { limit: 25 };
      await controller.getAuditLogs(query);
      expect(reconciliationServiceMock.getAuditLogs).toHaveBeenCalledWith(25);
    });
  });
});
