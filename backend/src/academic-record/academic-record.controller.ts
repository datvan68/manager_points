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
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { AcademicRecordService } from './academic-record.service';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { BulkCreateAcademicRecordDto } from './dto/bulk-create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import {
  ImportAcademicRecordRequestDto,
  ImportAcademicRecordCommitDto,
  ImportAcademicRecordPreviewResultDto,
  ImportAcademicRecordCommitResultDto,
  ImportAcademicRecordProgressDto,
} from './dto/import-academic-record.dto';
import { IntentScoreDto } from './dto/intent-score.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isAdminUser, isStudent } from '../auth/utils/role.util';

function checkAcademicRecordReadAccess(): Type<CanActivate> {
  @Injectable()
  class AcademicRecordReadGuard extends JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const isAuthenticated = await super.canActivate(context);
      if (!isAuthenticated) return false;

      const user = context.switchToHttp().getRequest().user;
      if (!user) throw new ForbiddenException('Không thể xác thực người dùng');
      if (isAdminUser(user) || isStudent(user)) return true;
      if ((user.permissions || []).includes('READ_STUDENT_RECORD')) return true;

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Bạn không có quyền thực hiện hành động này. Thiếu quyền: READ_STUDENT_RECORD',
        requiredPermissions: ['READ_STUDENT_RECORD'],
        missingPermissions: ['READ_STUDENT_RECORD'],
      });
    }
  }

  return mixin(AcademicRecordReadGuard);
}

function checkAcademicRecordSelfServiceOrPermission(
  ...requiredPermissions: string[]
): Type<CanActivate> {
  @Injectable()
  class AcademicRecordActionGuard extends JwtAuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const isAuthenticated = await super.canActivate(context);
      if (!isAuthenticated) return false;

      const user = context.switchToHttp().getRequest().user;
      if (!user) throw new ForbiddenException('Không thể xác thực người dùng');
      if (isAdminUser(user) || isStudent(user)) return true;
      if (requiredPermissions.some((permission) => (user.permissions || []).includes(permission))) {
        return true;
      }

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: `Bạn không có quyền thực hiện hành động này. Thiếu quyền: ${requiredPermissions.join(', ')}`,
        requiredPermissions,
      });
    }
  }

  return mixin(AcademicRecordActionGuard);
}

@ApiTags('Academic Records')
@Controller('academic-records')
export class AcademicRecordController {
  constructor(private readonly academicRecordService: AcademicRecordService) {}

  @Post()
  @UseGuards(checkPermission('CREATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a new academic record (requires Admin, Teacher, or Supervisor role)',
  })
  create(
    @Body() createAcademicRecordDto: CreateAcademicRecordDto,
    @Request() req: any,
  ) {
    const requester = req.user;
    return this.academicRecordService.create(
      createAcademicRecordDto,
      requester,
    );
  }

  @Post('intent')
  @UseGuards(checkAcademicRecordSelfServiceOrPermission('CREATE_STUDENT_RECORD', 'UPDATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Xử lý ý định thao tác điểm (tăng/giảm đếm, chọn option, nhập điểm tay)',
  })
  @ApiBody({ type: IntentScoreDto })
  async handleIntent(@Body() intentDto: IntentScoreDto, @Request() req: any) {
    const requester = req.user;
    return this.academicRecordService.handleScoreIntent(intentDto, requester);
  }

  @Post('bulk')
  @UseGuards(checkPermission('CREATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Bulk create academic records (requires Admin, Teacher, or Supervisor role)',
  })
  @ApiBody({ type: BulkCreateAcademicRecordDto })
  bulkCreate(
    @Body() bulkCreateDto: BulkCreateAcademicRecordDto,
    @Request() req: any,
  ) {
    const requester = req.user;
    return this.academicRecordService.bulkCreate(bulkCreateDto, requester);
  }

  @Post('import/preview')
  @UseGuards(checkPermission('CREATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview and validate bulk import of student academic records',
  })
  @ApiBody({ type: ImportAcademicRecordRequestDto })
  async importPreview(
    @Body() body: ImportAcademicRecordRequestDto,
    @Request() req: any,
  ): Promise<ImportAcademicRecordPreviewResultDto> {
    const requester = req.user;
    return this.academicRecordService.importPreview(body.rows, requester);
  }

