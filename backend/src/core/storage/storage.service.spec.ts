import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { ImageProcessorService } from './image-processor.service';
import { MediaController } from './media.controller';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';

describe('Core Storage & Image Processing', () => {
  let storageService: StorageService;
  let imageProcessor: ImageProcessorService;
  let mediaController: MediaController;
  let tempStorageRoot: string;

  beforeEach(async () => {
    tempStorageRoot = path.join(
      os.tmpdir(),
      `test-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.promises.mkdir(tempStorageRoot, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        StorageService,
        ImageProcessorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(tempStorageRoot),
          },
        },
      ],
    }).compile();

    storageService = module.get<StorageService>(StorageService);
    imageProcessor = module.get<ImageProcessorService>(ImageProcessorService);
    mediaController = module.get<MediaController>(MediaController);

    storageService.setStorageRoot(tempStorageRoot);
    await storageService.initStorageDirectories();
  });

  afterEach(async () => {
    try {
      if (fs.existsSync(tempStorageRoot)) {
        await fs.promises.rm(tempStorageRoot, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error on test teardown
    }
  });

  describe('StorageService Path Isolation & Traversal Defense', () => {
    it('should resolve safe relative paths within storage root', () => {
      const resolved = storageService.resolvePath(
        'public/activities/covers/test.webp',
      );
      expect(resolved).toBe(
        path.join(
          tempStorageRoot,
          'public',
          'activities',
          'covers',
          'test.webp',
        ),
      );
    });

    it('should throw BadRequestException on path traversal attempts', () => {
      expect(() => storageService.resolvePath('../secret.txt')).toThrow(
        BadRequestException,
      );
      expect(() =>
        storageService.resolvePath('public/../../../etc/passwd'),
      ).toThrow(BadRequestException);
      expect(() =>
        storageService.resolvePath('public/activities/../../..'),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on null byte injection', () => {
      expect(() => storageService.resolvePath('public/test\0.png')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('StorageService Atomic Writes & File Management', () => {
    it('should atomically save a file buffer, calculate sha256 and return metadata', async () => {
      const buffer = Buffer.from('test image binary content 12345');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'covers',
        filename: 'cover-1.webp',
        visibility: 'public',
        contentType: 'image/webp',
      });

      expect(meta.key).toBe('public/activities/covers/cover-1.webp');
      expect(meta.url).toBe('/api/media/public/activities/covers/cover-1.webp');
      expect(meta.size).toBe(buffer.length);
      expect(meta.sha256).toBeDefined();

      const exists = await storageService.fileExists(meta.key);
      expect(exists).toBe(true);

      const readBuffer = await storageService.getFileBuffer(meta.key);
      expect(readBuffer.toString()).toBe(buffer.toString());
    });

    it('should delete existing files safely', async () => {
      const buffer = Buffer.from('deletable file');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'invoices',
        subfolder: 'proofs',
        filename: 'proof-to-delete.webp',
        visibility: 'private',
      });

      expect(await storageService.fileExists(meta.key)).toBe(true);
      const deleted = await storageService.deleteFile(meta.key);
      expect(deleted).toBe(true);
      expect(await storageService.fileExists(meta.key)).toBe(false);
    });

    it('should clean staging files older than maxAge', async () => {
      const stagingDir = path.join(tempStorageRoot, '.staging');
      const oldStagingFile = path.join(stagingDir, 'old-staging.tmp');
      await fs.promises.writeFile(oldStagingFile, 'old staging data');

      // Set mtime to 2 hours ago
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      await fs.promises.utimes(
        oldStagingFile,
        twoHoursAgo / 1000,
        twoHoursAgo / 1000,
      );

      const cleanedCount = await storageService.cleanStagingFiles(
        60 * 60 * 1000,
      );
      expect(cleanedCount).toBe(1);
      expect(fs.existsSync(oldStagingFile)).toBe(false);
    });
  });

  describe('ImageProcessorService & Sharp Pipeline', () => {
    it('should validate valid image signatures', async () => {
      const samplePng = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      expect(imageProcessor.validateImageSignature(samplePng)).toBe('png');
    });

    it('should reject non-image buffers', () => {
      const invalidBuffer = Buffer.from(
        'this is just a text file with no magic bytes',
      );
      expect(() =>
        imageProcessor.validateImageSignature(invalidBuffer),
      ).toThrow(BadRequestException);
    });

    it('should process and resize activity cover to webp', async () => {
      const largeImage = await sharp({
        create: {
          width: 2500,
          height: 1500,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await imageProcessor.processImage(
        largeImage,
        'activity_cover',
      );
      expect(result.mime_type).toBe('image/webp');
      expect(result.extension).toBe('webp');
      expect(result.width).toBeLessThanOrEqual(1920);
      expect(result.height).toBeLessThanOrEqual(1080);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('should preserve lossless PNG for transfer QR to guarantee scannability', async () => {
      const qrImage = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await imageProcessor.processImage(qrImage, 'transfer_qr');
      expect(result.mime_type).toBe('image/png');
      expect(result.extension).toBe('png');
    });
  });

  describe('MediaController Access Control', () => {
    it('should allow public access to activities namespace', async () => {
      const buffer = Buffer.from('public activity image');
      await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'logos',
        filename: 'logo.webp',
        visibility: 'public',
        contentType: 'image/webp',
      });

      const mockReq = {
        path: '/api/media/public/activities/logos/logo.webp',
        headers: {},
      } as any;

      const mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
        pipe: jest.fn(),
      } as any;

      const pipeSpy = jest
        .spyOn(fs.ReadStream.prototype, 'pipe')
        .mockImplementation(() => mockRes);

      await mediaController.getPublicMedia(mockReq, mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/webp',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=86400',
      );

      pipeSpy.mockRestore();
    });

    it('should forbid public access to non-allowlisted namespaces or path traversal', async () => {
      const mockReq = {
        path: '/api/media/public/invoices/proofs/secret.webp',
        headers: {},
      } as any;
      const mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as any;

      await expect(
        mediaController.getPublicMedia(mockReq, mockRes),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('StorageService Quarantine, Restore & Purge Lifecycle', () => {
    it('should quarantine a file and write manifest with SHA256', async () => {
      const buffer = Buffer.from('quarantinable content');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'covers',
        filename: 'old-cover.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'orphan_cleanup',
        'tester',
      );
      expect(manifest.asset_id).toBeDefined();
      expect(manifest.sha256).toBe(meta.sha256);
      expect(await storageService.fileExists(meta.key)).toBe(false);

      const quarantineList = await storageService.listQuarantinedFiles();
      expect(quarantineList.some((q) => q.asset_id === manifest.asset_id)).toBe(
        true,
      );
    });

    it('should restore a quarantined file back to its original location after checksum verification', async () => {
      const buffer = Buffer.from('restorable content');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'logos',
        filename: 'restore-target.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'test',
        'tester',
      );
      expect(await storageService.fileExists(meta.key)).toBe(false);

      const restored = await storageService.restoreFile(
        manifest.asset_id,
        'tester',
      );
      expect(restored.asset_id).toBe(manifest.asset_id);
      expect(await storageService.fileExists(meta.key)).toBe(true);

      const restoredContent = await storageService.getFileBuffer(meta.key);
      expect(restoredContent.toString()).toBe(buffer.toString());
    });

    it('should throw ConflictException on restore if target path already exists (collision)', async () => {
      const buffer = Buffer.from('file 1');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'logos',
        filename: 'collision.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'test',
        'tester',
      );

      // Create another file at the original target location
      await storageService.saveBuffer(Buffer.from('collision newcomer'), {
        namespace: 'activities',
        subfolder: 'logos',
        filename: 'collision.webp',
        visibility: 'public',
      });

      await expect(
        storageService.restoreFile(manifest.asset_id),
      ).rejects.toThrow(
        'Tệp tin đích đã tồn tại trên hệ thống, không thể ghi đè khi khôi phục',
      );
    });

    it('should throw BadRequestException on restore if checksum is corrupted', async () => {
      const buffer = Buffer.from('tamper test');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'covers',
        filename: 'tampered.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'test',
        'tester',
      );

      // Tamper quarantine file binary
      const quarantineFilePath = path.join(
        tempStorageRoot,
        manifest.quarantine_key,
      );
      await fs.promises.writeFile(quarantineFilePath, 'corrupted data');

      await expect(
        storageService.restoreFile(manifest.asset_id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject purge before retention expires', async () => {
      const buffer = Buffer.from('early purge test');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'covers',
        filename: 'early-purge.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'test',
        'tester',
      );

      // Attempt to purge without bypassing retention
      await expect(
        storageService.purgeQuarantinedFile(manifest.asset_id, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should purge quarantined file when retention is bypassed or expired', async () => {
      const buffer = Buffer.from('purgeable content');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'covers',
        filename: 'purgeable.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'test',
        'tester',
      );
      const purged = await storageService.purgeQuarantinedFile(
        manifest.asset_id,
        true,
      );
      expect(purged.asset_id).toBe(manifest.asset_id);

      const quarantineList = await storageService.listQuarantinedFiles();
      expect(quarantineList.some((q) => q.asset_id === manifest.asset_id)).toBe(
        false,
      );
    });

    it('should reject quarantine on symlink files to prevent traversal', async () => {
      const targetFile = path.join(tempStorageRoot, 'target.txt');
      await fs.promises.writeFile(targetFile, 'symlink target content');

      const symlinkPath = path.join(
        tempStorageRoot,
        'public',
        'activities',
        'symlink-cover.webp',
      );
      try {
        await fs.promises.symlink(targetFile, symlinkPath);
        await expect(
          storageService.quarantineFile('public/activities/symlink-cover.webp'),
        ).rejects.toThrow(BadRequestException);
      } catch (err: any) {
        // On Windows if symlink privilege is not enabled, skip test gracefully
        if (err.code === 'EPERM') {
          return;
        }
        throw err;
      }
    });

    it('should return capacity metrics with source filesystem_containing_media_root and measuredAt', async () => {
      const metrics = await storageService.getCapacityMetrics();
      expect(metrics.source).toBe('filesystem_containing_media_root');
      expect(metrics.measuredAt).toBeInstanceOf(Date);
      expect(metrics.totalBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.freeBytes).toBeGreaterThanOrEqual(0);
      expect((metrics as any).storageRoot).toBeUndefined();
      expect((metrics as any).mountPath).toBeUndefined();
    });

    it('extractStorageKey should sanitize URLs, query params, external URLs, and prevent traversal', () => {
      expect(
        storageService.extractStorageKey(
          'https://example.com/api/media/public/activities/covers/cover-1.webp?v=123#test',
        ),
      ).toBe('public/activities/covers/cover-1.webp');

      expect(
        storageService.extractStorageKey(
          '/api/media/private/invoices/proofs/proof-1.jpg?token=abc',
        ),
      ).toBe('private/invoices/proofs/proof-1.jpg');

      expect(
        storageService.extractStorageKey(
          'https://external-cdn.com/images/malicious.jpg',
        ),
      ).toBe('');

      expect(storageService.extractStorageKey('../../../etc/passwd')).toBe('');
      expect(
        storageService.extractStorageKey('public/activities/../../secret.txt'),
      ).toBe('');
    });

    it('listQuarantinedFiles should calculate is_purge_eligible, retention_remaining_days, and sha256_suffix', async () => {
      const buffer = Buffer.from('eligibility test content');
      const meta = await storageService.saveBuffer(buffer, {
        namespace: 'activities',
        subfolder: 'covers',
        filename: 'eligibility-cover.webp',
        visibility: 'public',
      });

      const manifest = await storageService.quarantineFile(
        meta.key,
        'test',
        'tester',
      );
      const list = await storageService.listQuarantinedFiles();
      const item = list.find((q) => q.asset_id === manifest.asset_id);

      expect(item).toBeDefined();
      expect(item?.is_purge_eligible).toBe(false);
      expect(item?.retention_remaining_days).toBeGreaterThanOrEqual(1);
      expect(item?.sha256_suffix).toBe(meta.sha256.slice(-8));
    });
  });
});
