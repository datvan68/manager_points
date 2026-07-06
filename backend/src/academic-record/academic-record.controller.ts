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
import { checkRole } from '../auth/guards/check-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Academic Records')
@Controller('academic-records')
export class AcademicRecordController {
  constructor(private readonly academicRecordService: AcademicRecordService) {}

  @Post()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get progress of a bulk import session' })
  getImportProgress(
    @Param('sessionId') sessionId: string,
  ): ImportAcademicRecordProgressDto {
    return this.academicRecordService.getImportProgress(sessionId);
  }

  @Get()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all soft-deleted academic records' })
  findDeleted(@Request() req: any) {
    const requester = req.user;
    return this.academicRecordService.findDeleted(requester);
  }

  @Get(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
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
  findByStudentId(@Param('studentId') studentId: string, @Request() req: any) {
    return this.academicRecordService.findByStudentId(studentId, req.user);
  }

  @Get('daily-report/:dailyReportId')
  @ApiOperation({ summary: 'Get academic records by Daily Class Report ID' })
  findByDailyReportId(@Param('dailyReportId') dailyReportId: string) {
    return this.academicRecordService.findByDailyReportId(dailyReportId);
  }

  @Patch(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
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
