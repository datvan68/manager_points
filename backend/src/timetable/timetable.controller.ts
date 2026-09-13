import { BadGatewayException, BadRequestException, CanActivate, Controller, ExecutionContext, ForbiddenException, GatewayTimeoutException, Get, Injectable, Optional, Patch, Post, Body, Query, Req, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryTimetableDto, QueryTimetableOptionsDto } from './dto/query-timetable.dto';
import { TimetableService } from './timetable.service';
import { TimetableSourceError } from './timetable.types';
import { StartTimetableSyncDto, TimetableDemandDto, TimetableSettingsDto, SavedTimetableClassSyncDto } from './dto/sync-timetable.dto';
import { TimetableSyncService } from './timetable-sync.service';

@Injectable()
export class TimetableAccessGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;
    const user = context.switchToHttp().getRequest().user;
    const roleCode = String(user?.roleCode || '').toUpperCase();
    const roleName = String(user?.roleName || '').toLowerCase();
    if (roleCode) {
      if (['STUDENT', 'ADMIN', 'TEACHER'].includes(roleCode)) return true;
    } else if (
      ['student', 'sinh viên', 'sinh vien', 'học sinh', 'hoc sinh', 'hssv'].some((value) => roleName.includes(value)) ||
      ['admin', 'teacher', 'giáo viên', 'giao vien', 'giảng viên', 'giang vien'].includes(roleName.trim())
    ) {
      return true;
    }
    throw new ForbiddenException('Chỉ tài khoản HSSV, Admin hoặc Giáo viên được tra cứu thời khóa biểu.');
  }
}

@Injectable()
export class TimetableAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (String(user?.roleCode || '').toUpperCase() === 'ADMIN') return true;
    throw new ForbiddenException('Chỉ quản trị viên mới được đồng bộ thời khóa biểu.');
  }
}

function mapTimetableSourceError(error: unknown): never {
  if (!(error instanceof TimetableSourceError)) throw error;
  const response = { reasonCode: error.code, message: error.message };
  switch (error.code) {
    case 'SOURCE_INVALID_SELECTION': throw new BadRequestException(response);
    case 'SOURCE_SESSION_EXPIRED': throw new UnauthorizedException(response);
    case 'SOURCE_TIMEOUT': throw new GatewayTimeoutException(response);
    case 'SOURCE_MARKUP_CHANGED': throw new BadGatewayException(response);
    case 'SOURCE_NOT_CONFIGURED':
    case 'SOURCE_UNAVAILABLE':
    default: throw new ServiceUnavailableException(response);
  }
}

@Controller('timetable')
@UseGuards(TimetableAccessGuard)
export class TimetableController {
  constructor(private readonly service: TimetableService, @Optional() private readonly syncService?: TimetableSyncService) {}
  @Post('sync/catalog') @UseGuards(TimetableAdminGuard)
  async loadCatalog(@Req() req: any, @Query() query: QueryTimetableOptionsDto) {
    try { return await this.syncService!.loadCatalog(req.user, query); }
    catch (error) { return mapTimetableSourceError(error); }
  }
  @Post('sync') @UseGuards(TimetableAdminGuard) startSync(@Req() req: any, @Body() body: StartTimetableSyncDto) { return this.syncService!.start(req.user, body); }
  @Post('sync/class') @UseGuards(TimetableAdminGuard) startSavedClassSync(@Req() req: any, @Body() body: SavedTimetableClassSyncDto) { return this.syncService!.startSavedClass(req.user, body); }
  @Get('sync/status') @UseGuards(TimetableAdminGuard) getSyncStatus(@Req() req: any) { return this.syncService!.getStatus(req.user); }
  @Get('sync/settings') @UseGuards(TimetableAdminGuard) getSyncSettings(@Req() req: any) { return this.syncService!.getSettings(req.user); }
  @Patch('sync/settings') @UseGuards(TimetableAdminGuard) updateSyncSettings(@Req() req: any, @Body() body: TimetableSettingsDto) { return this.syncService!.updateSettings(req.user, body); }
  @Post('demand') async demand(@Req() req: any, @Body() body: TimetableDemandDto) {
    try { return await this.service.getTimetable(req.user, body); } catch (error) { return mapTimetableSourceError(error); }
  }
  @Get('demand/status') async demandStatus(@Req() req: any, @Query() query: QueryTimetableDto) {
    try { return await this.service.getDemandStatus(req.user, query); } catch (error) { return mapTimetableSourceError(error); }
  }
  @Post('refresh') async refresh(@Req() req: any, @Body() body: QueryTimetableDto) {
    try { return await this.service.refresh(req.user, body); } catch (error) { return mapTimetableSourceError(error); }
  }
  @Get('options') async getOptions(@Req() req: any, @Query() query: QueryTimetableOptionsDto) {
    try { return await this.service.getOptions(req.user, query); } catch (error) { return mapTimetableSourceError(error); }
  }
  @Get() async getTimetable(@Req() req: any, @Query() query: QueryTimetableDto) {
    try { return await this.service.getLegacyTimetable(req.user, query); } catch (error) { return mapTimetableSourceError(error); }
  }
}
