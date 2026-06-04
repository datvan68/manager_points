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
} from '@nestjs/common';
import { AcademicRecordService } from './academic-record.service';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { checkPermission } from '../auth/guards/check-permission.guard';

@ApiTags('Academic Records')
@Controller('academic-records')
export class AcademicRecordController {
  constructor(private readonly academicRecordService: AcademicRecordService) {}

  @Post()
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new academic record (requires edit_content permission)',
  })
  create(@Body() createAcademicRecordDto: CreateAcademicRecordDto) {
    return this.academicRecordService.create(createAcademicRecordDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all academic records' })
  findAll() {
    return this.academicRecordService.findAll();
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
  @ApiOperation({ summary: 'Get academic records by Student ID' })
  findByStudentId(@Param('studentId') studentId: string) {
    return this.academicRecordService.findByStudentId(studentId);
  }

  @Get('daily-report/:dailyReportId')
  @ApiOperation({ summary: 'Get academic records by Daily Class Report ID' })
  findByDailyReportId(@Param('dailyReportId') dailyReportId: string) {
    return this.academicRecordService.findByDailyReportId(dailyReportId);
  }

  @Patch(':id')
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update academic record (requires edit_content permission)',
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
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete academic record (requires edit_content permission)',
  })
  remove(
    @Param('id') id: string,
    @Query('bypassDailyReportCheck') bypassDailyReportCheck?: string,
  ) {
    const bypass = bypassDailyReportCheck === 'true';
    return this.academicRecordService.remove(id, bypass);
  }

  @Patch(':id/restore')
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Restore a soft-deleted academic record (requires edit_content permission)',
  })
  restore(@Param('id') id: string) {
    return this.academicRecordService.restore(id);
  }

  @Delete(':id/force')
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete academic record (requires edit_content permission)',
  })
  forceRemove(
    @Param('id') id: string,
    @Query('bypassDailyReportCheck') bypassDailyReportCheck?: string,
  ) {
    const bypass = bypassDailyReportCheck === 'true';
    return this.academicRecordService.forceRemove(id, bypass);
  }
}
