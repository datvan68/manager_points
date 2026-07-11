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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ClubAttendanceService } from './club-attendance.service';
import { ClubAttendanceSyncService } from './club-attendance-sync.service';
import {
  CreateAttendanceDto,
  BatchAttendanceDto,
  ApproveAttendanceDto,
  BatchApproveDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('Activity Attendance')
@Controller(['club-attendance', 'activity-attendance'])
export class ClubAttendanceController {
  constructor(
    private readonly attendanceService: ClubAttendanceService,
    private readonly syncService: ClubAttendanceSyncService,
  ) {}

  @Post()
  @UseGuards(checkPermission('CLUB_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ghi nhận điểm danh sinh viên' })
  create(@Body() dto: CreateAttendanceDto, @Request() req: any) {
    if (dto.activity_id && dto.club_id && dto.activity_id !== dto.club_id) {
      throw new BadRequestException('activity_id and club_id must be identical if both are provided');
    }
    if (dto.activity_id && !dto.club_id) {
      dto.club_id = dto.activity_id;
    }
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
  @UseGuards(checkPermission('CLUB_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Điểm danh hàng loạt (GV điểm danh cả lớp CLB)' })
  batchCreate(@Body() dto: BatchAttendanceDto, @Request() req: any) {
    if (dto.activity_id && dto.club_id && dto.activity_id !== dto.club_id) {
      throw new BadRequestException('activity_id and club_id must be identical if both are provided');
    }
    if (dto.activity_id && !dto.club_id) {
      dto.club_id = dto.activity_id;
    }
    return this.attendanceService.batchCreate(
      dto,
      req.user._id || req.user.id,
      'teacher',
    );
  }

  @Get()
  @UseGuards(checkPermission('CLUB_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách điểm danh' })
  findAll(@Query() query: QueryAttendanceDto) {
    if (query.activity_id && query.club_id && query.activity_id !== query.club_id) {
      throw new BadRequestException('activity_id and club_id must be identical if both are provided');
    }
    if (query.activity_id && !query.club_id) {
      query.club_id = query.activity_id;
    }
    return this.attendanceService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sử điểm danh cá nhân' })
  @ApiQuery({ name: 'semester_id', required: false })
  @ApiQuery({ name: 'club_id', required: false })
  @ApiQuery({ name: 'activity_id', required: false })
  findMyAttendance(
    @Request() req: any,
    @Query('semester_id') semesterId?: string,
    @Query('club_id') clubId?: string,
    @Query('activity_id') activityId?: string,
  ) {
    if (activityId && clubId && activityId !== clubId) {
      throw new BadRequestException('activity_id and club_id must be identical if both are provided');
    }
    const resolvedClubId = activityId || clubId;
    return this.attendanceService.findMyAttendance(
      req.user.studentId || req.user._id,
      semesterId,
      resolvedClubId,
    );
  }

  @Get('pending-count')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Số lượng điểm danh chờ duyệt' })
  @ApiQuery({ name: 'club_id', required: false })
  @ApiQuery({ name: 'activity_id', required: false })
  getPendingCount(
    @Query('club_id') clubId?: string,
    @Query('activity_id') activityId?: string,
  ) {
    if (activityId && clubId && activityId !== clubId) {
      throw new BadRequestException('activity_id and club_id must be identical if both are provided');
    }
    const resolvedClubId = activityId || clubId;
    return this.attendanceService.getPendingCount(resolvedClubId);
  }

  @Get('summary/:clubId')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê tổng hợp điểm danh CLB' })
  @ApiQuery({ name: 'semester_id', required: true })
  getSummary(
    @Param('clubId') clubId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.attendanceService.getSummary(clubId, semesterId);
  }

  @Get(':id')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết bản ghi điểm danh' })
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật điểm danh' })
  update(@Param('id') id: string, @Body() updates: any) {
    return this.attendanceService.update(id, updates);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bản ghi điểm danh' })
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }

  @Post(':id/approve')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_APPROVE'))
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
  @UseGuards(checkPermission('CLUB_ATTENDANCE_APPROVE'))
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
  @UseGuards(checkPermission('CLUB_ATTENDANCE_APPROVE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt hàng loạt điểm danh' })
  batchApprove(@Body() dto: BatchApproveDto, @Request() req: any) {
    return this.attendanceService.batchApprove(
      dto.ids,
      req.user._id || req.user.id,
    );
  }

  @Post('sync/:clubId')
  @UseGuards(checkPermission('CLUB_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batch sync điểm danh đã duyệt → điểm rèn luyện' })
  @ApiQuery({ name: 'semester_id', required: true })
  batchSync(
    @Param('clubId') clubId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.syncService.batchSyncClubAttendance(clubId, semesterId);
  }

  @Post(':id/retry-sync')
  @UseGuards(checkPermission('CLUB_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry sync 1 bản ghi điểm danh → điểm rèn luyện' })
  retrySync(@Param('id') id: string) {
    return this.syncService.syncAttendanceToAcademicRecord(id);
  }
}
