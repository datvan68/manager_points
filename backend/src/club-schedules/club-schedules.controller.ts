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
import { ClubSchedulesService } from './club-schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';

@ApiTags('Club Schedules')
@Controller(['club-schedules', 'activity-schedules'])
export class ClubSchedulesController {
  constructor(private readonly schedulesService: ClubSchedulesService) {}

  @Post()
  @UseGuards(checkPermission('CLUB_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo lịch sinh hoạt CLB' })
  create(@Body() dto: CreateScheduleDto, @Request() req: any) {
    return this.schedulesService.create(dto, req.user._id || req.user.id);
  }

  @Get()
  @UseGuards(checkPermission('CLUB_SCHEDULE_READ'))
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
  @UseGuards(checkPermission('CLUB_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lịch sinh hoạt sắp tới' })
  @ApiQuery({ name: 'club_id', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findUpcoming(
    @Query('club_id') clubId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.schedulesService.findUpcoming(clubId, limit ? +limit : 10);
  }

  @Get('club/:clubId/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy timeline sinh hoạt của CLB' })
  findClubTimeline(
    @Param('clubId') clubId: string,
    @Request() req: any,
  ) {
    return this.schedulesService.findClubTimeline(clubId, req.user);
  }

  @Get(':id')
  @UseGuards(checkPermission('CLUB_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết buổi sinh hoạt' })
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('CLUB_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật lịch sinh hoạt' })
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedulesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CLUB_SCHEDULE_MANAGE'))
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
  @UseGuards(checkPermission('CLUB_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy chế độ lặp lại của chuỗi lịch sinh hoạt' })
  cancelRecurrence(@Param('id') id: string) {
    return this.schedulesService.cancelRecurrence(id);
  }


  // ── Registration ──

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký tham gia buổi sinh hoạt' })
  register(
    @Param('id') id: string,
    @Body('club_id') clubId: string,
    @Request() req: any,
  ) {
    return this.schedulesService.register(
      id,
      req.user.studentId || req.user._id,
      clubId,
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
  @UseGuards(checkPermission('CLUB_SCHEDULE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách sinh viên đã đăng ký' })
  getRegistrations(@Param('id') id: string) {
    return this.schedulesService.getRegistrations(id);
  }

  @Patch(':id/complete')
  @UseGuards(checkPermission('CLUB_SCHEDULE_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu buổi sinh hoạt hoàn thành' })
  markCompleted(@Param('id') id: string) {
    return this.schedulesService.markCompleted(id);
  }
}
