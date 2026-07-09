import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from '../services/invoices.service';
import {
  CreateInvoiceDto,
  PayInvoiceDto,
  BulkCreateInvoiceDto,
} from '../dto/create-invoice.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Invoices')
@ApiBearerAuth()
@Controller('dormitory/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

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

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('student_id') student_id?: string,
    @Query('contract_id') contract_id?: string,
    @Query('trang_thai') trang_thai?: string,
    @Query('ky_thu') ky_thu?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      student_id,
      contract_id,
      trang_thai,
      ky_thu,
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
}
