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
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ClubAttendanceConfigService } from './club-attendance-config.service';
import {
  CreateAttendanceConfigDto,
  UpdateAttendanceConfigDto,
} from './dto/attendance-config.dto';

@ApiTags('Activity Attendance Config')
@Controller(['club-attendance-config', 'activity-attendance-config'])
export class ClubAttendanceConfigController {
  constructor(private readonly configService: ClubAttendanceConfigService) {}

  create(@Body() dto: CreateAttendanceConfigDto, @Request() req: any) {
    if (dto.activity_id && dto.club_id && dto.activity_id !== dto.club_id) {
      throw new BadRequestException('activity_id and club_id must be identical if both are provided');
    }
    if (dto.activity_id && !dto.club_id) {
      dto.club_id = dto.activity_id;
    }
    return this.configService.create(dto, req.user._id || req.user.id);
  }

  @Get()
  @UseGuards(checkPermission('CLUB_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách cấu hình' })
  @ApiQuery({ name: 'semester_id', required: false })
  findAll(@Query('semester_id') semesterId?: string) {
    return this.configService.findAll(semesterId);
  }

  @Get(['club/:clubId', 'activity/:clubId'])
  @UseGuards(checkPermission('CLUB_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cấu hình của CLB/Hoạt động cụ thể (fallback sang default)' })
  @ApiQuery({ name: 'semester_id', required: true })
  findByClub(
    @Param('clubId') clubId: string,
    @Query('semester_id') semesterId: string,
  ) {
    return this.configService.findByClub(clubId, semesterId);
  }

  @Get(':id')
  @UseGuards(checkPermission('CLUB_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết cấu hình' })
  findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('CLUB_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật cấu hình' })
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceConfigDto) {
    return this.configService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CLUB_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa cấu hình' })
  remove(@Param('id') id: string) {
    return this.configService.remove(id);
  }
}
