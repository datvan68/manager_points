import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ActivityAttendanceService } from './club-attendance.service';
import { ActivityAttendanceSyncService } from './club-attendance-sync.service';
import {
  CreateAttendanceDto,
  BatchAttendanceDto,
  ApproveAttendanceDto,
  BatchApproveDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('Activity Attendance')
@Controller(['club-attendance', 'activity-attendance'])
export class ActivityAttendanceController {
  constructor(
    private readonly attendanceService: ActivityAttendanceService,
    private readonly syncService: ActivityAttendanceSyncService,
  ) {}

  @Post()
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ghi nhận điểm danh sinh viên' })
  create(@Body() dto: CreateAttendanceDto, @Request() req: any) {
    const role = (
      req.user.role_code ||
      req.user.roleName ||
      'teacher'
    ).toLowerCase();
    const mappedRole = role.includes('student') ? 'student' : 'teacher';
    return this.attendanceService.create(
      dto,
      req.user._id || req.user.id,
      mappedRole,
    );
  }

  @Post('batch')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Điểm danh hàng loạt (GV điểm danh cả lớp Hoạt động)' })
  batchCreate(@Body() dto: BatchAttendanceDto, @Request() req: any) {
    return this.attendanceService.batchCreate(
      dto,
      req.user._id || req.user.id,
      'teacher',
    );
  }

  @Get()
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách điểm danh' })
  findAll(@Query() query: QueryAttendanceDto) {
    return this.attendanceService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử điểm danh cá nhân' })
  @ApiQuery({ name: 'semester_id', required: false })
  @ApiQuery({ name: 'activity_id', required: false })
  findMyAttendance(
    @Request() req: any,
    @Query('semester_id') semesterId?: string,
    @Query('activity_id') activityId?: string,
  ) {
    return this.attendanceService.findMyAttendance(
      req.user.studentId || req.user._id,
      semesterId,
      activityId,
    );
  }

  @Get('pending-count')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Số lượng điểm danh chờ duyệt' })
  @ApiQuery({ name: 'activity_id', required: false })
  getPendingCount(
    @Query('activity_id') activityId?: string,
  ) {
    return this.attendanceService.getPendingCount(activityId);
  }

  @Get('summary/:activityId')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê tổng hợp điểm danh Hoạt động' })
  @ApiQuery({ name: 'semester_id', required: true })
  getSummary(
    @Param('activityId') activityId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.attendanceService.getSummary(activityId, semesterId);
  }

  @Get(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết bản ghi điểm danh' })
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật điểm danh' })
  update(@Param('id') id: string, @Body() updates: any) {
    return this.attendanceService.update(id, updates);
  }

  @Delete(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bản ghi điểm danh' })
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }

  @Post(':id/approve')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt điểm danh' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveAttendanceDto,
    @Request() req: any,
  ) {
    return this.attendanceService.approve(id, dto, req.user._id || req.user.id);
  }

  @Post(':id/reject')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Từ chối điểm danh' })
  reject(
    @Param('id') id: string,
    @Body() dto: ApproveAttendanceDto,
    @Request() req: any,
  ) {
    return this.attendanceService.reject(id, dto, req.user._id || req.user.id);
  }

  @Post('batch-approve')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt hàng loạt điểm danh' })
  batchApprove(@Body() dto: BatchApproveDto, @Request() req: any) {
    return this.attendanceService.batchApprove(
      dto.ids,
      req.user._id || req.user.id,
    );
  }

  @Post('sync/:activityId')
  @UseGuards(checkPermission('ACTIVITY_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batch sync điểm danh đã duyệt → điểm rèn luyện' })
  @ApiQuery({ name: 'semester_id', required: true })
  batchSync(
    @Param('activityId') activityId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.syncService.batchSyncActivityAttendance(activityId, semesterId);
  }

  @Post(':id/retry-sync')
  @UseGuards(checkPermission('ACTIVITY_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry sync 1 bản ghi điểm danh → điểm rèn luyện' })
  retrySync(@Param('id') id: string) {
    return this.syncService.syncAttendanceToAcademicRecord(id);
  }
}
