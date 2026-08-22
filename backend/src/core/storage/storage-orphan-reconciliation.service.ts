import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import {
  StorageService,
  DEFAULT_UNATTACHED_GRACE_HOURS,
} from './storage.service';
import {
  AssetLifecycleState,
  ReconciliationResult,
  StorageCapabilities,
  StorageInventoryItem,
  StorageNamespace,
  StorageSummaryMetrics,
} from './storage.interface';
import {
  StorageAuditLog,
  StorageAuditLogDocument,
  StorageReconciliationRun,
  StorageReconciliationRunDocument,
  StorageLock,
  StorageLockDocument,
} from './schemas/storage-audit.schema';
import {
  Activity,
  ActivityDocument,
} from '../../activities/schemas/activity.schema';
import {
  Invoice,
  InvoiceDocument,
} from '../../dormitory/schemas/invoice.schema';
import {
  RoomFeeInvoice,
  RoomFeeInvoiceDocument,
} from '../../dormitory/schemas/room-fee-invoice.schema';
import {
  UtilityConfig,
  UtilityConfigDocument,
} from '../../dormitory/schemas/utility-config.schema';
import {
  RoomFeeConfig,
  RoomFeeConfigDocument,
} from '../../dormitory/schemas/room-fee-config.schema';

interface DomainReference {
  domain: 'activities' | 'dormitory';
  owner_id: string;
  field: string;
  display_title?: string;
}

@Injectable()
export class StorageOrphanReconciliationService {
  private readonly logger = new Logger(StorageOrphanReconciliationService.name);
  private isReconciling = false;

