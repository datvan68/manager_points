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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BedsService } from '../services/beds.service';
import { CreateBedDto } from '../dto/create-bed.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';

@ApiTags('Dormitory - Beds')
@ApiBearerAuth()
@Controller('dormitory/beds')
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Post()
  @UseGuards(checkPermission('DORM_BED_CREATE'))
  create(@Body() dto: CreateBedDto, @Request() req: any) {
    return this.bedsService.create(dto, req.user);
  }

  @Post('auto-create/:roomId/:count')
  @UseGuards(checkPermission('DORM_BED_CREATE'))
  autoCreate(
    @Param('roomId') roomId: string,
    @Param('count') count: string,
    @Request() req: any,
  ) {
    return this.bedsService.autoCreateBeds(roomId, parseInt(count, 10), req.user);
  }

  @Get('room/:roomId')
  @UseGuards(checkPermission('DORM_ROOM_READ'))
  findByRoom(@Param('roomId') roomId: string) {
    return this.bedsService.findByRoom(roomId);
  }

  @Get(':id')
  @UseGuards(checkPermission('DORM_ROOM_READ'))
  findOne(@Param('id') id: string) {
    return this.bedsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(checkPermission('DORM_BED_UPDATE'))
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.bedsService.updateStatus(id, status, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('DORM_BED_DELETE'))
  remove(@Param('id') id: string, @Request() req: any) {
    return this.bedsService.remove(id, req.user);
  }
}
