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
import { DailyClassReportService } from './daily-class-report.service';
import { CreateDailyClassReportDto } from './dto/create-daily-class-report.dto';
import { UpdateDailyClassReportDto } from './dto/update-daily-class-report.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { checkRole } from '../auth/guards/check-role.guard';

@ApiTags('Daily Class Reports')
@Controller('daily-class-reports')
export class DailyClassReportController {
  constructor(
    private readonly dailyClassReportService: DailyClassReportService,
  ) {}

  @Post()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a new daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  create(@Body() createDailyClassReportDto: CreateDailyClassReportDto) {
    return this.dailyClassReportService.create(createDailyClassReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all daily class reports' })
  findAll() {
    return this.dailyClassReportService.findAll();
  }

  @Get('deleted/all')
  @ApiOperation({ summary: 'Get all soft-deleted daily class reports' })
  findDeleted() {
    return this.dailyClassReportService.findDeleted();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get daily class report by ID' })
  findOne(@Param('id') id: string) {
    return this.dailyClassReportService.findOne(id);
  }

  @Get('class/:classId')
  @ApiOperation({ summary: 'Get daily class reports by Class ID' })
  findByClassId(@Param('classId') classId: string) {
    return this.dailyClassReportService.findByClassId(classId);
  }

  @Patch(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  update(
    @Param('id') id: string,
    @Body() updateDailyClassReportDto: UpdateDailyClassReportDto,
  ) {
    return this.dailyClassReportService.update(id, updateDailyClassReportDto);
  }

  @Delete(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  remove(@Param('id') id: string) {
    return this.dailyClassReportService.remove(id);
  }

  @Patch(':id/restore')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Restore a soft-deleted daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  restore(@Param('id') id: string) {
    return this.dailyClassReportService.restore(id);
  }

  @Delete(':id/force')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  forceRemove(@Param('id') id: string) {
    return this.dailyClassReportService.forceRemove(id);
  }
}
