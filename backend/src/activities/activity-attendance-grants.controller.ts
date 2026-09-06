import { Body, Controller, Delete, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ActivityAttendanceGrantsService } from './activity-attendance-grants.service';
import { UpsertActivityAttendanceGrantDto } from './dto/activity-attendance-grant.dto';

@ApiTags('Activity attendance grants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities/:activityId/attendance')
export class ActivityAttendanceGrantsController {
  constructor(private readonly grants: ActivityAttendanceGrantsService) {}

  @Get('grant-candidates') candidates(@Param('activityId') id: string, @Request() req: any) {
    return this.grants.candidates(id, req.user);
  }
  @Get('grants') list(@Param('activityId') id: string, @Request() req: any) {
    return this.grants.list(id, req.user);
  }
  @Put('grants')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_UPDATE'))
  upsert(@Param('activityId') id: string, @Body() dto: UpsertActivityAttendanceGrantDto, @Request() req: any) {
    return this.grants.upsert(id, dto.teacher_id, dto.allowed_methods, req.user);
  }
  @Delete('grants/:teacherId')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_UPDATE'))
  revoke(@Param('activityId') id: string, @Param('teacherId') teacherId: string, @Request() req: any) {
    return this.grants.revoke(id, teacherId, req.user);
  }
  @Get('capabilities')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  capabilities(@Param('activityId') id: string, @Request() req: any) {
    return this.grants.capabilities(id, req.user);
  }
}
