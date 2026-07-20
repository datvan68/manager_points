import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Sse,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkRole } from '../auth/guards/check-role.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsRealtimeService } from './notifications-realtime.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService, private readonly realtimeService: NotificationsRealtimeService) {}

  @Sse('realtime')
  realtime() {
    return this.realtimeService.getStream();
  }

  @Post()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiOperation({ summary: 'Tạo thông báo mới' })
  create(@Body() createDto: CreateNotificationDto, @Req() req: any) {
    return this.notificationsService.create(createDto, req.user?.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo có phân trang và bộ lọc' })
  findAll(@Query() query: QueryNotificationDto, @Req() req: any) {
    return this.notificationsService.findAll(
      query,
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc của user' })
  getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Get('count-summary')
  @ApiOperation({
    summary: 'Lấy thống kê số lượng thông báo theo từng loại bộ lọc',
  })
  getCountSummary(@Req() req: any) {
    return this.notificationsService.getCountSummary(
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu đã đọc tất cả thông báo của user' })
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc một thông báo' })
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markRead(
      id,
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Patch(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiOperation({ summary: 'Cập nhật thông tin thông báo' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateNotificationDto,
    @Req() req: any,
  ) {
    return this.notificationsService.update(
      id,
      updateDto,
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Delete(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiOperation({ summary: 'Xóa thông báo (soft delete)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.remove(
      id,
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Post('delete-bulk')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiOperation({ summary: 'Xóa nhiều thông báo (soft delete)' })
  removeBulk(@Body('ids') ids: string[], @Req() req: any) {
    return this.notificationsService.removeBulk(
      ids,
      req.user?.userId,
      req.user?.roleName,
    );
  }

  @Get(':id/readers')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiOperation({ summary: 'Lấy danh sách người đã xem thông báo' })
  getReaders(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.getReaders(
      id,
      req.user?.userId,
      req.user?.roleName,
    );
  }
}
