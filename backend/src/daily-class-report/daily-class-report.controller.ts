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
import { checkPermission } from '../auth/guards/check-permission.guard';

@ApiTags('Daily Class Reports')
@Controller('daily-class-reports')
export class DailyClassReportController {
  constructor(
    private readonly dailyClassReportService: DailyClassReportService,
  ) {}

  @Post()
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a new daily class report (requires edit_content permission)',
  })
  create(@Body() createDailyClassReportDto: CreateDailyClassReportDto) {
    return this.dailyClassReportService.create(createDailyClassReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all daily class reports' })
  findAll() {
    return this.dailyClassReportService.findAll();
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
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update daily class report (requires edit_content permission)',
  })
  update(
    @Param('id') id: string,
    @Body() updateDailyClassReportDto: UpdateDailyClassReportDto,
  ) {
    return this.dailyClassReportService.update(id, updateDailyClassReportDto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('edit_content'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete daily class report (requires edit_content permission)',
  })
  remove(@Param('id') id: string) {
    return this.dailyClassReportService.remove(id);
  }
}
