import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, Res } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { GetLoginLogsQueryDto, CreateSystemRequestDto, UpdateSystemRequestDto, UpdateSystemRequestStatusDto, GetSystemRequestsQueryDto, GetBackupsQueryDto, MongoIdParamDto, CreateSystemPerformanceMetricDto, GetPerformanceSummaryQueryDto, GetPerformanceMetricsQueryDto } from './dto/system.dto';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    roleName: string;
    username?: string;
  };
}

@Controller('system')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('dashboard-metrics')
  @Permissions()
  getDashboardMetrics(
    @Query('semesterId') semesterId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.systemService.getDashboardMetrics(req.user, semesterId);
  }

  // ─── LOGIN LOGS ─────────────────────────────────────────────────────────────

  @Get('login-logs')
  @Permissions('LOGIN_LOG_READ')
  getLoginLogs(@Query() query: GetLoginLogsQueryDto) {
    return this.systemService.getLoginLogs(query);
  }

  @Get('login-logs/summary')
  @Permissions('LOGIN_LOG_READ')
  getLoginLogsSummary() {
    return this.systemService.getLoginLogsSummary();
  }

  // ─── SYSTEM REQUESTS ─────────────────────────────────────────────────────────

  @Get('requests')
  @Permissions('SYSTEM_REQUEST_READ')
  getRequests(@Query() query: GetSystemRequestsQueryDto) {
    return this.systemService.getRequests(query);
  }

  @Post('requests')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  createRequest(@Body() dto: CreateSystemRequestDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.createRequest(dto, req.user.userId);
  }

  @Get('requests/:id')
  @Permissions('SYSTEM_REQUEST_READ')
  getRequestById(@Param() params: MongoIdParamDto) {
    return this.systemService.getRequestById(params.id);
  }

  @Patch('requests/:id')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  updateRequest(@Param() params: MongoIdParamDto, @Body() dto: UpdateSystemRequestDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.updateRequest(params.id, dto, req.user.userId);
  }

  @Patch('requests/:id/status')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  updateRequestStatus(@Param() params: MongoIdParamDto, @Body() dto: UpdateSystemRequestStatusDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.updateRequestStatus(params.id, dto, req.user.userId, req.user.roleName);
  }

  @Delete('requests/:id')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  deleteRequest(@Param() params: MongoIdParamDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.deleteRequest(params.id, req.user.userId);
  }

  // ─── DATABASE BACKUPS ────────────────────────────────────────────────────────

  @Get('backups')
  @Permissions('DATABASE_BACKUP_READ')
  getBackups(@Query() query: GetBackupsQueryDto) {
    return this.systemService.getBackups(query);
  }

  @Post('backups')
  @Permissions('DATABASE_BACKUP_CREATE')
  createBackup(@Req() req: AuthenticatedRequest) {
    return this.systemService.createBackup(req.user.userId);
  }

  @Get('backups/:id')
  @Permissions('DATABASE_BACKUP_READ')
  getBackupById(@Param() params: MongoIdParamDto) {
    return this.systemService.getBackupById(params.id);
  }

  @Get('backups/:id/download')
  @Permissions('DATABASE_BACKUP_DOWNLOAD')
  async downloadBackup(@Param() params: MongoIdParamDto, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const { filePath, fileName } = await this.systemService.downloadBackup(params.id, req.user.userId);
    res.download(filePath, fileName);
  }

  @Delete('backups/:id')
  @Permissions('DATABASE_BACKUP_DELETE')
  deleteBackup(@Param() params: MongoIdParamDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.deleteBackup(params.id, req.user.userId);
  }

  // ─── PERFORMANCE METRICS ───────────────────────────────────────────────────

  @Post('performance/metrics')
  @Permissions()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // More strict limit for this specific endpoint
  // No explicit permission required to send telemetry if they are authenticated users
  createPerformanceMetric(@Body() dto: CreateSystemPerformanceMetricDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.createPerformanceMetric(dto, req?.user);
  }

  @Get('performance/summary')
  @Permissions('SYSTEM_PERFORMANCE_READ')
  getPerformanceSummary(@Query() query: GetPerformanceSummaryQueryDto) {
    return this.systemService.getPerformanceSummary(query);
  }

  @Get('performance/metrics')
  @Permissions('SYSTEM_PERFORMANCE_READ')
  getPerformanceMetrics(@Query() query: GetPerformanceMetricsQueryDto) {
    return this.systemService.getPerformanceMetricsList(query);
  }
}
