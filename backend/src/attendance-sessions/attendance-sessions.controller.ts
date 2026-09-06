import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Query,
  Sse,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { checkAnyPermission, checkPermission } from '../auth/guards/check-permission.guard';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { AttendanceRealtimeService } from './attendance-realtime.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CheckinQrDto } from './dto/checkin-qr.dto';
import { CheckinProximityDto } from './dto/checkin-proximity.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';

@ApiTags('Attendance Sessions')
@Controller('attendance-sessions')
export class AttendanceSessionsController {
  constructor(
    private readonly sessionsService: AttendanceSessionsService,
    private readonly realtimeService: AttendanceRealtimeService,
  ) {}

  private serviceRoleCode(user: any): string {
    return user?.roleCode === 'ADMIN' || user?.permissions?.includes('ADMIN_FULL')
      ? 'ADMIN'
      : user?.roleCode || 'USER';
  }

  @Post()
  @UseGuards(checkPermission('ATTENDANCE_SESSION_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mở phiên điểm danh mới (QR hoặc Proximity)' })
  openSession(@Body() dto: OpenSessionDto, @Request() req: any) {
    return this.sessionsService.openSession(
      dto,
      req.user.userId,
      this.serviceRoleCode(req.user),
    );
  }

  @Get('active')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy phiên điểm danh đang active theo context' })
  @ApiQuery({ name: 'context_type', required: true })
  @ApiQuery({ name: 'context_id', required: true })
  getActiveSession(
    @Query('context_type') contextType: string,
    @Query('context_id') contextId: string,
    @Request() req: any,
  ) {
    const filters = {
      method: req.query?.method,
      classId: req.query?.class_id,
      scheduleId: req.query?.schedule_id,
    };
    const args: any[] = [contextType, contextId, req.user.userId, this.serviceRoleCode(req.user)];
    if (Object.values(filters).some(Boolean)) args.push(filters);
    return (this.sessionsService.getActiveSession as any)(...args);
  }

  @Sse('realtime')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Realtime attendance updates for one activity context' })
  @ApiQuery({ name: 'context_type', required: true })
  @ApiQuery({ name: 'context_id', required: true })
  async realtime(
    @Query('context_type') contextType: string,
    @Query('context_id') contextId: string,
    @Request() req: any,
  ) {
    return this.realtimeService.getStream(req.user, contextType, contextId);
  }

  @Get('history')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử phiên điểm danh theo context' })
  @ApiQuery({ name: 'context_type', required: true })
  @ApiQuery({ name: 'context_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSessionHistory(
    @Query('context_type') contextType: string,
    @Query('context_id') contextId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.sessionsService.getSessionHistory(
      contextType,
      contextId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      req?.user?.userId,
      this.serviceRoleCode(req?.user),
    );
  }

  @Get(':id')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết phiên điểm danh' })
  getSessionById(@Param('id') id: string, @Request() req: any) {
    return this.sessionsService.getSessionById(id, req.user.userId, this.serviceRoleCode(req.user));
  }

  @Get(':id/qr')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy QR data hiện tại (admin polling)' })
  getQrData(@Param('id') id: string, @Request() req: any) {
    return this.sessionsService.getQrData(id, req.user.userId, this.serviceRoleCode(req.user));
  }

  @Post(':id/close')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_CLOSE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đóng phiên điểm danh' })
  closeSession(@Param('id') id: string, @Request() req: any) {
    return this.sessionsService.closeSession(
      id,
      req.user.userId,
      this.serviceRoleCode(req.user),
    );
  }

  @Post('checkin/qr')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check-in bằng QR code' })
  checkinQr(@Body() dto: CheckinQrDto, @Request() req: any) {
    const userAgent = req.headers?.['user-agent'];
    return this.sessionsService.checkinQr(
      dto,
      req.user.userId,
      this.serviceRoleCode(req.user),
      userAgent,
    );
  }

  @Post('checkin/proximity')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check-in bằng proximity (GPS)' })
  checkinProximity(@Body() dto: CheckinProximityDto, @Request() req: any) {
    const userAgent = req.headers?.['user-agent'];
    return this.sessionsService.checkinProximity(
      dto,
      req.user.userId,
      this.serviceRoleCode(req.user),
      userAgent,
    );
  }

  @Get(':id/checkins')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách đã check-in trong phiên' })
  getCheckins(@Param('id') id: string, @Request() req: any) {
    return this.sessionsService.getCheckins(
      id,
      req.user.userId,
      this.serviceRoleCode(req.user),
    );
  }

  @Get(':id/manual-roster')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_READ'))
  @ApiBearerAuth()
  getManualRoster(@Param('id') id: string, @Request() req: any) {
    return this.sessionsService.getManualRoster(id, req.user.userId, this.serviceRoleCode(req.user));
  }

  @Post(':id/manual-checkins')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  manualCheckin(@Param('id') id: string, @Body() dto: ManualAttendanceDto, @Request() req: any) {
    return this.sessionsService.manualCheckin(id, dto.student_id, req.user.userId, this.serviceRoleCode(req.user));
  }

  @Delete(':id/manual-checkins/:studentId')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_DELETE'))
  @ApiBearerAuth()
  cancelManualCheckin(@Param('id') id: string, @Param('studentId') studentId: string, @Request() req: any) {
    return this.sessionsService.cancelManualCheckin(id, studentId, req.user.userId, this.serviceRoleCode(req.user));
  }
}
