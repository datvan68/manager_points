import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { PdfTemplateService } from './pdf-template.service';
import { PDF_TEMPLATE_DELETE, PDF_TEMPLATE_MANAGE, PDF_TEMPLATE_READ, PDF_TEMPLATE_MAX_FILE_BYTES } from './types';

@ApiTags('PDF Templates')
@ApiBearerAuth()
@Controller('pdf-templates')
export class PdfTemplateController {
  constructor(private readonly service: PdfTemplateService) {}

  @Get('catalog') @UseGuards(checkPermission(PDF_TEMPLATE_READ)) catalog(@Query() query: any) { return this.service.catalog(query); }
  @Get(':templateTypeCode') @UseGuards(checkPermission(PDF_TEMPLATE_READ)) metadata(@Param('templateTypeCode') code: string) { return this.service.metadata(code); }
  @Get(':templateTypeCode/source') @UseGuards(checkPermission(PDF_TEMPLATE_READ)) async source(@Param('templateTypeCode') code: string, @Res() response: Response) { const source = await this.service.source(code); if (!source || !source.buffer || source.buffer.length === 0) return response.status(404).json({ message: 'Template chưa có source PDF.' }); const filename = String(source.filename || 'template.pdf').replace(/[\r\n"\\/]+/g, '-'); response.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(source.buffer.length), 'Content-Disposition': `inline; filename="${filename}"`, 'X-Content-Type-Options': 'nosniff' }); return response.end(source.buffer); }

  @Post(':templateTypeCode/preview') @UseGuards(checkPermission(PDF_TEMPLATE_READ)) @UseInterceptors(FileInterceptor('source', { limits: { fileSize: PDF_TEMPLATE_MAX_FILE_BYTES } })) @ApiConsumes('multipart/form-data') async preview(@Param('templateTypeCode') code: string, @Body() body: any, @UploadedFile() source: any, @Res() response: Response) {
    const result = await this.service.preview(code, this.parseLayout(body.layout), body.fixture || 'short', source && { buffer: source.buffer, originalname: source.originalname, mimetype: source.mimetype });
    response.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(result.buffer.length), 'Content-Disposition': 'inline; filename="pdf-template-preview.pdf"', 'X-Content-Type-Options': 'nosniff' });
    return response.end(result.buffer);
  }
  @Post(':templateTypeCode') @UseGuards(checkPermission(PDF_TEMPLATE_MANAGE)) @UseInterceptors(FileInterceptor('source', { limits: { fileSize: PDF_TEMPLATE_MAX_FILE_BYTES } })) @ApiConsumes('multipart/form-data') create(@Param('templateTypeCode') code: string, @Body() body: any, @UploadedFile() source: any, @Req() request: any) { return this.service.create(code, { layout: this.parseLayout(body.layout), source: source && { buffer: source.buffer, originalname: source.originalname, mimetype: source.mimetype } }, request.user); }
  @Post(':templateTypeCode/validate') @UseGuards(checkPermission(PDF_TEMPLATE_MANAGE)) @UseInterceptors(FileInterceptor('source', { limits: { fileSize: PDF_TEMPLATE_MAX_FILE_BYTES } })) @ApiConsumes('multipart/form-data') validate(@Param('templateTypeCode') code: string, @Body() body: any, @UploadedFile() source: any) { return this.service.validate(code, this.parseLayout(body.layout), source && { buffer: source.buffer, originalname: source.originalname, mimetype: source.mimetype }); }
  @Put(':templateTypeCode') @UseGuards(checkPermission(PDF_TEMPLATE_MANAGE)) @UseInterceptors(FileInterceptor('source', { limits: { fileSize: PDF_TEMPLATE_MAX_FILE_BYTES } })) @ApiConsumes('multipart/form-data') update(@Param('templateTypeCode') code: string, @Body() body: any, @UploadedFile() source: any, @Req() request: any) { return this.service.update(code, { version: Number(body.version), layout: this.parseLayout(body.layout), source: source && { buffer: source.buffer, originalname: source.originalname, mimetype: source.mimetype } }, request.user); }
  @Delete(':templateTypeCode') @UseGuards(checkPermission(PDF_TEMPLATE_DELETE)) delete(@Param('templateTypeCode') code: string, @Query('version') version: string, @Req() request: any) { return this.service.delete(code, Number(version), request.user); }

  private parseLayout(value: unknown) { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return value; } }
}
