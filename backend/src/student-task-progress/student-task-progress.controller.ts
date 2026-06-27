import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { StudentTaskProgressService } from './student-task-progress.service';
import { GetProgressOverviewDto } from './dto/get-progress-overview.dto';
import { UpdateProgressStatusDto } from './dto/update-progress-status.dto';
import { LinkedTaskProgressEventDto, BulkLinkedTaskProgressEventDto } from './dto/linked-task-progress-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('student-tasks/progress')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentTaskProgressController {
  constructor(private readonly progressService: StudentTaskProgressService) {}

  @Post('access')
  markAccess(@Body() dto: { taskId: string, linkedPage?: string }, @Request() req: any) {
    return this.progressService.markAccess(dto.taskId, dto.linkedPage, req.user);
  }

  @Get('overview')
  // Cần quyền đọc task, nhưng chỉ những role quản lý (như nói ở taskscope) mới gọi API này
  // Frontend sẽ tự ẩn tab nếu không đủ quyền, backend chỉ check READ_STUDENT_TASK chung
  @Permissions('READ_STUDENT_TASK')
  getOverview(@Query() query: GetProgressOverviewDto, @Request() req: any) {
    return this.progressService.getOverview(query, req.user);
  }



  @Patch(':id/status')
  // Mọi user đều có thể gọi (student đổi trạng thái của họ, quản lý đổi thay). Logic phân quyền chi tiết nằm ở Service
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProgressStatusDto, @Request() req: any) {
    return this.progressService.updateStatus(id, dto, req.user);
  }

  @Post('backfill')
  @Permissions('UPDATE_STUDENT_TASK')
  async backfill() {
    return this.progressService.backfillAllTasks();
  }

  @Get(':progressId/teacher-detail')
  @Permissions('READ_STUDENT_TASK')
  getTeacherProgressDetail(@Param('progressId') progressId: string, @Request() req: any) {
    return this.progressService.getTeacherProgressDetail(progressId, req.user);
  }

  @Post('finalize-expired')
  @Permissions('UPDATE_STUDENT_TASK')
  async finalizeExpiredTasks() {
    return this.progressService.finalizeExpiredTaskProgress();
  }
}

