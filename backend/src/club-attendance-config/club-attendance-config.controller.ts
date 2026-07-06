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
import { ClubAttendanceConfigService } from './club-attendance-config.service';
import {
  CreateAttendanceConfigDto,
  UpdateAttendanceConfigDto,
} from './dto/attendance-config.dto';

@ApiTags('Club Attendance Config')
@Controller('club-attendance-config')
export class ClubAttendanceConfigController {
  constructor(private readonly configService: ClubAttendanceConfigService) {}

  @Post()
  @UseGuards(checkPermission('CLUB_CONFIG_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo cấu hình điểm danh → điểm rèn luyện' })
  create(@Body() dto: CreateAttendanceConfigDto, @Request() req: any) {
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

  @Get('club/:clubId')
  @UseGuards(checkPermission('CLUB_CONFIG_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cấu hình của CLB cụ thể (fallback sang default)' })
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
