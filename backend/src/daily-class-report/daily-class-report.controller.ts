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
  create(@Body() createDailyClassReportDto: CreateDailyClassReportDto, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.create(createDailyClassReportDto, requester);
  }

  @Get()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all daily class reports' })
  findAll(@Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.findAll(requester);
  }

  @Get('deleted/all')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all soft-deleted daily class reports' })
  findDeleted(@Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.findDeleted(requester);
  }

  @Get(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get daily class report by ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.findOne(id, requester);
  }

  @Get('class/:classId')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get daily class reports by Class ID' })
  findByClassId(@Param('classId') classId: string, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.findByClassId(classId, requester);
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
    @Request() req: any,
  ) {
    const requester = req.user;
    return this.dailyClassReportService.update(id, updateDailyClassReportDto, requester);
  }

  @Delete(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.dailyClassReportService.remove(id, req.user);
  }

  @Patch(':id/restore')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Restore a soft-deleted daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  restore(@Param('id') id: string, @Request() req: any) {
    const requester = req.user;
    return this.dailyClassReportService.restore(id, requester);
  }

  @Delete(':id/force')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Permanently delete daily class report (requires Admin, Teacher, or Supervisor role)',
  })
  forceRemove(@Param('id') id: string, @Request() req: any) {
    return this.dailyClassReportService.forceRemove(id, req.user);
  }

  @Post('bulk-delete')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Bulk delete daily class reports (requires Admin, Teacher, or Supervisor role)',
  })
  bulkDelete(@Body() body: { ids: string[] }, @Request() req: any) {
    return this.dailyClassReportService.bulkRemove(body.ids, req.user);
  }
}
