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
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ActivityAttendanceConfigService } from './activity-attendance-config.service';
import {
  CreateAttendanceConfigDto,
  UpdateAttendanceConfigDto,
} from './dto/attendance-config.dto';

@ApiTags('Activity Attendance Config')
@Controller('activity-attendance-config')
export class ActivityAttendanceConfigController {
  constructor(private readonly configService: ActivityAttendanceConfigService) {}

  @Post()
  @UseGuards(checkPermission('ACTIVITY_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo cấu hình điểm danh → điểm rèn luyện' })
  create(@Body() dto: CreateAttendanceConfigDto, @Request() req: any) {
    return this.configService.create(dto, req.user._id || req.user.id);
  }

  @Get()
  @UseGuards(checkPermission('ACTIVITY_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách cấu hình' })
  @ApiQuery({ name: 'semester_id', required: false })
  findAll(@Query('semester_id') semesterId?: string) {
    return this.configService.findAll(semesterId);
  }

  @Get('activity/:activityId')
  @UseGuards(checkPermission('ACTIVITY_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cấu hình của Hoạt động/Hoạt động cụ thể (fallback sang default)' })
  @ApiQuery({ name: 'semester_id', required: true })
  findByActivity(
    @Param('activityId') activityId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.configService.findByActivity(activityId, semesterId);
  }

  @Get(':id')
  @UseGuards(checkPermission('ACTIVITY_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết cấu hình' })
  findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('ACTIVITY_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật cấu hình' })
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceConfigDto) {
    return this.configService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('ACTIVITY_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa cấu hình' })
  remove(@Param('id') id: string) {
    return this.configService.remove(id);
  }
}
