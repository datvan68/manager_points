import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ViolationsService } from '../services/violations.service';
import {
  CreateViolationDto,
  HandleViolationDto,
} from '../dto/create-violation.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Violations')
@ApiBearerAuth()
@Controller('dormitory/violations')
export class ViolationsController {
  constructor(private readonly violationsService: ViolationsService) {}

  @Post()
  @UseGuards(checkPermission('DORM_VIOLATION_CREATE'))
  create(@Body() dto: CreateViolationDto, @Request() req: any) {
    return this.violationsService.create(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('student_id') student_id?: string,
    @Query('room_id') room_id?: string,
    @Query('trang_thai') trang_thai?: string,
    @Query('muc_do') muc_do?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.violationsService.findAll({
      student_id,
      room_id,
      trang_thai,
      muc_do,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('student/:studentId/summary')
  @UseGuards(JwtAuthGuard)
  getStudentSummary(@Param('studentId') studentId: string) {
    return this.violationsService.getStudentViolationSummary(studentId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.violationsService.findOne(id);
  }

  @Patch(':id/handle')
  @UseGuards(checkPermission('DORM_VIOLATION_HANDLE'))
  handle(
    @Param('id') id: string,
    @Body() dto: HandleViolationDto,
    @Request() req: any,
  ) {
    return this.violationsService.handle(id, dto, req.user);
  }
}
