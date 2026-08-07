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
import { ContractsService } from '../services/contracts.service';
import { RoomAssignmentService } from '../services/room-assignment.service';
import { CreateContractDto, CancelContractDto } from '../dto/create-contract.dto';
import { TransferRoomDto } from '../dto/transfer-room.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Contracts')
@ApiBearerAuth()
@Controller('dormitory/contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly roomAssignmentService: RoomAssignmentService,
  ) {}

  @Post()
  @UseGuards(checkPermission('DORM_CONTRACT_CREATE'))
  create(@Body() dto: CreateContractDto, @Request() req: any) {
    return this.contractsService.create(dto, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('student_id') student_id?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contractsService.findAll({
      student_id,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id/cancel')
  @UseGuards(checkPermission('DORM_CONTRACT_UPDATE'))
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelContractDto,
    @Request() req: any,
  ) {
    return this.contractsService.cancel(id, dto, req.user);
  }

  @Patch(':id/extend')
  @UseGuards(checkPermission('DORM_CONTRACT_UPDATE'))
  extend(
    @Param('id') id: string,
    @Body('end_date') end_date: string,
    @Request() req: any,
  ) {
    return this.contractsService.extend(id, end_date, req.user);
  }

  @Post('transfer')
  @UseGuards(checkPermission('DORM_CONTRACT_UPDATE'))
  transfer(@Body() dto: TransferRoomDto, @Request() req: any) {
    return this.roomAssignmentService.transferRoom(dto, req.user);
  }
}
