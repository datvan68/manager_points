import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ActivityCompletionService } from './activity-completion.service';
import {
  CreateActivityCompletionRuleDto,
  UpdateActivityCompletionRuleDto,
} from './dto/activity-completion-rule.dto';

@ApiTags('Activity Completion Rules')
@Controller('activity-completion-rules')
export class ActivityCompletionController {
  constructor(
    private readonly activityCompletionService: ActivityCompletionService,
  ) {}

  @Post()
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo quy tắc hoàn thành hoạt động mới' })
  createRule(@Body() dto: CreateActivityCompletionRuleDto, @Request() req: any) {
    return this.activityCompletionService.createRule(dto, req.user);
  }

  @Get()
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách tất cả quy tắc hoàn thành hoạt động' })
  findAllRules(@Request() req: any) {
    return this.activityCompletionService.findAllRules(req.user);
  }

  @Get('activity/:activityId/progress')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  getProgress(@Param('activityId') activityId: string, @Query('semester_id') semesterId: string, @Request() req: any) {
    return this.activityCompletionService.getMemberProgress(activityId, semesterId, req.user);
  }

  @Post('activity/:activityId/members/:memberId/reset')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_UPDATE'))
  resetProgress(@Param('activityId') activityId: string, @Param('memberId') memberId: string, @Body('semester_id') semesterId: string, @Request() req: any) {
    return this.activityCompletionService.resetMemberProgress(activityId, semesterId, memberId, req.user);
  }

  @Get(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết quy tắc hoàn thành hoạt động' })
  findOneRule(@Param('id') id: string, @Request() req: any) {
    return this.activityCompletionService.findOneRule(id, req.user);
  }

  @Patch(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật quy tắc hoàn thành hoạt động' })
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateActivityCompletionRuleDto,
    @Request() req: any,
  ) {
    return this.activityCompletionService.updateRule(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('ACTIVITY_ATTENDANCE_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa quy tắc hoàn thành hoạt động' })
  removeRule(@Param('id') id: string, @Request() req: any) {
    return this.activityCompletionService.removeRule(id, req.user);
  }
}
