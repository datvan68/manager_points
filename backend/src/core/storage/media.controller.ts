import {
  Controller,
  Get,
  Req,
  Res,
  NotFoundException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as path from 'path';

const ALLOWED_PUBLIC_NAMESPACES = ['activities', 'dormitory-qr'];

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly storageService: StorageService) {}

  @Get('public/*')
  @ApiOperation({ summary: 'Truy xuất media công khai (activities, QR)' })
  async getPublicMedia(@Req() req: Request, @Res() res: Response) {
    // Extract path after /api/media/public/ or /media/public/
    const rawPath = req.path.replace(/^(?:\/api)?\/media\/public\//, '');
    const decodedPath = decodeURIComponent(rawPath);

    // Verify key doesn't attempt path traversal or private access
    if (!decodedPath || decodedPath.includes('..') || decodedPath.includes('\0')) {
      throw new ForbiddenException('Đường dẫn không hợp lệ');
    }

    const segments = decodedPath.split('/').filter(Boolean);
    const namespace = segments[0];

    if (!namespace || !ALLOWED_PUBLIC_NAMESPACES.includes(namespace)) {
      throw new ForbiddenException('Không có quyền truy cập không gian media này');
    }

    const storageKey = `public/${decodedPath}`;
    const exists = await this.storageService.fileExists(storageKey);
    if (!exists) {
      throw new NotFoundException('Tệp tin media không tồn tại');
    }

    const stat = await this.storageService.getFileStat(storageKey);
    const ext = path.extname(storageKey).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    if (stat) {
      const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
      const clientEtag = req.headers['if-none-match'];

      if (clientEtag === etag) {
        return res.status(304).end();
      }

      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stat.mtime.toUTCString());
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache

    const stream = this.storageService.getFileStream(storageKey);
    stream.pipe(res);
  }

  @Get('capacity')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('SYSTEM_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem thông số dung lượng lưu trữ cục bộ' })
  async getCapacity() {
    return this.storageService.getCapacityMetrics();
  }
}
