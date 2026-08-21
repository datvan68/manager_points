import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { RoomFeeInvoicesService } from '../services/room-fee-invoices.service';
import { StorageService } from '../../core/storage/storage.service';
import { ImageProcessorService } from '../../core/storage/image-processor.service';
import {
  UpdateRoomFeeConfigDto,
  PreviewRoomFeePeriodDto,
  CreateRoomFeePeriodDto,
  PreviewIndividualRoomFeeDto,
  CreateIndividualRoomFeeDto,
  PayRoomFeeInvoiceDto,
  UpdateRoomFeeProofDto,
  ReviewRoomFeeProofDto,
  BulkReviewRoomFeeProofDto,
  BulkDeleteRoomFeeInvoicesDto,
  QueryRoomFeeInvoiceDto,
} from '../dto/room-fee-invoice.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Room Fee Invoices')
@ApiBearerAuth()
@Controller('dormitory/room-fee-invoices')
export class RoomFeeInvoicesController {
  constructor(
    private readonly roomFeeInvoicesService: RoomFeeInvoicesService,
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  @Get('config')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Lấy cấu hình đơn giá thu phí phòng KTX' })
  getConfig() {
    return this.roomFeeInvoicesService.getConfig();
  }

  @Put('config')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Cập nhật cấu hình đơn giá thu phí phòng KTX' })
  updateConfig(@Body() dto: UpdateRoomFeeConfigDto, @Request() req: any) {
    return this.roomFeeInvoicesService.updateConfig(dto, req.user);
  }

  @Post('config/upload-transfer-qr')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload mã QR chuyển khoản thu phí phòng' })
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

  @Post('preview-period')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Xem trước đợt thu phí phòng theo danh sách KTX' })
  previewPeriod(@Body() dto: PreviewRoomFeePeriodDto) {
    return this.roomFeeInvoicesService.previewPeriod(dto);
  }

  @Post('create-period')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Lập đợt thu phí phòng cho danh sách KTX' })
  createPeriod(@Body() dto: CreateRoomFeePeriodDto, @Request() req: any) {
    return this.roomFeeInvoicesService.createPeriod(dto, req.user);
  }

  @Post('preview-individual')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Xem trước đợt thu phí phòng cho cá nhân' })
  previewIndividual(@Body() dto: PreviewIndividualRoomFeeDto) {
    return this.roomFeeInvoicesService.previewIndividual(dto);
  }

  @Post('create-individual')
  @UseGuards(checkPermission('DORM_INVOICE_CREATE'))
  @ApiOperation({ summary: 'Lập đợt thu phí phòng cho cá nhân' })
  createIndividual(@Body() dto: CreateIndividualRoomFeeDto, @Request() req: any) {
    return this.roomFeeInvoicesService.createIndividual(dto, req.user);
  }

  @Post('upload-proof')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload chứng từ thanh toán phí phòng' })
  async uploadProof(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.buffer) throw new BadRequestException('Vui lòng chọn file ảnh chứng từ hợp lệ');
    const processed = await this.imageProcessor.processImage(file.buffer, 'invoice_proof');
    const filename = `invoice-proof-${randomUUID()}.${processed.extension}`;
    const meta = await this.storageService.saveBuffer(processed.buffer, {
      namespace: 'room-fee-invoices',
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

  @Get(':id/proof')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Xem/Tải ảnh chứng từ thanh toán phí phòng (Yêu cầu xác thực)' })
  async getProof(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const invoice = await this.roomFeeInvoicesService.findOne(id);
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
      (invoice.roster_entry_id && String(invoice.roster_entry_id) === userIdStr);

    if (!hasPermission && !isOwner) {
      throw new ForbiddenException('Bạn không có quyền xem chứng từ thanh toán này');
    }

    const storageKey = this.storageService.extractStorageKey(
      invoice.payment_proof.url,
      'private/room-fee-invoices/proofs',
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

  @Get()

  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Danh sách hóa đơn phí phòng' })
  findAll(@Query() query: QueryRoomFeeInvoiceDto) {
    return this.roomFeeInvoicesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(checkPermission('DORM_INVOICE_READ'))
  @ApiOperation({ summary: 'Chi tiết hóa đơn phí phòng' })
  findOne(@Param('id') id: string) {
    return this.roomFeeInvoicesService.findOne(id);
  }

  @Patch(':id/pay')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @ApiOperation({ summary: 'Thanh toán hóa đơn phí phòng' })
  pay(
    @Param('id') id: string,
    @Body() dto: PayRoomFeeInvoiceDto,
    @Request() req: any,
  ) {
    return this.roomFeeInvoicesService.pay(id, dto, req.user);
  }

  @Patch(':id/proof')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @ApiOperation({ summary: 'Cập nhật lại chứng từ thanh toán phí phòng' })
  updateProof(
    @Param('id') id: string,
    @Body() dto: UpdateRoomFeeProofDto,
    @Request() req: any,
  ) {
    return this.roomFeeInvoicesService.updatePaymentProof(id, dto, req.user);
  }

  @Patch(':id/proof/review')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @ApiOperation({ summary: 'Duyệt hoặc từ chối chứng từ thanh toán phí phòng' })
  reviewProof(
    @Param('id') id: string,
    @Body() dto: ReviewRoomFeeProofDto,
    @Request() req: any,
  ) {
    return this.roomFeeInvoicesService.reviewPaymentProof(
      id,
      dto.decision,
      req.user,
      dto.request_id,
    );
  }

  @Post('proof/review/bulk')
  @UseGuards(checkPermission('DORM_INVOICE_CONFIRM'))
  @ApiOperation({ summary: 'Duyệt chứng từ thanh toán phí phòng hàng loạt' })
  bulkReviewProof(
    @Body() dto: BulkReviewRoomFeeProofDto,
    @Request() req: any,
  ) {
    return this.roomFeeInvoicesService.bulkReviewPaymentProof(
      dto.ids,
      dto.decision,
      req.user,
      dto.request_id,
    );
  }

  @Post('bulk-delete')
  @UseGuards(checkPermission('DORM_INVOICE_DELETE'))
  @ApiOperation({ summary: 'Xóa nhiều hóa đơn phí phòng chưa thu' })
  bulkDelete(
    @Body() dto: BulkDeleteRoomFeeInvoicesDto,
    @Request() req: any,
  ) {
    return this.roomFeeInvoicesService.bulkDelete(dto.ids, req.user);
  }
}