  constructor(
    private readonly storageService: StorageService,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(RoomFeeInvoice.name)
    private readonly roomFeeInvoiceModel: Model<RoomFeeInvoiceDocument>,
    @InjectModel(UtilityConfig.name)
    private readonly utilityConfigModel: Model<UtilityConfigDocument>,
    @InjectModel(RoomFeeConfig.name)
    private readonly roomFeeConfigModel: Model<RoomFeeConfigDocument>,
    @InjectModel(StorageAuditLog.name)
    private readonly auditLogModel: Model<StorageAuditLogDocument>,
    @InjectModel(StorageReconciliationRun.name)
    private readonly reconciliationRunModel: Model<StorageReconciliationRunDocument>,
    @InjectModel(StorageLock.name)
    private readonly storageLockModel: Model<StorageLockDocument>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleNightlyReconciliation() {
    this.logger.log('Bắt đầu tiến trình kiểm tra & dọn dẹp lưu trữ định kỳ...');

    try {
      // 1. Clean old staging files older than 1 hour
      const stagingCleaned = await this.storageService.cleanStagingFiles(
        60 * 60 * 1000,
      );

      // 2. Read capacity metrics
      const capacity = await this.storageService.getCapacityMetrics();

      this.logger.log(
        `Dọn dẹp lưu trữ hoàn tất. Staging đã xóa: ${stagingCleaned}. Dung lượng sử dụng: ${capacity.usagePercent}%. Trạng thái: ${capacity.status.toUpperCase()}`,
      );

      if (capacity.status === 'warning') {
        this.logger.warn(
          `CẢNH BÁO: Dung lượng lưu trữ đã vượt ngưỡng 85%! (${capacity.usagePercent}%)`,
        );
      } else if (capacity.status === 'critical') {
        this.logger.error(
          `BÁO ĐỘNG ĐỎ: Dung lượng lưu trữ đã vượt ngưỡng 95%! (${capacity.usagePercent}%)`,
        );
      }

      // Record nightly audit log
      await this.auditLogModel.create({
        run_id: crypto.randomUUID(),
        action: 'preview',
        actor: 'cron_scheduler',
        mode: 'scheduled',
        status: 'success',
        details: {
          staging_cleaned: stagingCleaned,
          capacity_status: capacity.status,
          usage_percent: capacity.usagePercent,
        },
      });
    } catch (err) {
      this.logger.error(
        `Lỗi trong quá trình kiểm tra lưu trữ định kỳ: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Helper to collect all verified image references across the 5 Mongo collections
   */
  async collectDatabaseReferences(): Promise<Map<string, DomainReference[]>> {
    const refMap = new Map<string, DomainReference[]>();

    const addRef = (
      rawUrl: string | undefined | null,
      ref: DomainReference,
    ) => {
      if (!rawUrl || typeof rawUrl !== 'string') return;
      const trimmed = rawUrl.trim();
      if (!trimmed) return;

      // Ignore external absolute URLs that do not point to local server media routes
      if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('/api/media/')) {
        return;
      }

      const normalizedKey = this.storageService.extractStorageKey(trimmed);
      if (!normalizedKey) return;

      // Must be inside allowed namespace paths
      if (
        !normalizedKey.startsWith('public/activities/') &&
        !normalizedKey.startsWith('public/dormitory-qr/') &&
        !normalizedKey.startsWith('private/invoices/') &&
        !normalizedKey.startsWith('private/room-fee-invoices/')
      ) {
        return;
      }

      const existing = refMap.get(normalizedKey) || [];
      existing.push(ref);
      refMap.set(normalizedKey, existing);
    };

    // 1. Activities (all activities including inactive to preserve media)
    const activities = await this.activityModel
      .find({})
      .select('name code logo_url cover_url background_config settings')
      .lean()
      .exec();

    for (const act of activities) {
      const actId = String(act._id);
      const title = act.name || act.code || actId;

      addRef(act.logo_url, {
        domain: 'activities',
        owner_id: actId,
        field: 'logo_url',
        display_title: title,
      });

      addRef(act.cover_url, {
        domain: 'activities',
        owner_id: actId,
        field: 'cover_url',
        display_title: title,
      });

      if (act.background_config?.backgroundImageUrl) {
        addRef(act.background_config.backgroundImageUrl, {
          domain: 'activities',
          owner_id: actId,
          field: 'background_config.backgroundImageUrl',
          display_title: title,
        });
      }

      if (act.background_config?.backgroundFrameUrl) {
        addRef(act.background_config.backgroundFrameUrl, {
          domain: 'activities',
          owner_id: actId,
          field: 'background_config.backgroundFrameUrl',
          display_title: title,
        });
      }

      const settingsBackground = (act.settings as any)?.background;
      if (settingsBackground?.backgroundImageUrl) {
        addRef(settingsBackground.backgroundImageUrl, {
          domain: 'activities',
          owner_id: actId,
          field: 'settings.background.backgroundImageUrl',
          display_title: title,
        });
      }
      if (settingsBackground?.backgroundFrameUrl) {
        addRef(settingsBackground.backgroundFrameUrl, {
          domain: 'activities',
          owner_id: actId,
          field: 'settings.background.backgroundFrameUrl',
          display_title: title,
        });
      }
    }

    // 2. Utility Invoices
    const invoices = await this.invoiceModel
      .find({ 'payment_proof.url': { $exists: true, $ne: null } })
      .select('invoice_code payment_proof')
      .lean()
      .exec();

    for (const inv of invoices) {
      const invId = String(inv._id);
      addRef(inv.payment_proof?.url, {
        domain: 'dormitory',
        owner_id: invId,
        field: 'invoice.payment_proof',
        display_title: inv.invoice_code || invId,
      });
    }

    // 3. Room Fee Invoices
    const roomFeeInvoices = await this.roomFeeInvoiceModel
      .find({ 'payment_proof.url': { $exists: true, $ne: null } })
      .select('invoice_code payment_proof')
      .lean()
      .exec();

    for (const rInv of roomFeeInvoices) {
      const rInvId = String(rInv._id);
      addRef(rInv.payment_proof?.url, {
        domain: 'dormitory',
        owner_id: rInvId,
        field: 'room_fee_invoice.payment_proof',
        display_title: rInv.invoice_code || rInvId,
      });
    }

    // 4. Utility Config
    const utilityConfigs = await this.utilityConfigModel
      .find({ 'transfer_qr_image.url': { $exists: true, $ne: null } })
      .select('transfer_qr_image')
      .lean()
      .exec();

    for (const uCfg of utilityConfigs) {
      addRef(uCfg.transfer_qr_image?.url, {
        domain: 'dormitory',
        owner_id: String(uCfg._id),
        field: 'utility_config.transfer_qr_image',
        display_title: 'Cấu hình QR Điện Nước',
      });
    }

    // 5. Room Fee Config
    const roomFeeConfigs = await this.roomFeeConfigModel
      .find({ 'transfer_qr_image.url': { $exists: true, $ne: null } })
      .select('transfer_qr_image')
      .lean()
      .exec();

    for (const rCfg of roomFeeConfigs) {
      addRef(rCfg.transfer_qr_image?.url, {
        domain: 'dormitory',
        owner_id: String(rCfg._id),
        field: 'room_fee_config.transfer_qr_image',
        display_title: 'Cấu hình QR Phí Phòng',
      });
    }

    return refMap;
  }

  getCapabilities(): StorageCapabilities {
    return this.storageService.getCapabilities();
  }

  /**
   * Distributed lease lock via MongoDB to prevent cross-instance concurrent reconciliation runs
   */
  async acquireReconciliationLock(
    runId: string,
    actor: string,
    leaseDurationMs = 15 * 60 * 1000,
  ): Promise<boolean> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

    try {
      const existing = await this.storageLockModel
        .findOne({ resource: 'reconciliation' })
        .exec();
      if (existing) {
        if (existing.lease_expires_at > now) {
          return false; // Active lock held
        }
        // Stale lease: take over
        const updated = await this.storageLockModel
          .findOneAndUpdate(
            {
              resource: 'reconciliation',
              lease_expires_at: existing.lease_expires_at,
            },
            {
              $set: {
                owner: actor,
                run_id: runId,
                lease_expires_at: leaseExpiresAt,
              },
            },
            { new: true },
          )
          .exec();
        return Boolean(updated);
      } else {
        await this.storageLockModel.create({
          resource: 'reconciliation',
          owner: actor,
          run_id: runId,
          lease_expires_at: leaseExpiresAt,
        });
        return true;
      }
    } catch {
      return false;
    }
  }

  async releaseReconciliationLock(runId: string): Promise<void> {
    try {
      await this.storageLockModel
        .deleteOne({ resource: 'reconciliation', run_id: runId })
        .exec();
    } catch (err) {
      this.logger.warn(
        `Lỗi khi giải phóng khóa đối soát: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Performs storage reconciliation (either preview or execute mode)
   */
  async runReconciliation(
    mode: 'preview' | 'execute',
    actor = 'system',
  ): Promise<ReconciliationResult> {
    if (this.isReconciling) {
      throw new ConflictException(
        'Một tiến trình đối soát lưu trữ đang chạy. Vui lòng chờ hoàn tất.',
      );
    }

    const runId = crypto.randomUUID();
    const lockAcquired = await this.acquireReconciliationLock(runId, actor);
    if (!lockAcquired) {
      throw new ConflictException(
        'Một tiến trình đối soát lưu trữ đang chạy trên hệ thống (Cross-Instance Lock). Vui lòng chờ hoàn tất.',
      );
    }

    this.isReconciling = true;
    const startedAt = new Date();

    const runRecord = new this.reconciliationRunModel({
      run_id: runId,
      status: 'running',
      mode,
      actor,
      started_at: startedAt,
    });
    await runRecord.save();

    try {
      // 1. Collect DB references
      const refMap = await this.collectDatabaseReferences();

      // 2. Scan managed filesystem files
      const managedFiles = await this.storageService.listManagedFiles();
      const existingKeysSet = new Set(managedFiles.map((f) => f.key));

      let scannedBytes = 0;
      let referencedCount = 0;
      const orphanCandidates: Array<{
        id: string;
        key: string;
        size: number;
        mtime: Date;
      }> = [];
      const missingList: Array<{
        key: string;
        domain: string;
        owner_id: string;
        field: string;
      }> = [];

      const now = Date.now();
      const graceMs = DEFAULT_UNATTACHED_GRACE_HOURS * 60 * 60 * 1000;

      for (const file of managedFiles) {
        scannedBytes += file.size;
        const refs = refMap.get(file.key);

        if (refs && refs.length > 0) {
          referencedCount++;
        } else {
          // File on disk has NO db reference
          const age = now - file.mtime.getTime();
          if (age >= graceMs) {
            // Confirmed orphan candidate
            orphanCandidates.push({
              id: crypto.createHash('sha1').update(file.key).digest('hex'),
              key: file.key,
              size: file.size,
              mtime: file.mtime,
            });
          }
          // If age < graceMs, file is staged (protected)
        }
      }

      // Check missing references (in DB but not on disk)
      for (const [refKey, refs] of refMap.entries()) {
        if (!existingKeysSet.has(refKey)) {
          for (const r of refs) {
            missingList.push({
              key: refKey,
              domain: r.domain,
              owner_id: r.owner_id,
              field: r.field,
            });
          }
        }
      }

      let quarantinedCount = 0;
      let quarantinedBytes = 0;
      let failedQuarantineCount = 0;

      // 3. If execute mode, move orphan candidates to quarantine with TOCTOU check
      if (mode === 'execute') {
        for (const orphan of orphanCandidates) {
          // Recheck DB references immediately before moving file
          const freshRefMap = await this.collectDatabaseReferences();
          const freshRefs = freshRefMap.get(orphan.key);
          if (freshRefs && freshRefs.length > 0) {
            this.logger.warn(
              `Bỏ qua cách ly ${orphan.key} do vừa phát sinh tham chiếu mới trong DB.`,
            );
            continue;
          }

          try {
            await this.storageService.quarantineFile(
              orphan.key,
              `reconciliation_orphan_run_${runId}`,
              actor,
            );
            quarantinedCount++;
            quarantinedBytes += orphan.size;
          } catch (qErr) {
            failedQuarantineCount++;
            this.logger.warn(
              `Không thể cách ly ${orphan.key}: ${(qErr as Error).message}`,
            );
          }
        }
      }

      const completedAt = new Date();
      let runStatus: 'completed' | 'partial' | 'failed' = 'completed';
      if (mode === 'execute' && failedQuarantineCount > 0) {
        runStatus = quarantinedCount > 0 ? 'partial' : 'failed';
      }

      // Update run record
      runRecord.status = runStatus;
      runRecord.scanned_files_count = managedFiles.length;
      runRecord.scanned_bytes = scannedBytes;
      runRecord.referenced_files_count = referencedCount;
      runRecord.orphan_files_count = orphanCandidates.length;
      runRecord.missing_references_count = missingList.length;
      runRecord.quarantined_files_count = quarantinedCount;
      runRecord.quarantined_bytes = quarantinedBytes;
      runRecord.completed_at = completedAt;
      await runRecord.save();

      // Write audit log
      await this.auditLogModel.create({
        run_id: runId,
        action: mode === 'execute' ? 'quarantine' : 'preview',
        actor,
        mode: 'manual',
        status: runStatus === 'completed' ? 'success' : runStatus,
        details: {
          mode,
          scanned_files_count: managedFiles.length,
          scanned_bytes: scannedBytes,
          referenced_files_count: referencedCount,
          orphan_candidates_count: orphanCandidates.length,
          missing_references_count: missingList.length,
          quarantined_count: quarantinedCount,
          quarantined_bytes: quarantinedBytes,
          failed_quarantine_count: failedQuarantineCount,
        },
      });

      return {
        run_id: runId,
        mode,
        scanned_files_count: managedFiles.length,
        scanned_bytes: scannedBytes,
        referenced_files_count: referencedCount,
        orphan_files_count: orphanCandidates.length,
        missing_references_count: missingList.length,
        quarantined_count: quarantinedCount,
        quarantined_bytes: quarantinedBytes,
        orphans: orphanCandidates,
        missing: missingList,
        created_at: completedAt,
      };
    } catch (err) {
      runRecord.status = 'failed';
      runRecord.error = (err as Error).message;
      runRecord.completed_at = new Date();
      await runRecord.save();

      await this.auditLogModel.create({
        run_id: runId,
        action: mode === 'execute' ? 'quarantine' : 'preview',
        actor,
        mode: 'manual',
        status: 'failed',
        details: { error_category: 'RECONCILIATION_EXECUTION_FAILURE' },
      });

      throw err;
    } finally {
      this.isReconciling = false;
      await this.releaseReconciliationLock(runId);
    }
  }

  /**
   * Retrieves summary metrics for Admin dashboard
   */
  async getSummary(): Promise<StorageSummaryMetrics> {
    const capacity = await this.storageService.getCapacityMetrics();
    const capabilities = this.getCapabilities();
    const managedFiles = await this.storageService.listManagedFiles();
    const quarantinedFiles = await this.storageService.listQuarantinedFiles();

    let liveBytes = 0;
    for (const f of managedFiles) {
      liveBytes += f.size;
    }

    let quarantinedBytes = 0;
    let reclaimableBytes = 0;
    let reclaimableCount = 0;

    for (const q of quarantinedFiles) {
      quarantinedBytes += q.size;
      if (q.is_purge_eligible) {
        reclaimableCount++;
        reclaimableBytes += q.size;
      }
    }

    const lastRun = await this.reconciliationRunModel
      .findOne({})
      .sort({ started_at: -1 })
      .lean()
      .exec();

    return {
      capacity,
      capabilities,
      live_files_count: managedFiles.length,
      live_bytes: liveBytes,
      quarantined_files_count: quarantinedFiles.length,
      quarantined_bytes: quarantinedBytes,
      reclaimable_files_count: reclaimableCount,
      reclaimable_bytes: reclaimableBytes,
      orphan_candidates_count: lastRun?.orphan_files_count || 0,
      missing_references_count: lastRun?.missing_references_count || 0,
      last_scan: lastRun
        ? {
            run_id: lastRun.run_id,
            started_at: lastRun.started_at,
            completed_at: lastRun.completed_at,
            status: lastRun.status,
            mode: lastRun.mode,
          }
        : undefined,
    };
  }

  /**
   * Helper to compute safe cryptographic purge confirmation token for eligible assets
   */
  private generatePurgeConfirmationToken(
    assetId: string,
    sha256: string,
    expiresAt: Date,
  ): string {
    return crypto
      .createHash('sha256')
      .update(
        `${assetId}:${sha256}:${new Date(expiresAt).toISOString()}:STORAGE_PURGE_SALT_v1`,
      )
      .digest('hex');
  }

  /**
   * Retrieves paginated metadata inventory of managed and quarantined assets
   */
  async getInventory(query: {
    page?: number;
    limit?: number;
    status?: AssetLifecycleState;
    domain?: 'activities' | 'dormitory';
    namespace?: StorageNamespace;
    search?: string;
  }): Promise<{
    items: StorageInventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const refMap = await this.collectDatabaseReferences();
    const managedFiles = await this.storageService.listManagedFiles(
      query.namespace,
    );
    const quarantinedManifests =
      await this.storageService.listQuarantinedFiles();

    const allItems: StorageInventoryItem[] = [];
    const now = Date.now();
    const graceMs = DEFAULT_UNATTACHED_GRACE_HOURS * 60 * 60 * 1000;

    // Process managed live files
    for (const file of managedFiles) {
      const refs = refMap.get(file.key);
      const isReferenced = Boolean(refs && refs.length > 0);
      const primaryRef = refs && refs.length > 0 ? refs[0] : undefined;

      let status: AssetLifecycleState = 'active';
      if (!isReferenced) {
        const age = now - file.mtime.getTime();
        status = age < graceMs ? 'staged' : 'orphan_candidate';
      }

      // Generate opaque ID
      const opaqueId = crypto.createHash('sha1').update(file.key).digest('hex');

      // Public URL vs private URL endpoint representation (never exposes physical disk path)
      let mediaUrl = '';
      if (file.visibility === 'public') {
        mediaUrl = `/api/media/public/${file.key.replace(/^public\//, '')}`;
      } else {
        mediaUrl = `/api/media/private/${file.key.replace(/^private\//, '')}`;
      }

      allItems.push({
        id: opaqueId,
        namespace: file.namespace,
        filename: file.filename,
        relative_key: file.key,
        url: mediaUrl,
        size: file.size,
        mime_type: file.mime_type,
        created_at: file.ctime,
        modified_at: file.mtime,
        status,
        referenced: isReferenced,
        domain_ref: primaryRef
          ? {
              domain: primaryRef.domain,
              owner_id: primaryRef.owner_id,
              field: primaryRef.field,
              display_title: primaryRef.display_title,
            }
          : undefined,
      });
    }

    // Process quarantined files
    for (const q of quarantinedManifests) {
      // Derive namespace from original key
      let namespace: StorageNamespace = 'activities';
      if (q.original_key.includes('dormitory-qr')) namespace = 'dormitory-qr';
      else if (q.original_key.includes('room-fee-invoices'))
        namespace = 'room-fee-invoices';
      else if (q.original_key.includes('invoices')) namespace = 'invoices';

      if (query.namespace && namespace !== query.namespace) continue;

      // Attach confirmation token ONLY if item is eligible for purge (retention expired)
      const isEligible = Boolean(q.is_purge_eligible);
      const confirmationToken = isEligible
        ? this.generatePurgeConfirmationToken(
            q.asset_id,
            q.sha256,
            q.expires_at,
          )
        : undefined;

      const sanitizedManifest = {
        ...q,
        purge_confirmation_token: confirmationToken,
      };

      allItems.push({
        id: q.asset_id,
        namespace,
        filename: `quarantined_${q.asset_id}`,
        relative_key: q.original_key,
        url: '', // Quarantined files do not have an active public/private media url
        size: q.size,
        mime_type: q.mime_type,
        created_at: new Date(q.quarantined_at),
        modified_at: new Date(q.quarantined_at),
        status: 'quarantined',
        referenced: false,
        quarantine_manifest: sanitizedManifest,
      });
    }

    // Filter items
    let filtered = allItems;

    if (query.status) {
      filtered = filtered.filter((item) => item.status === query.status);
    }

    if (query.domain) {
      filtered = filtered.filter(
        (item) => item.domain_ref?.domain === query.domain,
      );
    }

    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.filename.toLowerCase().includes(s) ||
          item.namespace.toLowerCase().includes(s) ||
          item.id.toLowerCase().includes(s) ||
          item.domain_ref?.display_title?.toLowerCase().includes(s),
      );
    }

    // Sort by modified date descending
    filtered.sort(
      (a, b) =>
        new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime(),
    );

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Restores a quarantined asset
   */
  async restoreAsset(assetId: string, actor = 'system') {
    if (!this.storageService.getCapabilities().canRestore) {
      throw new ForbiddenException(
        'Thao tác khôi phục tệp tin hiện đang bị vô hiệu hóa bởi cấu hình hệ thống',
      );
    }

    const manifest = await this.storageService.restoreFile(assetId, actor);

    await this.auditLogModel.create({
      run_id: crypto.randomUUID(),
      action: 'restore',
      actor,
      mode: 'manual',
      status: 'success',
      details: {
        asset_id: assetId,
        size: manifest.size,
      },
    });

    return manifest;
  }

  /**
   * Purges a quarantined asset (permanent unlink, retention and capability gated)
   */
  async purgeAsset(
    assetId: string,
    actor = 'system',
    confirmationToken?: string,
    confirmationPhrase?: string,
    reason?: string,
  ) {
    if (!this.storageService.getCapabilities().canPurge) {
      throw new ForbiddenException(
        'Thao tác xóa vĩnh viễn tệp tin hiện đang bị vô hiệu hóa bởi cấu hình hệ thống',
      );
    }

    const phrase = confirmationPhrase?.trim().toUpperCase();
    if (!phrase || (phrase !== 'XÓA VĨNH VIỄN' && phrase !== 'PURGE')) {
      throw new BadRequestException(
        'Cụm từ xác nhận không chính xác. Vui lòng nhập đúng: XÓA VĨNH VIỄN',
      );
    }

    // Find quarantined manifest
    const quarantinedList = await this.storageService.listQuarantinedFiles();
    const targetManifest = quarantinedList.find((q) => q.asset_id === assetId);
    if (!targetManifest) {
      throw new NotFoundException(
        `Không tìm thấy tệp tin cách ly với ID: ${assetId}`,
      );
    }

    // Enforce retention expiry
    const now = Date.now();
    const expiresAtTime = new Date(targetManifest.expires_at).getTime();
    if (now < expiresAtTime) {
      throw new BadRequestException(
        `Tệp tin chưa hết thời hạn lưu trữ cách ly (${targetManifest.retention_remaining_days || 1} ngày còn lại)`,
      );
    }

    // Verify confirmation token bound to asset and checksum
    const expectedToken = this.generatePurgeConfirmationToken(
      targetManifest.asset_id,
      targetManifest.sha256,
      targetManifest.expires_at,
    );

    if (!confirmationToken || confirmationToken !== expectedToken) {
      throw new BadRequestException(
        'Mã xác nhận xóa vĩnh viễn (confirmationToken) không hợp lệ hoặc đã hết hạn',
      );
    }

    // Fresh zero-reference check
    const refMap = await this.collectDatabaseReferences();
    if (refMap.has(targetManifest.original_key)) {
      throw new ConflictException(
        'Tệp tin đang được tham chiếu trong cơ sở dữ liệu, không thể xóa vĩnh viễn',
      );
    }

    const runId = crypto.randomUUID();

    // Log purge attempt
    await this.auditLogModel.create({
      run_id: runId,
      action: 'purge',
      actor,
      mode: 'manual',
      status: 'attempt',
      details: {
        asset_id: assetId,
        size: targetManifest.size,
        sha256_suffix: targetManifest.sha256_suffix,
        reason: reason || 'system_admin_purge',
      },
    });

    try {
      const manifest = await this.storageService.purgeQuarantinedFile(
        assetId,
        false,
      );

      await this.auditLogModel.create({
        run_id: runId,
        action: 'purge',
        actor,
        mode: 'manual',
        status: 'success',
        details: {
          asset_id: assetId,
          reclaimed_bytes: manifest.size,
          sha256_suffix: manifest.sha256_suffix,
          reason: reason || 'system_admin_purge',
        },
      });

      return {
        message: 'Đã xóa vĩnh viễn tệp tin khỏi vùng cách ly',
        asset_id: assetId,
        reclaimed_bytes: manifest.size,
      };
    } catch (err) {
      await this.auditLogModel.create({
        run_id: runId,
        action: 'purge',
        actor,
        mode: 'manual',
        status: 'failed',
        details: {
          asset_id: assetId,
          error: (err as Error).message,
        },
      });
      throw err;
    }
  }

  /**
   * Retrieves recent audit logs
   */
  async getAuditLogs(limit = 50): Promise<StorageAuditLog[]> {
    return this.auditLogModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(Math.min(100, limit))
      .lean()
      .exec();
  }
}
