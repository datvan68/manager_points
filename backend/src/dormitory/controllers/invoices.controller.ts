import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Res,
  Sse,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { InvoicesService } from '../services/invoices.service';
import { DormitoryInvoiceRealtimeService } from '../dormitory-invoice-realtime.service';
import { StorageService } from '../../core/storage/storage.service';
import { ImageProcessorService } from '../../core/storage/image-processor.service';
import {
  CreateInvoiceDto,
  PayInvoiceDto,
  UpdatePaymentProofDto,
  BulkCreateInvoiceDto,
  BulkDeleteInvoicesDto,
  BulkReviewPaymentProofDto,
  CreateMonthlyInvoiceDto,
  UpdateMonthlyInvoiceDto,
} from '../dto/create-invoice.dto';
import { UpdateUtilityConfigDto } from '../dto/utility-config.dto';
import { BulkMeterReadingsDto } from '../dto/bulk-meter-readings.dto';
import { ReviewPaymentProofDto } from '../dto/create-invoice.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Invoices')
@ApiBearerAuth()
@Controller('dormitory/invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly realtimeService: DormitoryInvoiceRealtimeService,
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  @Sse('realtime')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Lắng nghe sự kiện realtime hóa đơn KTX' })
  @ApiQuery({ name: 'kind', required: false, enum: ['utility', 'room_fee'] })
  realtime(@Query('kind') kind: string, @Request() req: any) {
    return this.realtimeService.getStream(req.user, kind);
  }

  @Get('config')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Lấy cấu hình dùng chung điện - nước và hạn thu' })
  getUtilityConfig() {
    return this.invoicesService.getUtilityConfig();
  }

  @Put('config')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Cập nhật cấu hình dùng chung điện - nước và hạn thu' })
  updateUtilityConfig(
    @Body() dto: UpdateUtilityConfigDto,
    @Request() req: any,
  ) {
    return this.invoicesService.updateUtilityConfig(dto, req.user);
  }

  @Get('meter-readings')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Lấy danh sách phòng ghi chỉ số điện - nước theo kỳ' })
  getMeterReadings(@Query('billing_month') billingMonth: string) {
    return this.invoicesService.getMeterReadings(billingMonth);
  }

  @Post('meter-readings/bulk')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Lưu chỉ số điện - nước hàng loạt theo phòng' })
  saveBulkMeterReadings(
    @Body() dto: BulkMeterReadingsDto,
    @Request() req: any,
  ) {
    return this.invoicesService.saveBulkMeterReadings(dto, req.user);
  }

  @Post('monthly')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Tạo hóa đơn điện - nước hàng tháng cho phòng' })
  createMonthly(@Body() dto: CreateMonthlyInvoiceDto, @Request() req: any) {
    return this.invoicesService.createMonthly(dto, req.user);
  }

  @Patch(':id/monthly')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Cập nhật thông số hóa đơn điện - nước hàng tháng' })
  updateMonthly(
    @Param('id') id: string,
    @Body() dto: UpdateMonthlyInvoiceDto,
    @Request() req: any,
  ) {
    return this.invoicesService.updateMonthly(id, dto, req.user);
  }

  @Get('room-info/:roomId')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Lấy thông tin phòng, số người ở và chỉ số cũ' })
  getRoomInfo(
    @Param('roomId') roomId: string,
    @Query('billing_month') billingMonth?: string,
  ) {
    return this.invoicesService.getRoomInfo(roomId, billingMonth);
  }


  @Post('upload-proof')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiOperation({ summary: 'Upload chứng từ thanh toán hóa đơn' })
  async uploadProof(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file ảnh chứng từ hợp lệ');
    }
    const processed = await this.imageProcessor.processImage(file.buffer, 'invoice_proof');
    const filename = `invoice-proof-${randomUUID()}.${processed.extension}`;
    const meta = await this.storageService.saveBuffer(processed.buffer, {
      namespace: 'invoices',
      subfolder: 'proofs',
      filename,
      visibility: 'private',
      contentType: processed.mime_type,
      width: processed.width,
      height: processed.height,
    });

    return {
      url: meta.url,
      file_name: meta.filename,
      mime_type: meta.mime_type,
      size: meta.size,
    };
  }

  @Post('config/upload-transfer-qr')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload mã QR chuyển khoản mặc định' })
  async uploadTransferQr(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) throw new BadRequestException('Vui lòng chọn file ảnh QR hợp lệ');
    const processed = await this.imageProcessor.processImage(file.buffer, 'transfer_qr');
    const filename = `invoice-transfer-qr-${randomUUID()}.${processed.extension}`;
    const meta = await this.storageService.saveBuffer(processed.buffer, {
      namespace: 'dormitory-qr',
      filename,
      visibility: 'public',
      contentType: processed.mime_type,
      width: processed.width,
      height: processed.height,
    });

    return {
      url: meta.url,
      file_name: meta.filename,
      mime_type: meta.mime_type,
      size: meta.size,
    };
  }

  @Get(':id/proof')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xem/Tải ảnh chứng từ thanh toán hóa đơn (Yêu cầu xác thực)' })
  async getProof(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const invoice = await this.invoicesService.findOne(id);
    if (!invoice || !invoice.payment_proof || !invoice.payment_proof.url) {
      throw new NotFoundException('Không tìm thấy chứng từ thanh toán cho hóa đơn này');
    }

    const user = req.user;
    const permissions = user?.permissions || [];
    const hasPermission =
      permissions.includes('DORM_INVOICE_READ') ||
      permissions.includes('DORM_INVOICE_CONFIRM') ||
      user?.roleCode === 'ADMIN' ||
      user?.roleName === 'Admin';

    const userIdStr = String(user?.userId || user?._id || user?.id || '');
    const isOwner =
      (invoice.student_id && String(invoice.student_id) === userIdStr) ||
      (invoice.roster_entry_ids &&
        invoice.roster_entry_ids.some(
          (r: any) => String(r.student_id || r) === userIdStr,
        ));

    if (!hasPermission && !isOwner) {
      throw new ForbiddenException('Bạn không có quyền xem chứng từ thanh toán này');
    }

    const storageKey = this.storageService.extractStorageKey(
      invoice.payment_proof.url,
      'private/invoices/proofs',
    );

    const exists = await this.storageService.fileExists(storageKey);
    if (!exists) {
      throw new NotFoundException('Tệp tin chứng từ không tồn tại trên hệ thống lưu trữ');
    }

    const mimeType = invoice.payment_proof.mime_type || 'image/webp';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${invoice.payment_proof.file_name || 'proof.webp'}"`,
    );

    const stream = this.storageService.getFileStream(storageKey);
    stream.pipe(res);
  }

  @Post()
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  create(@Body() dto: CreateInvoiceDto, @Request() req: any) {
    return this.invoicesService.create(dto, req.user);
  }

  @Post('bulk-create')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  bulkCreate(@Body() dto: BulkCreateInvoiceDto, @Request() req: any) {
    return this.invoicesService.bulkCreate(dto, req.user);
  }

  @Post('bulk-delete')
  @UseGuards(checkPermission('DORM_INVOICE_DELETE'))
  @ApiOperation({ summary: 'Xóa nhiều hóa đơn' })
  bulkDelete(@Body() dto: BulkDeleteInvoicesDto, @Request() req: any) {
    return this.invoicesService.bulkDelete(dto.ids, req.user);
  }

  @Post('proof/review/bulk')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  bulkReviewProof(@Body() dto: BulkReviewPaymentProofDto, @Request() req: any) {
    return this.invoicesService.bulkReviewPaymentProof(dto.ids, dto.decision, req.user, dto.request_id);
  }

  @Get()
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  findAll(
    @Query('room_id') room_id?: string,
    @Query('billing_month') billing_month?: string,
    @Query('student_id') student_id?: string,
    @Query('contract_id') contract_id?: string,
    @Query('status') status?: string,
    @Query('billing_period') billing_period?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      room_id,
      billing_month,
      student_id,
      contract_id,
      status,
      billing_period,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('overdue-summary')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  getOverdueSummary() {
    return this.invoicesService.getOverdueSummary();
  }

  @Get(':id')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id/pay')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  pay(
    @Param('id') id: string,
    @Body() dto: PayInvoiceDto,
    @Request() req: any,
  ) {
    return this.invoicesService.pay(id, dto, req.user);
  }

  @Patch(':id/proof')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @ApiOperation({ summary: 'Cập nhật lại chứng từ thanh toán cho hóa đơn' })
  updateProof(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentProofDto,
    @Request() req: any,
  ) {
    return this.invoicesService.updatePaymentProof(id, dto, req.user);
  }

  @Patch(':id/proof/review')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  reviewProof(@Param('id') id: string, @Body() dto: ReviewPaymentProofDto, @Request() req: any) {
    return this.invoicesService.reviewPaymentProof(id, dto.decision, req.user, dto.request_id);
  }
}
