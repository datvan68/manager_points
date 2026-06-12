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
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
    summary: 'Create a new academic record (requires Admin, Teacher, or Supervisor role)',
  })
  create(@Body() createAcademicRecordDto: CreateAcademicRecordDto) {
    return this.academicRecordService.create(createAcademicRecordDto);
  }

  @Get()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all academic records' })
  findAll(@Request() req: any) {
    const requester = req.user;
    return this.academicRecordService.findAll(requester);
  }

  @Get('deleted/all')
  @ApiOperation({ summary: 'Get all soft-deleted academic records' })
  findDeleted() {
    return this.academicRecordService.findDeleted();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get academic record by ID' })
  findOne(@Param('id') id: string) {
    return this.academicRecordService.findOne(id);
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
    summary: 'Update academic record (requires Admin, Teacher, or Supervisor role)',
  })
  update(
    @Param('id') id: string,
    @Body() updateAcademicRecordDto: UpdateAcademicRecordDto,
    @Query('bypassDailyReportCheck') bypassDailyReportCheck?: string,
  ) {
    const bypass = bypassDailyReportCheck === 'true';
    return this.academicRecordService.update(id, updateAcademicRecordDto, bypass);
  }

  @Delete(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete academic record (requires Admin, Teacher, Supervisor, or Student role)',
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
    summary: 'Restore a soft-deleted academic record (requires Admin, Teacher, or Supervisor role)',
  })
  restore(@Param('id') id: string) {
    return this.academicRecordService.restore(id);
  }

  @Delete(':id/force')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete academic record (requires Admin, Teacher, or Supervisor role)',
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
