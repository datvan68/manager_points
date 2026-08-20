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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { InvoicesService } from '../services/invoices.service';
import {
  CreateInvoiceDto,
  PayInvoiceDto,
  UpdatePaymentProofDto,
  BulkCreateInvoiceDto,
  BulkDeleteInvoicesDto,
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
  constructor(private readonly invoicesService: InvoicesService) {}

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
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID();
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `invoice-proof-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Chỉ chấp nhận file ảnh hợp lệ (PNG, JPEG, WebP)',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiOperation({ summary: 'Upload chứng từ thanh toán hóa đơn' })
  uploadProof(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh chứng từ hợp lệ');
    }
    return {
      url: `/uploads/${file.filename}`,
      file_name: file.filename,
      mime_type: file.mimetype,
      size: file.size,
    };
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

  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
    return this.invoicesService.reviewPaymentProof(id, dto.decision, req.user);
  }
}
