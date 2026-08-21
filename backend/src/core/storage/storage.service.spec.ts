import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { ImageProcessorService } from './image-processor.service';
import { MediaController } from './media.controller';
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
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
      const resolved = storageService.resolvePath('public/activities/covers/test.webp');
      expect(resolved).toBe(path.join(tempStorageRoot, 'public', 'activities', 'covers', 'test.webp'));
    });

    it('should throw BadRequestException on path traversal attempts', () => {
      expect(() => storageService.resolvePath('../secret.txt')).toThrow(BadRequestException);
      expect(() => storageService.resolvePath('public/../../../etc/passwd')).toThrow(BadRequestException);
      expect(() => storageService.resolvePath('public/activities/../../..')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on null byte injection', () => {
      expect(() => storageService.resolvePath('public/test\0.png')).toThrow(BadRequestException);
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
      await fs.promises.utimes(oldStagingFile, twoHoursAgo / 1000, twoHoursAgo / 1000);

      const cleanedCount = await storageService.cleanStagingFiles(60 * 60 * 1000);
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
      const invalidBuffer = Buffer.from('this is just a text file with no magic bytes');
      expect(() => imageProcessor.validateImageSignature(invalidBuffer)).toThrow(BadRequestException);
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

      const result = await imageProcessor.processImage(largeImage, 'activity_cover');
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

      const pipeSpy = jest.spyOn(fs.ReadStream.prototype, 'pipe').mockImplementation(() => mockRes);

      await mediaController.getPublicMedia(mockReq, mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400');

      pipeSpy.mockRestore();
    });

    it('should forbid public access to non-allowlisted namespaces or path traversal', async () => {
      const mockReq = {
        path: '/api/media/public/invoices/proofs/secret.webp',
        headers: {},
      } as any;
      const mockRes = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), end: jest.fn() } as any;

      await expect(mediaController.getPublicMedia(mockReq, mockRes)).rejects.toThrow(ForbiddenException);
    });
  });
});
