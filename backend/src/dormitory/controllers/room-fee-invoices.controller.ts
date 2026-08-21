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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { RoomFeeInvoicesService } from '../services/room-fee-invoices.service';
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
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads';
          if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) =>
          cb(
            null,
            `invoice-transfer-qr-${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          ),
      }),
      fileFilter: (req, file, cb) =>
        file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)
          ? cb(null, true)
          : cb(
              new BadRequestException(
                'Chỉ chấp nhận file ảnh hợp lệ (PNG, JPEG, WebP)',
              ),
              false,
            ),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload mã QR chuyển khoản thu phí phòng' })
  uploadTransferQr(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file ảnh QR hợp lệ');
    return {
      url: `/uploads/${file.filename}`,
      file_name: file.filename,
      mime_type: file.mimetype,
      size: file.size,
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
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads';
          if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) =>
          cb(
            null,
            `invoice-proof-${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          ),
      }),
      fileFilter: (req, file, cb) =>
        file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)
          ? cb(null, true)
          : cb(
              new BadRequestException(
                'Chỉ chấp nhận file ảnh hợp lệ (PNG, JPEG, WebP)',
              ),
              false,
            ),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload chứng từ thanh toán phí phòng' })
  uploadProof(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file ảnh chứng từ hợp lệ');
    return {
      url: `/uploads/${file.filename}`,
      file_name: file.filename,
      mime_type: file.mimetype,
      size: file.size,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Danh sách hóa đơn phí phòng' })
  findAll(@Query() query: QueryRoomFeeInvoiceDto) {
    return this.roomFeeInvoicesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
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
