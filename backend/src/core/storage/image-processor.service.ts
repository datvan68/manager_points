import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { ImagePreset, ProcessedImageResult } from './storage.interface';

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  private readonly maxFileSize = 5 * 1024 * 1024; // 5 MB

  /**
   * Validates image magic bytes / file signature
   */
  validateImageSignature(buffer: Buffer): 'jpeg' | 'png' | 'webp' {
    if (!buffer || buffer.length < 12) {
      throw new BadRequestException('Dữ liệu ảnh không hợp lệ hoặc quá nhỏ');
    }

    if (buffer.length > this.maxFileSize) {
      throw new BadRequestException('Kích thước ảnh vượt quá giới hạn cho phép (tối đa 5MB)');
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpeg';
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'png';
    }

    // WebP signature: RIFF ... WEBP
    if (
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50 // P
    ) {
      return 'webp';
    }

    throw new BadRequestException('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPEG, PNG, WebP');
  }

  /**
   * Processes, strips metadata, auto-orients, and resizes an image based on preset.
   */
  async processImage(buffer: Buffer, preset: ImagePreset): Promise<ProcessedImageResult> {
    // 1. Verify content signature
    this.validateImageSignature(buffer);

    // 2. Initialize sharp instance with auto-rotation (EXIF orientation)
    const pipeline = sharp(buffer, { failOn: 'truncated' }).rotate();

    let outputBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    switch (preset) {
      case 'activity_cover': {
        pipeline
          .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 });
        mimeType = 'image/webp';
        extension = 'webp';
        break;
      }

      case 'activity_logo': {
        pipeline
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 });
        mimeType = 'image/webp';
        extension = 'webp';
        break;
      }

      case 'activity_frame': {
        pipeline
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel: 9 });
        mimeType = 'image/png';
        extension = 'png';
        break;
      }

      case 'invoice_proof': {
        // Text clarity is paramount for invoice receipts
        pipeline
          .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 });
        mimeType = 'image/webp';
        extension = 'webp';
        break;
      }

      case 'transfer_qr': {
        // Preserve 100% lossless clarity so QR barcodes remain scannable
        pipeline
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel: 9 });
        mimeType = 'image/png';
        extension = 'png';
        break;
      }

      default: {
        pipeline.webp({ quality: 85 });
        mimeType = 'image/webp';
        extension = 'webp';
      }
    }

    try {
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      return {
        buffer: data,
        mime_type: mimeType,
        extension,
        width: info.width,
        height: info.height,
        size: data.length,
      };
    } catch (err) {
      this.logger.error(`Lỗi xử lý ảnh với sharp: ${(err as Error).message}`);
      throw new BadRequestException('Không thể xử lý tệp ảnh. Vui lòng tải lên tệp hợp lệ');
    }
  }
}
