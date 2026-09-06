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
import { ActivityAttendanceService } from './activity-attendance.service';
import { ActivityAttendanceSyncService } from './activity-attendance-sync.service';
import {
  CreateAttendanceDto,
  BatchAttendanceDto,
  ApproveAttendanceDto,
  BatchApproveDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('Activity Attendance')
@Controller('activity-attendance')
export class ActivityAttendanceController {
  constructor(
    private readonly attendanceService: ActivityAttendanceService,
    private readonly syncService: ActivityAttendanceSyncService,
  ) {}

  private requesterId(user: any): string {
    return user?.userId || user?._id || user?.id;
  }

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
      this.requesterId(req.user),
      mappedRole,
      req.user,
    );
  }

  @Post('batch')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Điểm danh hàng loạt (GV điểm danh cả lớp Hoạt động)' })
  batchCreate(@Body() dto: BatchAttendanceDto, @Request() req: any) {
    return this.attendanceService.batchCreate(
      dto,
      this.requesterId(req.user),
      'teacher',
      req.user,
    );
  }

  @Get('export')
  @UseGuards(checkPermission('ACTIVITY_EXPORT'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xác nhận quyền xuất dữ liệu điểm danh' })
  authorizeExport() {
    return { authorized: true };
  }

  @Get()
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách điểm danh' })
  findAll(@Query() query: QueryAttendanceDto, @Request() req: any) {
    return this.attendanceService.findAll(query, req.user);
  }

  @Get('my')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
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
      req.user,
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
    @Request() req: any,
    @Query('activity_id') activityId?: string,
  ) {
    return this.attendanceService.getPendingCount(activityId, req?.user);
  }

  @Get('summary/:activityId')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê tổng hợp điểm danh Hoạt động' })
  @ApiQuery({ name: 'semester_id', required: true })
  getSummary(
    @Param('activityId') activityId: string,
    @Query('semester_id') semesterId: string,
    @Request() req: any,
  ) {
    return this.attendanceService.getSummary(activityId, semesterId, req.user);
  }

  @Get(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết bản ghi điểm danh' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.attendanceService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật điểm danh' })
  update(@Param('id') id: string, @Body() updates: any, @Request() req: any) {
    return this.attendanceService.update(id, updates, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bản ghi điểm danh' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.attendanceService.remove(id, req.user);
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
    return this.attendanceService.approve(id, dto, this.requesterId(req.user), req.user);
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
    return this.attendanceService.reject(id, dto, this.requesterId(req.user), req.user);
  }

  @Post('batch-approve')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt hàng loạt điểm danh' })
  batchApprove(@Body() dto: BatchApproveDto, @Request() req: any) {
    return this.attendanceService.batchApprove(
      dto.ids,
      this.requesterId(req.user),
      req.user,
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
