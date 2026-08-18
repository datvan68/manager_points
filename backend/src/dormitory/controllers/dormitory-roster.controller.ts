import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DormitoryRosterService } from '../services/dormitory-roster.service';
import { RoomAssignmentService } from '../services/room-assignment.service';
import { CreateRosterEntryDto } from '../dto/create-roster-entry.dto';
import { UpdateRosterEntryDto } from '../dto/update-roster-entry.dto';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { UnassignRoomDto } from '../dto/unassign-room.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Dormitory - Roster')
@ApiBearerAuth()
@Controller('dormitory/roster')
export class DormitoryRosterController {
  constructor(
    private readonly rosterService: DormitoryRosterService,
    private readonly roomAssignmentService: RoomAssignmentService,
  ) {}

  @Post()
  @UseGuards(checkPermission('DORM_REG_CREATE'))
  create(@Body() dto: CreateRosterEntryDto, @Request() req: any) { return this.rosterService.create(dto, req.user); }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('semester') semester?: string, @Query('academic_year') academic_year?: string, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.rosterService.findAll({ semester, academic_year, search, page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('student/:studentId')
  @UseGuards(JwtAuthGuard)
  findByStudentId(@Param('studentId') studentId: string, @Request() req: any) { return this.rosterService.findByStudentId(studentId, req.user); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: any) { if (req.user?.roleCode !== 'STUDENT') throw new ForbiddenException('Chức năng này chỉ dành cho sinh viên'); return this.rosterService.findMine(req.user.userId); }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMine(@Body() dto: UpdateRosterEntryDto, @Request() req: any) { if (req.user?.roleCode !== 'STUDENT') throw new ForbiddenException('Chức năng này chỉ dành cho sinh viên'); return this.rosterService.updateMine(req.user.userId, dto as any); }

  @Get(':id/application-pdf')
  @UseGuards(checkPermission('DORM_REG_READ'))
  async applicationPdf(@Param('id') id: string, @Query('disposition') disposition: string | undefined, @Res() res: Response) {
    const result = await this.rosterService.generateApplicationPdf(id);
    const mode = disposition === 'attachment' ? 'attachment' : 'inline';
    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': String(result.buffer.length), 'Content-Disposition': `${mode}; filename="${result.filename}"`, 'X-Content-Type-Options': 'nosniff' });
    res.end(result.buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) { return this.rosterService.findOne(id); }

  @Patch(':id')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  update(@Param('id') id: string, @Body() dto: UpdateRosterEntryDto) { return this.rosterService.update(id, dto); }

  @Delete(':id')
  @UseGuards(checkPermission('DORM_REG_DELETE'))
  remove(@Param('id') id: string) { return this.rosterService.remove(id); }

  @Post('assign-room')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  assignRoom(@Body() dto: AssignRoomDto, @Request() req: any) { return this.roomAssignmentService.assignRoom(dto, req.user); }

  @Post('unassign-room')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  unassignRoom(@Body() dto: UnassignRoomDto, @Request() req: any) {
    return this.roomAssignmentService.unassignRoom(dto.roster_entry_id, req.user);
  }

  @Get(':id/suggest-rooms')
  @UseGuards(JwtAuthGuard)
  suggestRooms(@Param('id') id: string) { return this.roomAssignmentService.suggestRooms(id); }
}
