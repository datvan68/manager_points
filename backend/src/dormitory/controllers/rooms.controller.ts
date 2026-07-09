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
import { RoomsService } from '../services/rooms.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Rooms')
@ApiBearerAuth()
@Controller('dormitory/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @UseGuards(checkPermission('DORM_ROOM_CREATE'))
  create(@Body() dto: CreateRoomDto, @Request() req: any) {
    return this.roomsService.create(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('search') search?: string,
    @Query('building_id') building_id?: string,
    @Query('trang_thai') trang_thai?: string,
    @Query('loai_phong') loai_phong?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.roomsService.findAll({
      search,
      building_id,
      trang_thai,
      loai_phong,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('DORM_ROOM_UPDATE'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @Request() req: any,
  ) {
    return this.roomsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('DORM_ROOM_DELETE'))
  remove(@Param('id') id: string, @Request() req: any) {
    return this.roomsService.remove(id, req.user);
  }
}
