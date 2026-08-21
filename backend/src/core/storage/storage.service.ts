import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  SaveFileOptions,
  StorageCapacityInfo,
  StoredFileMetadata,
} from './storage.interface';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageRoot: string;
  private readonly warningThresholdPercent = 85;
  private readonly criticalThresholdPercent = 95;

  constructor(@Optional() private readonly configService?: ConfigService) {

    const configuredRoot =
      this.configService?.get<string>('UPLOAD_STORAGE_ROOT') ||
      process.env.UPLOAD_STORAGE_ROOT;

    if (configuredRoot) {
      this.storageRoot = path.resolve(configuredRoot);
    } else {
      this.storageRoot = path.resolve(process.cwd(), 'storage', 'uploads');
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
   * Checks current storage capacity and thresholds
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
        };
      }
    } catch (err) {
      this.logger.warn(`Không thể đọc statfs cho ${this.storageRoot}: ${(err as Error).message}`);
    }

    // Fallback if statfs is unavailable
    return {
      totalBytes: 100 * 1024 * 1024 * 1024, // 100 GB virtual default
      usedBytes: 0,
      freeBytes: 100 * 1024 * 1024 * 1024,
      usagePercent: 0,
      warningThresholdPercent: this.warningThresholdPercent,
      criticalThresholdPercent: this.criticalThresholdPercent,
      status: 'normal',
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

