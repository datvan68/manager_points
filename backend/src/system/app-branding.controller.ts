import { Body, Controller, Get, Param, Patch, Res, Sse, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UpdateAppBrandingDto } from './dto/system.dto';
import { SystemService } from './system.service';

@Controller('app-branding')
export class AppBrandingController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  getBranding() { return this.systemService.getAppBranding(); }

  @Get('icons/:size/:version.png')
  async getIcon(@Param('size') size: string, @Param('version') version: string, @Res() response: Response) {
    const icon = await this.systemService.getAppBrandingIcon(size, version);
    if (!icon) return response.status(404).end();
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return response.send(icon);
  }

  @Sse('events')
  events(): Observable<{ data: unknown }> {
    return new Observable((subscriber) => {
      const listener = (branding: unknown) => subscriber.next({ data: branding });
      this.systemService.getAppBrandingStream().on('changed', listener);
      return () => this.systemService.getAppBrandingStream().off('changed', listener);
    });
  }

  @Patch()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('SYSTEM_ADMIN')
  @UseInterceptors(FilesInterceptor('icons', 4, { limits: { fileSize: 2 * 1024 * 1024 } }))
  updateBranding(@Body() dto: UpdateAppBrandingDto, @UploadedFiles() icons: Express.Multer.File[]) {
    const files = Object.fromEntries((icons || []).map((file) => [file.originalname.replace(/\.png$/i, ''), file]));
    return this.systemService.updateAppBranding(dto, files);
  }
}
