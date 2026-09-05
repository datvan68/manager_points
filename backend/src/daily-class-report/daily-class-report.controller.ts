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
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { DailyClassReportService } from './daily-class-report.service';
import { CreateDailyClassReportDto } from './dto/create-daily-class-report.dto';
import { UpdateDailyClassReportDto } from './dto/update-daily-class-report.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isAdminUser, isStudent } from '../auth/utils/role.util';

function checkDailyClassReportReadAccess(): Type<CanActivate> {
  @Injectable()
  class DailyClassReportReadGuard extends JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const authenticated = await super.canActivate(context);
      if (!authenticated) return false;
      const user = context.switchToHttp().getRequest().user;
      if (isAdminUser(user) || isStudent(user) || (user?.permissions || []).includes('READ_CLASS_RECORD')) return true;
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Thiếu quyền READ_CLASS_RECORD',
        requiredPermissions: ['READ_CLASS_RECORD'],
        missingPermissions: ['READ_CLASS_RECORD'],
      });
    }
  }
  return mixin(DailyClassReportReadGuard);
}

@ApiTags('Daily Class Reports')
@Controller('daily-class-reports')
export class DailyClassReportController {
  constructor(
    private readonly dailyClassReportService: DailyClassReportService,
  ) {}

  @Post()
  @UseGuards(checkPermission('CREATE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a new daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  create(
    @Body() createDailyClassReportDto: CreateDailyClassReportDto,
    @Request() req: any,
  ) {
    const requester = req.user;
    return this.dailyClassReportService.create(
      createDailyClassReportDto,
      requester,
    );
  }

  @Post('import')
  @UseGuards(checkPermission('CREATE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Validate or commit bulk import of daily class reports and student records',
  })
  importRecords(
    @Body() body: { rows: any[]; commit?: boolean },
    @Request() req: any,
  ) {
    const requester = req.user;
    const commit = body.commit === true;
    return this.dailyClassReportService.importClassRecords(
      body.rows,
      requester,
      commit,
    );
  }

  @Get()
  @UseGuards(checkDailyClassReportReadAccess())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all daily class reports' })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('classId') classId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const requester = req.user;
    return this.dailyClassReportService.findAll(
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        classId,
        startDate,
        endDate,
        search,
      },
      requester,
    );
  }

  @Get('deleted/all')
  @UseGuards(checkPermission('READ_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all soft-deleted daily class reports' })
  findDeleted(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    const requester = req.user;
    return this.dailyClassReportService.findDeleted(requester, {
      ...(page !== undefined ? { page: Number(page) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });
  }

  @Get(':id')
  @UseGuards(checkDailyClassReportReadAccess())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get daily class report by ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.findOne(id, requester);
  }

  @Get('class/:classId')
  @UseGuards(checkDailyClassReportReadAccess())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get daily class reports by Class ID' })
  findByClassId(@Param('classId') classId: string, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.findByClassId(classId, requester);
  }

  @Patch(':id')
  @UseGuards(checkPermission('UPDATE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  update(
    @Param('id') id: string,
    @Body() updateDailyClassReportDto: UpdateDailyClassReportDto,
    @Request() req: any,
  ) {
    const requester = req.user;
    return this.dailyClassReportService.update(
      id,
      updateDailyClassReportDto,
      requester,
    );
  }

  @Delete(':id')
  @UseGuards(checkPermission('DELETE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Delete daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.dailyClassReportService.remove(id, req.user);
  }

  @Patch(':id/restore')
  @UseGuards(checkPermission('UPDATE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Restore a soft-deleted daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  restore(@Param('id') id: string, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.restore(id, requester);
  }

  @Delete(':id/force')
  @UseGuards(checkPermission('DELETE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Permanently delete daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  forceRemove(@Param('id') id: string, @Request() req: any) {
    return this.dailyClassReportService.forceRemove(id, req.user);
  }

  @Post('bulk-delete')
  @UseGuards(checkPermission('DELETE_CLASS_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Bulk delete daily class reports (requires Admin, Teacher, or Supervisor role)',
  })
  bulkDelete(@Body() body: { ids: string[] }, @Request() req: any) {
    return this.dailyClassReportService.bulkRemove(body.ids, req.user);
  }
}
