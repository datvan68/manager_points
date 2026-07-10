import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ActivityCompletionService } from './activity-completion.service';
import {
  CreateActivityCompletionRuleDto,
  UpdateActivityCompletionRuleDto,
} from './dto/activity-completion-rule.dto';

@ApiTags('Activity Completion Rules')
@Controller(['activity-completion-rules', 'club-completion-rules'])
export class ActivityCompletionController {
  constructor(
    private readonly activityCompletionService: ActivityCompletionService,
  ) {}

  @Post()
  @UseGuards(checkPermission('CLUB_ATTENDANCE_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo quy tắc hoàn thành hoạt động mới' })
  createRule(@Body() dto: CreateActivityCompletionRuleDto) {
    return this.activityCompletionService.createRule(dto);
  }

  @Get()
  @UseGuards(checkPermission('CLUB_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách tất cả quy tắc hoàn thành hoạt động' })
  findAllRules() {
    return this.activityCompletionService.findAllRules();
  }

  @Get(':id')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết quy tắc hoàn thành hoạt động' })
  findOneRule(@Param('id') id: string) {
    return this.activityCompletionService.findOneRule(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật quy tắc hoàn thành hoạt động' })
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateActivityCompletionRuleDto,
  ) {
    return this.activityCompletionService.updateRule(id, dto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CLUB_ATTENDANCE_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa quy tắc hoàn thành hoạt động' })
  removeRule(@Param('id') id: string) {
    return this.activityCompletionService.removeRule(id);
  }
}
