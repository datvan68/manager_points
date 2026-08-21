import { Controller, Get, Query, UseGuards, Sse, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DormitoryReportsService } from '../services/dormitory-reports.service';
import { DormitoryOverviewRealtimeService } from '../dormitory-overview-realtime.service';
import { checkPermission } from '../../auth/guards/check-permission.guard';

@ApiTags('Dormitory - Reports')
@ApiBearerAuth()
@Controller('dormitory/reports')
export class DormitoryReportsController {
  constructor(
    private readonly reportsService: DormitoryReportsService,
    private readonly realtimeService: DormitoryOverviewRealtimeService,
  ) {}

  @Sse('realtime')
  @UseGuards(checkPermission('DORM_PAGE'))
  @ApiOperation({ summary: 'Lắng nghe sự kiện realtime cập nhật tổng quan KTX' })
  realtime(@Request() req?: any) {
    return this.realtimeService.getStream(req?.user);
  }

  @Get('dashboard')
  @UseGuards(checkPermission('DORM_PAGE'))
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('occupancy')
  @UseGuards(checkPermission('DORM_REPORT_READ'))
  getOccupancyReport() {
    return this.reportsService.getOccupancyReport();
  }

  @Get('revenue')
  @UseGuards(checkPermission('DORM_REPORT_READ'))
  getRevenueReport(@Query('billing_period') billing_period?: string) {
    return this.reportsService.getRevenueReport({ billing_period });
  }

  @Get('violations-maintenance')
  @UseGuards(checkPermission('DORM_REPORT_READ'))
  getViolationMaintenanceReport() {
    return this.reportsService.getViolationMaintenanceReport();
  }
}
