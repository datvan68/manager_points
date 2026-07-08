import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CheckinQrDto } from './dto/checkin-qr.dto';
import { CheckinProximityDto } from './dto/checkin-proximity.dto';

@ApiTags('Attendance Sessions')
@Controller('attendance-sessions')
export class AttendanceSessionsController {
  constructor(
    private readonly sessionsService: AttendanceSessionsService,
  ) {}

  @Post()
  @UseGuards(checkPermission('ATTENDANCE_SESSION_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mở phiên điểm danh mới (QR hoặc Proximity)' })
  openSession(@Body() dto: OpenSessionDto, @Request() req: any) {
    return this.sessionsService.openSession(
      dto,
      req.user._id || req.user.id,
    );
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy phiên điểm danh đang active theo context' })
  @ApiQuery({ name: 'context_type', required: true })
  @ApiQuery({ name: 'context_id', required: true })
  getActiveSession(
    @Query('context_type') contextType: string,
    @Query('context_id') contextId: string,
  ) {
    return this.sessionsService.getActiveSession(contextType, contextId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
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
  ) {
    return this.sessionsService.getSessionHistory(
      contextType,
      contextId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết phiên điểm danh' })
  getSessionById(@Param('id') id: string) {
    return this.sessionsService.getSessionById(id);
  }

  @Get(':id/qr')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy QR data hiện tại (admin polling)' })
  getQrData(@Param('id') id: string) {
    return this.sessionsService.getQrData(id);
  }

  @Post(':id/close')
  @UseGuards(checkPermission('ATTENDANCE_SESSION_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đóng phiên điểm danh' })
  closeSession(@Param('id') id: string, @Request() req: any) {
    return this.sessionsService.closeSession(
      id,
      req.user._id || req.user.id,
    );
  }

  @Post('checkin/qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check-in bằng QR code' })
  checkinQr(@Body() dto: CheckinQrDto, @Request() req: any) {
    const studentId = req.user.studentId || req.user._id;
    const userAgent = req.headers?.['user-agent'];
    return this.sessionsService.checkinQr(dto, studentId, userAgent);
  }

  @Post('checkin/proximity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check-in bằng proximity (GPS)' })
  checkinProximity(@Body() dto: CheckinProximityDto, @Request() req: any) {
    const studentId = req.user.studentId || req.user._id;
    const userAgent = req.headers?.['user-agent'];
    return this.sessionsService.checkinProximity(dto, studentId, userAgent);
  }

  @Get(':id/checkins')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách đã check-in trong phiên' })
  getCheckins(@Param('id') id: string) {
    return this.sessionsService.getCheckins(id);
  }
}
