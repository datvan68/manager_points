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
import { ActivitySchedulesService } from './activity-schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';

@ApiTags('Activity Schedules')
@Controller(['activity-schedules', 'club-schedules'])
export class ActivitySchedulesController {
  constructor(private readonly schedulesService: ActivitySchedulesService) {}

  @Post()
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo lịch sinh hoạt Hoạt động' })
  create(@Body() dto: CreateScheduleDto, @Request() req: any) {
    return this.schedulesService.create(dto, req.user._id || req.user.id);
  }

  @Get()
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách lịch sinh hoạt' })
  findAll(@Query() query: QueryScheduleDto) {
    return this.schedulesService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sinh hoạt đã đăng ký của sinh viên' })
  findMySchedules(@Request() req: any) {
    return this.schedulesService.findMySchedules(
      req.user.studentId || req.user._id,
    );
  }

  @Get('upcoming')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sinh hoạt sắp tới' })
  @ApiQuery({ name: 'activity_id', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findUpcoming(
    @Query('activity_id') activityId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.schedulesService.findUpcoming(activityId, limit ? +limit : 10);
  }

  @Get('activity/:activityId/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy timeline sinh hoạt của Hoạt động (tất cả các tuần đã lên lịch)' })
  findActivityTimeline(
    @Param('activityId') activityId: string,
    @Request() req: any,
  ) {
    return this.schedulesService.findActivityTimeline(activityId, req.user);
  }

  @Get(':id')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết buổi sinh hoạt' })
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật lịch sinh hoạt' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedulesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy buổi sinh hoạt' })
  @ApiQuery({ name: 'deleteSeries', required: false, type: Boolean })
  remove(
    @Param('id') id: string,
    @Query('deleteSeries') deleteSeries?: string,
  ) {
    return this.schedulesService.remove(id, deleteSeries === 'true');
  }

  @Post(':id/cancel-recurrence')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy chế độ lặp lại của chuỗi lịch sinh hoạt' })
  cancelRecurrence(@Param('id') id: string) {
    return this.schedulesService.cancelRecurrence(id);
  }

  @Post(':id/cancel-entire-recurrence')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy toàn bộ chuỗi lịch sinh hoạt lặp lại' })
  cancelEntireRecurrence(@Param('id') id: string) {
    return this.schedulesService.cancelEntireRecurrence(id);
  }


  // ── Registration ──

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký tham gia buổi sinh hoạt' })
  register(
    @Param('id') id: string,
    @Body('activity_id') activityId: string,
    @Request() req: any,
  ) {
    return this.schedulesService.register(
      id,
      req.user.studentId || req.user._id,
      activityId,
    );
  }

  @Post(':id/cancel-registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy đăng ký buổi sinh hoạt' })
  cancelRegistration(@Param('id') id: string, @Request() req: any) {
    return this.schedulesService.cancelRegistration(
      id,
      req.user.studentId || req.user._id,
    );
  }

  @Get(':id/registrations')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách sinh viên đã đăng ký' })
  getRegistrations(@Param('id') id: string) {
    return this.schedulesService.getRegistrations(id);
  }

  @Patch(':id/complete')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu buổi sinh hoạt hoàn thành' })
  markCompleted(@Param('id') id: string) {
    return this.schedulesService.markCompleted(id);
  }
}
