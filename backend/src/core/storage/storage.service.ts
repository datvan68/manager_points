import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ManagedFileInfo,
  QuarantineManifest,
  SaveFileOptions,
  StorageCapacityInfo,
  StorageCapabilities,
  StorageNamespace,
  StorageVisibility,
  StoredFileMetadata,
} from './storage.interface';

export const DEFAULT_UNATTACHED_GRACE_HOURS = 24;
export const DEFAULT_QUARANTINE_RETENTION_DAYS = 30;
export const MANAGED_NAMESPACES: StorageNamespace[] = [
  'activities',
  'invoices',
  'dormitory-qr',
  'room-fee-invoices',
];

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageRoot: string;
  private readonly warningThresholdPercent = 85;
  private readonly criticalThresholdPercent = 95;
  private canExecuteReconciliation = false;
  private canRestore = false;
  private canPurge = false;
  private quarantineRetentionDays = DEFAULT_QUARANTINE_RETENTION_DAYS;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const configuredRoot =
      this.configService?.get<string>('UPLOAD_STORAGE_ROOT') ||
      process.env.UPLOAD_STORAGE_ROOT;

    if (configuredRoot) {
      this.storageRoot = path.resolve(configuredRoot);
    } else {
      this.storageRoot = path.resolve(process.cwd(), 'storage', 'uploads');
    }

    const envExecute =
      this.configService?.get<string>('STORAGE_ENABLE_RECONCILE_EXECUTE') ??
      process.env.STORAGE_ENABLE_RECONCILE_EXECUTE;
    this.canExecuteReconciliation = envExecute === 'true' || envExecute === '1';

    const envRestore =
      this.configService?.get<string>('STORAGE_ENABLE_RESTORE') ??
      process.env.STORAGE_ENABLE_RESTORE;
    this.canRestore = envRestore === 'true' || envRestore === '1';

    const envPurge =
      this.configService?.get<string>('STORAGE_ENABLE_PURGE') ??
      process.env.STORAGE_ENABLE_PURGE;
    this.canPurge = envPurge === 'true' || envPurge === '1';

    const envRetention =
      this.configService?.get<number | string>('STORAGE_QUARANTINE_RETENTION_DAYS') ??
      process.env.STORAGE_QUARANTINE_RETENTION_DAYS;
    if (envRetention) {
      const parsed = Number(envRetention);
      if (!isNaN(parsed) && parsed > 0) {
        this.quarantineRetentionDays = parsed;
      }
    }
  }

  getCapabilities(): StorageCapabilities {
    return {
      canExecuteReconciliation: this.canExecuteReconciliation,
      canRestore: this.canRestore,
      canPurge: this.canPurge,
      quarantineRetentionDays: this.quarantineRetentionDays,
    };
  }

  setCapabilities(caps: Partial<StorageCapabilities>) {
    if (caps.canExecuteReconciliation !== undefined) {
      this.canExecuteReconciliation = caps.canExecuteReconciliation;
    }
    if (caps.canRestore !== undefined) {
      this.canRestore = caps.canRestore;
    }
    if (caps.canPurge !== undefined) {
      this.canPurge = caps.canPurge;
    }
    if (caps.quarantineRetentionDays !== undefined) {
      this.quarantineRetentionDays = caps.quarantineRetentionDays;
    }
  }

  async onModuleInit() {
    await this.initStorageDirectories();
  }

  /**
   * Allows setting custom root (e.g. for testing)
   */
  setStorageRoot(customRoot: string) {
    this.storageRoot = path.resolve(customRoot);
  }

  getStorageRoot(): string {
    return this.storageRoot;
  }

  /**
   * Initializes required storage directory layout
   */
  async initStorageDirectories(): Promise<void> {
    const requiredDirs = [
      this.storageRoot,
      path.join(this.storageRoot, '.staging'),
      path.join(this.storageRoot, '.quarantine'),
      path.join(this.storageRoot, 'public', 'activities', 'covers'),
      path.join(this.storageRoot, 'public', 'activities', 'logos'),
      path.join(this.storageRoot, 'public', 'activities', 'frames'),
      path.join(this.storageRoot, 'public', 'dormitory-qr'),
      path.join(this.storageRoot, 'private', 'invoices', 'proofs'),
      path.join(this.storageRoot, 'private', 'room-fee-invoices', 'proofs'),
    ];

    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Validates and resolves a relative storage key to an absolute path.
   * Throws BadRequestException on path traversal or invalid keys.
   */
  resolvePath(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Khóa lưu trữ không hợp lệ');
    }

    if (key.includes('\0')) {
      throw new BadRequestException('Phát hiện ký tự null byte trong khóa lưu trữ');
    }

    // Normalize slashes and trim
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');

    // Prevent path traversal
    const resolvedPath = path.resolve(this.storageRoot, normalizedKey);
    const relative = path.relative(this.storageRoot, resolvedPath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Truy cập đường dẫn ngoài thư mục lưu trữ bị cấm');
    }

    return resolvedPath;
  }

  /**
   * Checks current storage capacity and thresholds.
   * Reports degraded status when statfs is unavailable without fictitious defaults.
   */
  async getCapacityMetrics(): Promise<StorageCapacityInfo> {
    try {
      if (typeof fs.promises.statfs === 'function') {
        const stats = await fs.promises.statfs(this.storageRoot);
        const totalBytes = stats.bsize * stats.blocks;
        const freeBytes = stats.bsize * stats.bavail;
        const usedBytes = totalBytes - freeBytes;
        const usagePercent =
          totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

        let status: 'normal' | 'warning' | 'critical' = 'normal';
        if (usagePercent >= this.criticalThresholdPercent) {
          status = 'critical';
        } else if (usagePercent >= this.warningThresholdPercent) {
          status = 'warning';
        }

        return {
          totalBytes,
          usedBytes,
          freeBytes,
          usagePercent,
          warningThresholdPercent: this.warningThresholdPercent,
          criticalThresholdPercent: this.criticalThresholdPercent,
          status,
          degraded: false,
        };
      }
    } catch (err) {
      this.logger.warn(`Không thể đọc statfs cho ${this.storageRoot}: ${(err as Error).message}`);
    }

    // Degraded reporting when statfs is unavailable
    return {
      totalBytes: 0,
      usedBytes: 0,
      freeBytes: 0,
      usagePercent: 0,
      warningThresholdPercent: this.warningThresholdPercent,
      criticalThresholdPercent: this.criticalThresholdPercent,
      status: 'degraded',
      degraded: true,
    };
  }

  /**
   * Atomically saves a file buffer into the local persistent storage
   */
  async saveBuffer(
    buffer: Buffer,
    options: SaveFileOptions & {
      width?: number;
      height?: number;
    },
  ): Promise<StoredFileMetadata> {
    // 1. Capacity safeguard
    const capacity = await this.getCapacityMetrics();
    if (capacity.status === 'critical') {
      this.logger.error(
        `Từ chối upload: Dung lượng ổ đĩa đạt mức nghiêm trọng (${capacity.usagePercent}%)`,
      );
      throw new ServiceUnavailableException(
        'Dung lượng máy chủ lưu trữ đã đầy, vui lòng liên hệ quản trị viên',
      );
    }

    // 2. Generate destination key
    const subfolder = options.subfolder ? options.subfolder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const filename = options.filename || `${crypto.randomUUID()}.webp`;
    const relativeKey = [
      options.visibility,
      options.namespace,
      subfolder,
      filename,
    ]
      .filter(Boolean)
      .join('/');

    const destinationPath = this.resolvePath(relativeKey);
    const stagingDir = path.join(this.storageRoot, '.staging');
    const stagingPath = path.join(stagingDir, `${crypto.randomUUID()}.tmp`);

    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.promises.mkdir(stagingDir, { recursive: true });

    // 3. Write to staging & calculate SHA256
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    await fs.promises.writeFile(stagingPath, buffer);

    // 4. Atomic rename into destination
    try {
      await fs.promises.rename(stagingPath, destinationPath);
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        // Fallback across different mount points
        await fs.promises.copyFile(stagingPath, destinationPath);
        await fs.promises.unlink(stagingPath);
      } else {
        // Clean staging on failure
        if (fs.existsSync(stagingPath)) {
          await fs.promises.unlink(stagingPath).catch(() => {});
        }
        throw err;
      }
    }

    // 5. Derive public or internal URL
    let url: string;
    if (options.visibility === 'public') {
      const publicPath = relativeKey.replace(/^public\//, '');
      url = `/api/media/public/${publicPath}`;
    } else {
      url = `/api/media/private/${relativeKey.replace(/^private\//, '')}`;
    }

    return {
      key: relativeKey,
      filename: path.basename(destinationPath),
      url,
      mime_type: options.contentType || 'image/webp',
      size: buffer.length,
      width: options.width,
      height: options.height,
      sha256: hash,
      visibility: options.visibility,
      created_at: new Date(),
    };
  }

  /**
   * Retrieves a readable stream for a stored file
   */
  getFileStream(key: string): fs.ReadStream {
    const fullPath = this.resolvePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Tệp tin không tồn tại');
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Retrieves file content as a Buffer
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    const fullPath = this.resolvePath(key);
    try {
      return await fs.promises.readFile(fullPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new NotFoundException('Tệp tin không tồn tại');
      }
      throw err;
    }
  }

  /**
   * Deletes a file safely
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(key);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      this.logger.error(`Lỗi khi xóa tệp tin ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Checks if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(key);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Gets stats of a file
   */
  async getFileStat(key: string): Promise<fs.Stats | null> {
    try {
      const fullPath = this.resolvePath(key);
      return await fs.promises.stat(fullPath);
    } catch {
      return null;
    }
  }

  /**
   * Atomically quarantines a file into `.quarantine` with a manifest
   */
  async quarantineFile(
    key: string,
    reason = 'manual_quarantine',
    actor = 'system',
  ): Promise<QuarantineManifest> {
    const fullPath = this.resolvePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Không tìm thấy tệp tin cần cách ly: ${key}`);
    }

    const stat = await fs.promises.stat(fullPath);
    const buffer = await fs.promises.readFile(fullPath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const assetId = crypto.randomUUID();
    const ext = path.extname(fullPath) || '.bin';
    const quarantineFilename = `${assetId}${ext}`;
    const quarantineKey = `.quarantine/${quarantineFilename}`;
    const quarantineDir = path.join(this.storageRoot, '.quarantine');
    const destinationPath = path.join(quarantineDir, quarantineFilename);
    const manifestPath = path.join(quarantineDir, `${assetId}.json`);

    await fs.promises.mkdir(quarantineDir, { recursive: true });

    // Derive mime type
    let mimeType = 'application/octet-stream';
    if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.svg') mimeType = 'image/svg+xml';

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.quarantineRetentionDays * 24 * 60 * 60 * 1000,
    );

    const manifest: QuarantineManifest = {
      asset_id: assetId,
      original_key: key.replace(/\\/g, '/').replace(/^\/+/, ''),
      original_relative_path: path.relative(this.storageRoot, fullPath).replace(/\\/g, '/'),
      quarantine_key: quarantineKey,
      sha256: hash,
      size: stat.size,
      mime_type: mimeType,
      quarantined_at: now,
      expires_at: expiresAt,
      reason,
      actor,
    };

    // Atomic move into .quarantine
    try {
      await fs.promises.rename(fullPath, destinationPath);
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        await fs.promises.copyFile(fullPath, destinationPath);
        await fs.promises.unlink(fullPath);
      } else {
        throw err;
      }
    }

    // Write manifest JSON
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    this.logger.log(
      `Đã đưa tệp tin ${key} vào vùng cách ly (Asset ID: ${assetId}, Size: ${stat.size}B)`,
    );
    return manifest;
  }

  /**
   * Restores a quarantined file back to its original location after checksum verification and collision check
   */
  async restoreFile(assetId: string, actor = 'system'): Promise<QuarantineManifest> {
    const quarantineDir = path.join(this.storageRoot, '.quarantine');
    const manifestPath = path.join(quarantineDir, `${assetId}.json`);

    if (!fs.existsSync(manifestPath)) {
      throw new NotFoundException(`Không tìm thấy thông tin cách ly cho Asset ID: ${assetId}`);
    }

    const manifestRaw = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest: QuarantineManifest = JSON.parse(manifestRaw);

    const quarantineFilePath = path.join(
      this.storageRoot,
      manifest.quarantine_key.replace(/\\/g, '/'),
    );

    if (!fs.existsSync(quarantineFilePath)) {
      throw new NotFoundException(
        `Tệp tin nhị phân trong vùng cách ly không tồn tại (${manifest.quarantine_key})`,
      );
    }

    // Verify sha256 checksum
    const buffer = await fs.promises.readFile(quarantineFilePath);
    const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    if (currentHash !== manifest.sha256) {
      throw new BadRequestException(
        'Tính toàn vẹn của tệp tin cách ly bị vi phạm (Checksum SHA-256 không khớp)',
      );
    }

    const targetPath = this.resolvePath(manifest.original_key);

    // Collision check: do not overwrite existing target file
    if (fs.existsSync(targetPath)) {
      throw new ConflictException(
        'Tệp tin đích đã tồn tại trên hệ thống, không thể ghi đè khi khôi phục',
      );
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    // Atomic move back to original target
    try {
      await fs.promises.rename(quarantineFilePath, targetPath);
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        await fs.promises.copyFile(quarantineFilePath, targetPath);
        await fs.promises.unlink(quarantineFilePath);
      } else {
        throw err;
      }
    }

    // Delete manifest
    await fs.promises.unlink(manifestPath).catch(() => {});

    this.logger.log(
      `Đã khôi phục tệp tin Asset ID: ${assetId} về ${manifest.original_key} bởi ${actor}`,
    );
    return manifest;
  }

  /**
   * Permanently deletes a quarantined file and its manifest (retention-gated operation)
   */
  async purgeQuarantinedFile(
    assetId: string,
    bypassRetention = false,
  ): Promise<QuarantineManifest> {
    const quarantineDir = path.join(this.storageRoot, '.quarantine');
    const manifestPath = path.join(quarantineDir, `${assetId}.json`);

    if (!fs.existsSync(manifestPath)) {
      throw new NotFoundException(`Không tìm thấy thông tin cách ly cho Asset ID: ${assetId}`);
    }

    const manifestRaw = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest: QuarantineManifest = JSON.parse(manifestRaw);

    // Enforce retention check unless explicitly bypassed by gate
    if (!bypassRetention) {
      const now = Date.now();
      const expiresAt = new Date(manifest.expires_at).getTime();
      if (now < expiresAt) {
        throw new BadRequestException(
          `Tệp tin chưa hết thời hạn lưu trữ cách ly (${this.quarantineRetentionDays} ngày)`,
        );
      }
    }

    const quarantineFilePath = path.join(
      this.storageRoot,
      manifest.quarantine_key.replace(/\\/g, '/'),
    );

    if (fs.existsSync(quarantineFilePath)) {
      const buffer = await fs.promises.readFile(quarantineFilePath);
      const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (currentHash !== manifest.sha256) {
        throw new BadRequestException(
          'Tính toàn vẹn của tệp tin cách ly bị vi phạm (Checksum SHA-256 không khớp)',
        );
      }

      await fs.promises.unlink(quarantineFilePath);
    }

    await fs.promises.unlink(manifestPath);
    return manifest;
  }

  /**
   * Lists all quarantined files and manifests
   */
  async listQuarantinedFiles(): Promise<QuarantineManifest[]> {
    const quarantineDir = path.join(this.storageRoot, '.quarantine');
    if (!fs.existsSync(quarantineDir)) return [];

    const entries = await fs.promises.readdir(quarantineDir, { withFileTypes: true });
    const manifests: QuarantineManifest[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const filePath = path.join(quarantineDir, entry.name);
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          const manifest: QuarantineManifest = JSON.parse(raw);
          manifests.push(manifest);
        } catch {
          // Ignore corrupted manifest
        }
      }
    }

    return manifests.sort(
      (a, b) => new Date(b.quarantined_at).getTime() - new Date(a.quarantined_at).getTime(),
    );
  }

  /**
   * Recursively scans and lists all managed files within allowlisted namespace roots
   */
  async listManagedFiles(namespaceFilter?: StorageNamespace): Promise<ManagedFileInfo[]> {
    const rootsToScan: Array<{ prefix: string; visibility: StorageVisibility; namespace: StorageNamespace }> = [
      { prefix: 'public/activities', visibility: 'public', namespace: 'activities' },
      { prefix: 'public/dormitory-qr', visibility: 'public', namespace: 'dormitory-qr' },
      { prefix: 'private/invoices', visibility: 'private', namespace: 'invoices' },
      { prefix: 'private/room-fee-invoices', visibility: 'private', namespace: 'room-fee-invoices' },
    ];

    const results: ManagedFileInfo[] = [];

    const scanDirectory = async (
      dirPath: string,
      visibility: StorageVisibility,
      namespace: StorageNamespace,
    ) => {
      if (!fs.existsSync(dirPath)) return;

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullEntryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          // Skip internal dirs
          if (entry.name === '.staging' || entry.name === '.quarantine') continue;
          await scanDirectory(fullEntryPath, visibility, namespace);
        } else if (entry.isFile()) {
          const relativeKey = path
            .relative(this.storageRoot, fullEntryPath)
            .replace(/\\/g, '/');

          try {
            const stat = await fs.promises.stat(fullEntryPath);
            const ext = path.extname(entry.name).toLowerCase();
            let mimeType = 'application/octet-stream';
            if (ext === '.webp') mimeType = 'image/webp';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            else if (ext === '.svg') mimeType = 'image/svg+xml';

            results.push({
              key: relativeKey,
              filename: entry.name,
              size: stat.size,
              mtime: stat.mtime,
              ctime: stat.ctime,
              mime_type: mimeType,
              visibility,
              namespace,
            });
          } catch {
            // Ignore stat read failure
          }
        }
      }
    };

    for (const item of rootsToScan) {
      if (namespaceFilter && item.namespace !== namespaceFilter) continue;
      const rootPath = path.join(this.storageRoot, item.prefix);
      await scanDirectory(rootPath, item.visibility, item.namespace);
    }

    return results;
  }

  /**
   * Cleans old staging files older than maxAgeMs (default: 1 hour)
   */
  async cleanStagingFiles(maxAgeMs = 60 * 60 * 1000): Promise<number> {
    const stagingDir = path.join(this.storageRoot, '.staging');
    if (!fs.existsSync(stagingDir)) return 0;

    let cleaned = 0;
    const now = Date.now();
    const files = await fs.promises.readdir(stagingDir);

    for (const file of files) {
      const filePath = path.join(stagingDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          cleaned++;
        }
      } catch (err) {
        this.logger.warn(`Không thể xóa staging file ${file}: ${(err as Error).message}`);
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Đã dọn dẹp ${cleaned} tệp tin staging tạm thời.`);
    }
    return cleaned;
  }

  /**
   * Helper to extract a relative storage key from a full/relative URL or key string
   */
  extractStorageKey(urlOrKey: string, defaultPrefix = ''): string {
    if (!urlOrKey) return '';
    let cleaned = urlOrKey.trim().replace(/\\/g, '/');

    // Strip URL origin if present
    cleaned = cleaned.replace(/^https?:\/\/[^\/]+/i, '');

    // Strip API prefix if present
    cleaned = cleaned.replace(/^\/api\/media\//i, '');

    // If starts with /uploads/, strip leading slash
    if (cleaned.startsWith('/uploads/')) {
      const filename = path.basename(cleaned);
      if (defaultPrefix) {
        return path.posix.join(defaultPrefix, filename);
      }
      return cleaned.replace(/^\/+/, '');
    }

    cleaned = cleaned.replace(/^\/+/, '');

    if (defaultPrefix && !cleaned.startsWith('public/') && !cleaned.startsWith('private/')) {
      return path.posix.join(defaultPrefix, path.basename(cleaned));
    }

    return cleaned;
  }
}

