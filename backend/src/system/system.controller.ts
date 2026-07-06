import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  GetLoginLogsQueryDto,
  GetLoginLogsSummaryQueryDto,
  CreateSystemRequestDto,
  UpdateSystemRequestDto,
  UpdateSystemRequestStatusDto,
  GetSystemRequestsQueryDto,
  GetBackupsQueryDto,
  CreateBackupDto,
  MongoIdParamDto,
  CreateSystemPerformanceMetricDto,
  GetPerformanceSummaryQueryDto,
  GetPerformanceMetricsQueryDto,
  RestoreBackupImportDto,
  UpdateMailSettingsDto,
  SendTestMailDto,
  UpdateModuleMaintenanceDto,
} from './dto/system.dto';

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
    @Req() req: AuthenticatedRequest,
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
  getLoginLogsSummary(@Query() query: GetLoginLogsSummaryQueryDto) {
    return this.systemService.getLoginLogsSummary(query);
  }

  // ─── SYSTEM REQUESTS ─────────────────────────────────────────────────────────

  @Get('requests')
  @Permissions('SYSTEM_REQUEST_READ')
  getRequests(@Query() query: GetSystemRequestsQueryDto) {
    return this.systemService.getRequests(query);
  }

  @Post('requests')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  createRequest(
    @Body() dto: CreateSystemRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.createRequest(dto, req.user.userId);
  }

  @Get('requests/:id')
  @Permissions('SYSTEM_REQUEST_READ')
  getRequestById(@Param() params: MongoIdParamDto) {
    return this.systemService.getRequestById(params.id);
  }

  @Patch('requests/:id')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  updateRequest(
    @Param() params: MongoIdParamDto,
    @Body() dto: UpdateSystemRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.updateRequest(params.id, dto, req.user.userId);
  }

  @Patch('requests/:id/status')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  updateRequestStatus(
    @Param() params: MongoIdParamDto,
    @Body() dto: UpdateSystemRequestStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.updateRequestStatus(
      params.id,
      dto,
      req.user.userId,
      req.user.roleName,
    );
  }

  @Delete('requests/:id')
  @Permissions('SYSTEM_REQUEST_MANAGE')
  deleteRequest(
    @Param() params: MongoIdParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.deleteRequest(params.id, req.user.userId);
  }

  // ─── DATABASE BACKUPS ────────────────────────────────────────────────────────

  @Get('backups/activity')
  @Permissions('DATABASE_BACKUP_READ', 'DATABASE_BACKUP_RESTORE')
  getSystemActivity() {
    return this.systemService.getSystemActivity();
  }

  @Post('backups/cleanup-stale')
  @Permissions('DATABASE_BACKUP_CREATE', 'DATABASE_BACKUP_RESTORE')
  cleanupStaleJobs() {
    return this.systemService.cleanupStaleJobs();
  }

  @Post('backups/:id/mark-failed')
  @Permissions('DATABASE_BACKUP_CREATE', 'DATABASE_BACKUP_RESTORE')
  markJobFailed(@Param() params: MongoIdParamDto) {
    return this.systemService.markJobFailed(params.id);
  }

  @Get('backups')
  @Permissions('DATABASE_BACKUP_READ')
  getBackups(@Query() query: GetBackupsQueryDto) {
    return this.systemService.getBackups(query);
  }

  @Post('backups')
  @Permissions('DATABASE_BACKUP_CREATE')
  createBackup(@Body() dto: CreateBackupDto, @Req() req: AuthenticatedRequest) {
    return this.systemService.createBackup(req.user.userId, dto.format);
  }

  @Get('backups/restore-jobs')
  @Permissions('DATABASE_BACKUP_READ', 'DATABASE_BACKUP_RESTORE')
  getRestoreJobs(@Query() query: GetBackupsQueryDto) {
    return this.systemService.getRestoreJobs(query);
  }

  @Get('backups/tools-health')
  @Permissions('DATABASE_BACKUP_READ', 'DATABASE_BACKUP_CREATE')
  async getMongoDbToolsHealth() {
    return this.systemService.checkMongoDbTools();
  }

  @Get('backups/:id')
  @Permissions('DATABASE_BACKUP_READ')
  getBackupById(@Param() params: MongoIdParamDto) {
    return this.systemService.getBackupById(params.id);
  }

  @Get('backups/:id/download')
  @Permissions('DATABASE_BACKUP_DOWNLOAD')
  async downloadBackup(
    @Param() params: MongoIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { filePath, fileName } = await this.systemService.downloadBackup(
      params.id,
      req.user.userId,
    );
    res.download(filePath, fileName);
  }

  @Delete('backups/:id')
  @Permissions('DATABASE_BACKUP_DELETE')
  deleteBackup(
    @Param() params: MongoIdParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.deleteBackup(params.id, req.user.userId);
  }

  /**
   * Upload and preview a backup file for import.
   * Parses the file to list collections and document counts before actual restoration.
   */
  @Post('backups/import/preview')
  @Permissions('DATABASE_BACKUP_RESTORE')
  @UseInterceptors(FileInterceptor('file'))
  async previewBackupImport(
    @UploadedFile() file: any,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file sao lưu để import');
    }
    return this.systemService.previewBackupImport(file, req.user.userId);
  }

  @Post('backups/import/preview/:previewSessionId/cancel')
  @Permissions('DATABASE_BACKUP_RESTORE')
  async cancelBackupPreview(
    @Param('previewSessionId') previewSessionId: string,
  ) {
    return this.systemService.cancelBackupPreview(previewSessionId);
  }

  /**
   * Execute the database restoration process.
   * Requires confirmation text "RESTORE" and a valid preview session.
   * Automatically triggers a pre-restore backup for safety.
   */
  @Post('backups/import/restore')
  @Permissions('DATABASE_BACKUP_RESTORE')
  async restoreBackupImport(
    @Body() dto: RestoreBackupImportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.restoreBackupImport(dto, req.user.userId);
  }

  @Get('backups/check-bson-types')
  @Permissions('DATABASE_BACKUP_RESTORE')
  checkBsonTypes() {
    return this.systemService.checkBsonTypes();
  }

  @Post('backups/repair-bson-types')
  @Permissions('DATABASE_BACKUP_RESTORE')
  repairBsonTypes(@Query('collection') collection?: string) {
    return this.systemService.repairBsonTypes(collection);
  }

  // ─── PERFORMANCE METRICS ───────────────────────────────────────────────────

  // Module maintenance states

  @Get('module-maintenance')
  @Permissions()
  getModuleMaintenanceStates() {
    return this.systemService.getModuleMaintenanceStates();
  }

  @Patch('module-maintenance/:moduleId')
  @Permissions('ADMIN_FULL')
  updateModuleMaintenanceState(
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateModuleMaintenanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.systemService.updateModuleMaintenanceState(
      moduleId,
      dto,
      req.user.userId,
    );
  }

  @Post('performance/metrics')
  @Permissions()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // More strict limit for this specific endpoint
  // No explicit permission required to send telemetry if they are authenticated users
  createPerformanceMetric(
    @Body() dto: CreateSystemPerformanceMetricDto,
    @Req() req: AuthenticatedRequest,
  ) {
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

  // ─── MAIL SETTINGS ─────────────────────────────────────────────────────────

  @Get('settings/mail')
  @Permissions('SYSTEM_MAIL_CONFIG_MANAGE')
  getMailSettings() {
    return this.systemService.getMailSettings();
  }

  @Patch('settings/mail')
  @Permissions('SYSTEM_MAIL_CONFIG_MANAGE')
  updateMailSettings(@Body() dto: UpdateMailSettingsDto) {
    return this.systemService.updateMailSettings(dto);
  }

  @Post('settings/mail/test-connection')
  @Permissions('SYSTEM_MAIL_CONFIG_MANAGE')
  testMailConnection(@Body() dto?: UpdateMailSettingsDto) {
    return this.systemService.testMailConnection(
      dto && Object.keys(dto).length > 0 ? dto : undefined,
    );
  }

  @Post('settings/mail/send-test')
  @Permissions('SYSTEM_MAIL_CONFIG_MANAGE')
  sendTestMail(@Body() dto: SendTestMailDto) {
    return this.systemService.sendTestMail(dto.to, dto.config);
  }
}
