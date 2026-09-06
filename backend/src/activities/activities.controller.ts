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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import {
  checkPermission,
  checkAnyPermission,
} from '../auth/guards/check-permission.guard';
import { ActivitiesService } from './activities.service';
import { ActivitiesRealtimeService } from './activities-realtime.service';
import { StorageService } from '../core/storage/storage.service';
import { ImageProcessorService } from '../core/storage/image-processor.service';
import { ImagePreset } from '../core/storage/storage.interface';
import type { Response } from 'express';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import {
  AddActivityMemberDto,
  UpdateActivityMemberDto,
  ApproveMemberDto,
  JoinActivityDto,
  LeaveActivityDto,
  SwitchActivityDto,
  AdminTransferActivityDto,
  BulkDeleteActivityMembersDto,
} from './dto/activity-member.dto';

@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly realtime: ActivitiesRealtimeService,
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  @Get('realtime')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  realtimeStream(@Res() response: Response) { this.realtime.connect(response); }

  @Post()
  @UseGuards(checkPermission('ACTIVITY_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo câu lạc bộ mới' })
  create(@Body() dto: CreateActivityDto, @Request() req: any) {
    return this.activitiesService.create(
      dto,
      req.user.userId || req.user._id || req.user.id,
      req.user,
    );
  }

  @Post('media/upload')
  @UseGuards(checkAnyPermission('ACTIVITY_CREATE', 'ACTIVITY_UPDATE'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload cover, logo hoặc frame cho câu lạc bộ' })
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') bodyKind?: 'cover' | 'logo' | 'frame',
    @Query('kind') queryKind?: 'cover' | 'logo' | 'frame',
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file hợp lệ');
    }
    const kind = bodyKind || queryKind || 'cover';

    let preset: ImagePreset = 'activity_cover';
    let subfolder = 'covers';

    if (kind === 'logo') {
      preset = 'activity_logo';
      subfolder = 'logos';
    } else if (kind === 'frame') {
      preset = 'activity_frame';
      subfolder = 'frames';
    }

    const processed = await this.imageProcessor.processImage(file.buffer, preset);
    const meta = await this.storageService.saveBuffer(processed.buffer, {
      namespace: 'activities',
      subfolder,
      visibility: 'public',
      contentType: processed.mime_type,
      width: processed.width,
      height: processed.height,
    });

    return {
      url: meta.url,
      file_name: meta.filename,
      mime_type: meta.mime_type,
      size: meta.size,
      kind,
    };
  }

  @Get()
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách tất cả câu lạc bộ' })
  findAll(
    @Request() req: any,
    @Query('activity_type') activityType?: string,
    @Query('activityType') activityTypeCamel?: string,
  ) {
    let type = activityType || activityTypeCamel;
    return this.activitiesService.findAll(req.user, type);
  }

  @Get('my')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hoạt động của sinh viên đang đăng nhập' })
  getMyActivities(@Request() req: any) {
    const studentIdOrUserId =
      req.user.studentId || req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.getMyActivities(studentIdOrUserId);
  }

  @Get('my/transfer-policy')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chính sách chuyển câu lạc bộ của tôi' })
  getMyTransferPolicy(
    @Query('semester_id') semester_id: string,
    @Request() req: any
  ) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.getMyTransferPolicy(userId, semester_id);
  }

  @Get('favorites/me')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách ID câu lạc bộ đã yêu thích của tôi' })
  getMyFavoriteActivityIds(@Request() req: any) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.getMyFavoriteActivityIds(userId);
  }

  @Post(':id/favorite')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yêu thích câu lạc bộ' })
  favoriteActivity(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.favoriteActivity(id, userId);
  }

  @Delete(':id/favorite')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy yêu thích câu lạc bộ' })
  unfavoriteActivity(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.unfavoriteActivity(id, userId);
  }

  @Get(':id')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết câu lạc bộ' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.activitiesService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(checkPermission('ACTIVITY_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin Hoạt động' })
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto, @Request() req: any) {
    return this.activitiesService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('ACTIVITY_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vô hiệu hóa Hoạt động (soft delete)' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.activitiesService.remove(id, req.user);
  }

  // ── Member endpoints ──

  @Get(':id/members')
  @UseGuards(checkPermission('ACTIVITY_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách thành viên Hoạt động' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'semester_id', required: false })
  findMembers(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('semester_id') semester_id?: string,
    @Request() req?: any,
  ) {
    return this.activitiesService.findMembers(id, { status, semester_id }, req?.user);
  }

  @Post(':id/members')
  @UseGuards(checkPermission('ACTIVITY_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm thành viên vào Hoạt động' })
  addMember(@Param('id') id: string, @Body() dto: AddActivityMemberDto, @Request() req: any) {
    return this.activitiesService.addMember(id, dto, req.user);
  }

  @Post(':id/join')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sinh viên tự đăng ký tham gia Hoạt động' })
  joinActivity(
    @Param('id') id: string,
    @Body() dto: JoinActivityDto,
    @Request() req: any,
  ) {
    const studentId = req.user.studentId || req.user.userId || req.user._id;
    return this.activitiesService.joinActivity(id, studentId, dto);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(checkPermission('ACTIVITY_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật vai trò/trạng thái thành viên' })
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateActivityMemberDto,
    @Request() req: any,
  ) {
    return this.activitiesService.updateMember(id, memberId, dto, req.user);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(checkPermission('ACTIVITY_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa thành viên khỏi Hoạt động' })
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string, @Request() req: any) {
    return this.activitiesService.removeMember(id, memberId, req.user);
  }

  @Post(':id/members/batch-delete')
  @UseGuards(checkPermission('ACTIVITY_MEMBER_MANAGE'))
  @ApiBearerAuth()
  bulkRemoveMembers(@Param('id') id: string, @Body() dto: BulkDeleteActivityMembersDto, @Request() req: any) {
    return this.activitiesService.removeMembers(id, dto.member_ids, req.user);
  }

  @Post(':id/members/:memberId/approve')
  @UseGuards(checkPermission('ACTIVITY_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt/từ chối đăng ký thành viên' })
  approveMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: ApproveMemberDto,
    @Request() req: any,
  ) {
    return this.activitiesService.approveMember(
      id,
      memberId,
      dto,
      req.user.userId || req.user._id || req.user.id,
    );
  }

  @Post(':id/leave')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sinh viên tự rời câu lạc bộ' })
  leaveActivity(
    @Param('id') id: string,
    @Body() dto: LeaveActivityDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.leaveActivity(id, userId, dto);
  }

  @Post(':id/switch')
  @UseGuards(checkPermission('ACTIVITY_SCHEDULE_REGISTER'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sinh viên tự chuyển đổi sang câu lạc bộ khác' })
  switchActivity(
    @Param('id') targetActivityId: string,
    @Body() dto: SwitchActivityDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.switchActivity(targetActivityId, userId, dto);
  }

  @Post(':id/admin-transfer')
  @UseGuards(checkPermission('ACTIVITY_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản trị viên chuyển trực tiếp sinh viên sang Hoạt động khác' })
  adminTransferActivity(
    @Param('id') targetActivityId: string,
    @Body() dto: AdminTransferActivityDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.activitiesService.adminTransferActivity(targetActivityId, userId, dto);
  }

  @Get(':id/stats')
  @UseGuards(checkPermission('ACTIVITY_REPORT_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê Hoạt động' })
  getActivityStats(@Param('id') id: string) {
    return this.activitiesService.getActivityStats(id);
  }
}
