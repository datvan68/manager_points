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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BuildingsService } from '../services/buildings.service';
import { CreateBuildingDto } from '../dto/create-building.dto';
import { UpdateBuildingDto } from '../dto/update-building.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';

@ApiTags('Dormitory - Buildings')
@ApiBearerAuth()
@Controller('dormitory/buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @UseGuards(checkPermission('DORM_BUILDING_CREATE'))
  create(@Body() dto: CreateBuildingDto, @Request() req: any) {
    return this.buildingsService.create(dto, req.user);
  }

  @Get()
  @UseGuards(checkPermission('DORM_BUILDING_READ'))
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.buildingsService.findAll({
      search,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(checkPermission('DORM_BUILDING_READ'))
  findOne(@Param('id') id: string) {
    return this.buildingsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('DORM_BUILDING_UPDATE'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
    @Request() req: any,
  ) {
    return this.buildingsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('DORM_BUILDING_DELETE'))
  remove(@Param('id') id: string, @Request() req: any) {
    return this.buildingsService.remove(id, req.user);
  }
}
