import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { PdfTemplateService } from './pdf-template.service';
import { PreviewPdfTemplateDto } from './dto/preview-pdf-template.dto';
import { UpdatePdfTemplateDto } from './dto/update-pdf-template.dto';

@ApiTags('Dormitory - PDF templates')
@ApiBearerAuth()
@Controller('dormitory/pdf-templates')
export class PdfTemplateController {
  constructor(private readonly service: PdfTemplateService) {}

  @Get()
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_READ'))
  list() { return this.service.list(); }

  @Get(':templateCode/source')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_READ'))
  async source(@Param('templateCode') templateCode: string, @Query('revisionId') revisionId: string | undefined, @Res() response: Response) {
    const result = await this.service.getSource(templateCode, revisionId);
    response.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(result.buffer.length), 'Content-Disposition': `inline; filename="${result.filename}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    response.end(result.buffer);
  }

  @Get(':templateCode/revisions')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_READ'))
  revisions(@Param('templateCode') templateCode: string) { return this.service.listRevisions(templateCode); }

  @Get(':templateCode')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_READ'))
  get(@Param('templateCode') templateCode: string) { return this.service.get(templateCode); }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_MANAGE'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 }, storage: undefined }))
  create(@UploadedFile() file: Express.Multer.File, @Body('template_code') templateCode: string, @Request() request: any) {
    if (!file?.buffer) throw new BadRequestException('Thiếu file PDF.');
    return this.service.createDraft(file, templateCode || 'DORMITORY_APPLICATION', request.user);
  }

  @Patch(':templateCode/drafts/:revisionId')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_MANAGE'))
  update(@Param('templateCode') templateCode: string, @Param('revisionId') revisionId: string, @Body() dto: UpdatePdfTemplateDto, @Request() request: any) {
    return this.service.updateDraft(templateCode, revisionId, dto, request.user);
  }

  @Post(':templateCode/drafts/:revisionId/validate')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_MANAGE'))
  validate(@Param('templateCode') templateCode: string, @Param('revisionId') revisionId: string) { return this.service.validateDraft(templateCode, revisionId); }

  @Post(':templateCode/drafts/:revisionId/preview')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_READ'))
  async preview(@Param('templateCode') templateCode: string, @Param('revisionId') revisionId: string, @Body() dto: PreviewPdfTemplateDto, @Request() request: any, @Res() response: Response) {
    const result = await this.service.preview(templateCode, revisionId, dto, request.user);
    response.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(result.buffer.length), 'Content-Disposition': `inline; filename="${result.filename}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    response.end(result.buffer);
  }

  @Post(':templateCode/drafts/:revisionId/publish')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_PUBLISH'))
  publish(@Param('templateCode') templateCode: string, @Param('revisionId') revisionId: string, @Request() request: any) { return this.service.publish(templateCode, revisionId, request.user); }

  @Post(':templateCode/revisions/:revisionId/restore')
  @UseGuards(checkPermission('DORM_PDF_TEMPLATE_MANAGE'))
  restore(@Param('templateCode') templateCode: string, @Param('revisionId') revisionId: string, @Request() request: any) { return this.service.restore(templateCode, revisionId, request.user); }
}