  @Post('import/commit')
  @UseGuards(checkPermission('CREATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Commit bulk import of student academic records' })
  @ApiBody({ type: ImportAcademicRecordCommitDto })
  async importCommit(
    @Body() body: ImportAcademicRecordCommitDto,
    @Request() req: any,
  ): Promise<ImportAcademicRecordCommitResultDto> {
    const requester = req.user;
    return this.academicRecordService.importCommit(body.sessionId, requester);
  }

  @Get('import/:sessionId/progress')
  @UseGuards(checkPermission('CREATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get progress of a bulk import session' })
  getImportProgress(
    @Param('sessionId') sessionId: string,
  ): ImportAcademicRecordProgressDto {
    return this.academicRecordService.getImportProgress(sessionId);
  }

  @Get()
  @UseGuards(checkAcademicRecordReadAccess())
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all academic records with pagination and filters',
  })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('classId') classId?: string,
    @Query('semesterId') semesterId?: string,
    @Query('studentId') studentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('creator') creator?: string,
  ) {
    const requester = req.user;
    return this.academicRecordService.findAll(
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        search,
        classId,
        semesterId,
        studentId,
        startDate,
        endDate,
        creator,
      },
      requester,
    );
  }

  @Get('deleted/all')
  @UseGuards(checkPermission('READ_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all soft-deleted academic records' })
  findDeleted(@Request() req: any) {
    const requester = req.user;
    return this.academicRecordService.findDeleted(requester);
  }

  @Get(':id')
  @UseGuards(checkAcademicRecordReadAccess())
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get academic record by ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    const requester = req.user;
    return this.academicRecordService.findOne(id, requester);
  }

  @Get('student/:studentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get academic records by Student ID' })
  findByStudentId(
    @Param('studentId') studentId: string,
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination =
      page !== undefined || limit !== undefined
        ? {
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
          }
        : undefined;
    return this.academicRecordService.findByStudentId(
      studentId,
      req.user,
      pagination,
    );
  }

  @Get('daily-report/:dailyReportId')
  @ApiOperation({ summary: 'Get academic records by Daily Class Report ID' })
  findByDailyReportId(@Param('dailyReportId') dailyReportId: string) {
    return this.academicRecordService.findByDailyReportId(dailyReportId);
  }

  @Patch(':id')
  @UseGuards(checkPermission('UPDATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update academic record (requires Admin, Teacher, or Supervisor role)',
  })
  update(
    @Param('id') id: string,
    @Body() updateAcademicRecordDto: UpdateAcademicRecordDto,
    @Request() req: any,
    @Query('bypassDailyReportCheck') bypassDailyReportCheck?: string,
  ) {
    const bypass = bypassDailyReportCheck === 'true';
    const requester = req.user;
    return this.academicRecordService.update(
      id,
      updateAcademicRecordDto,
      requester,
      bypass,
    );
  }

  @Delete(':id')
  @UseGuards(checkAcademicRecordSelfServiceOrPermission('DELETE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Delete academic record (requires Admin, Teacher, Supervisor, or Student role)',
  })
  remove(
    @Param('id') id: string,
    @Request() req: any,
    @Query('bypassDailyReportCheck') bypassDailyReportCheck?: string,
  ) {
    const bypass = bypassDailyReportCheck === 'true';
    const requester = req.user;
    return this.academicRecordService.remove(id, requester, bypass);
  }

  @Patch(':id/restore')
  @UseGuards(checkPermission('UPDATE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Restore a soft-deleted academic record (requires Admin, Teacher, or Supervisor role)',
  })
  restore(@Param('id') id: string, @Request() req: any) {
    const requester = req.user;
    return this.academicRecordService.restore(id, requester);
  }

  @Delete(':id/force')
  @UseGuards(checkPermission('DELETE_STUDENT_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Permanently delete academic record (requires Admin, Teacher, or Supervisor role)',
  })
  forceRemove(
    @Param('id') id: string,
    @Request() req: any,
    @Query('bypassDailyReportCheck') bypassDailyReportCheck?: string,
  ) {
    const bypass = bypassDailyReportCheck === 'true';
    const requester = req.user;
    return this.academicRecordService.forceRemove(id, requester, bypass);
  }
}
