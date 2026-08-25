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
import { MaintenanceService } from '../services/maintenance.service';
import {
  CreateMaintenanceDto,
  HandleMaintenanceDto,
} from '../dto/create-maintenance.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';

@ApiTags('Dormitory - Maintenance')
@ApiBearerAuth()
@Controller('dormitory/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @UseGuards(checkPermission('DORM_MAINT_CREATE'))
  create(@Body() dto: CreateMaintenanceDto, @Request() req: any) {
    return this.maintenanceService.create(dto, req.user);
  }

  @Get()
  @UseGuards(checkPermission('DORM_MAINT_READ'))
  findAll(
    @Query('room_id') room_id?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('issue_type') issue_type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.maintenanceService.findAll({
      room_id,
      status,
      priority,
      issue_type,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(checkPermission('DORM_MAINT_READ'))
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Patch(':id/handle')
  @UseGuards(checkPermission('DORM_MAINT_ASSIGN'))
  handle(
    @Param('id') id: string,
    @Body() dto: HandleMaintenanceDto,
    @Request() req: any,
  ) {
    return this.maintenanceService.handle(id, dto, req.user);
  }
}
