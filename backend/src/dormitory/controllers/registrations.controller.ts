import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  Query,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RegistrationsService } from '../services/registrations.service';
import { RoomAssignmentService } from '../services/room-assignment.service';
import { CreateRegistrationDto } from '../dto/create-registration.dto';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PublicRegistrationLinkService } from '../services/public-registration-link.service';
import { CreateTemporaryRegistrationDto } from '../dto/create-temporary-registration.dto';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { UnassignRoomDto } from '../dto/unassign-room.dto';
import { ConfirmPublicRegistrationLinkDto } from '../dto/confirm-public-registration-link.dto';

@ApiTags('Dormitory - Registrations')
@ApiBearerAuth()
@Controller('dormitory/registrations')
export class RegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly roomAssignmentService: RoomAssignmentService,
    private readonly publicLinkService: PublicRegistrationLinkService,
  ) {}

  @Post()
  @UseGuards(checkPermission('DORM_REG_CREATE'))
  create(@Body() dto: CreateRegistrationDto, @Request() req: any) {
    return this.registrationsService.create(dto, req.user);
  }

  @Post('temporary')
  @UseGuards(checkPermission('DORM_REG_CREATE'))
  createTemporary(@Body() dto: CreateTemporaryRegistrationDto) {
    return this.registrationsService.createTemporary(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('status') status?: string,
    @Query('semester') semester?: string,
    @Query('academic_year') academic_year?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.registrationsService.findAll({
      status,
      semester,
      academic_year,
      search,
      source,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('unclassified')
  @UseGuards(checkPermission('DORM_REG_READ'))
  findUnclassified(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.registrationsService.findUnclassified({ page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined, search });
  }

  @Get('public/:publicRegistrationId/link-candidates')
  @UseGuards(checkPermission('DORM_REG_READ'))
  linkCandidates(@Param('publicRegistrationId') id: string) {
    return this.publicLinkService.resolveCandidates(id);
  }

  @Post('public/:publicRegistrationId/confirm-link')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  confirmLink(@Param('publicRegistrationId') id: string, @Body() dto: ConfirmPublicRegistrationLinkDto, @Request() req: any) {
    return this.publicLinkService.confirmLink(id, dto, req.user);
  }

  // Keep self-scoped and student routes above :id so they can never be interpreted as an id.
  @Get('student/:studentId')
  @UseGuards(JwtAuthGuard)
  findByStudentId(@Param('studentId') studentId: string, @Request() req: any) {
    return this.registrationsService.findByStudentId(studentId, req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: any) {
    if (req.user?.roleCode !== 'STUDENT') throw new ForbiddenException('Chức năng này chỉ dành cho sinh viên');
    return this.registrationsService.findMine(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMine(@Body() dto: UpdateRegistrationDto, @Request() req: any) {
    if (req.user?.roleCode !== 'STUDENT') throw new ForbiddenException('Chức năng này chỉ dành cho sinh viên');
    return this.registrationsService.updateMine(req.user.userId, dto as unknown as Record<string, unknown>);
  }

  @Get(':id/application-pdf')
  @UseGuards(checkPermission('DORM_REG_READ'))
  async applicationPdf(
    @Param('id') id: string,
    @Query('source') source: string,
    @Query('disposition') disposition: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.registrationsService.generateApplicationPdf(id, source);
    const mode = disposition === 'attachment' ? 'attachment' : 'inline';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(result.buffer.length),
      'Content-Disposition': `${mode}; filename="${result.filename}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(result.buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Query('source') source?: string) {
    return this.registrationsService.findOne(id, source);
  }

  @Patch(':id')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  async update(
    @Param('id') id: string,
    @Query('source') source: string,
    @Body() dto: UpdateRegistrationDto,
  ) {
    const result: any = await this.registrationsService.update(id, source, dto);
    if (result?.student_code_state === 'LINKABLE' && result.link_student_id) {
      const linked = await this.publicLinkService.linkRegistrationToStudent(id, String(result.link_student_id));
      return {
        ...linked,
        student_code_state: 'LINKED',
        student_code_message: 'Đã xác thực và liên kết đăng ký với hồ sơ sinh viên.',
      };
    }
    return result;
  }

  @Delete(':id')
  @UseGuards(checkPermission('DORM_REG_DELETE'))
  remove(@Param('id') id: string, @Query('source') source: string) {
    return this.registrationsService.remove(id, source);
  }

  @Post('assign-room')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  assignRoom(@Body() dto: AssignRoomDto, @Request() req: any) {
    return this.roomAssignmentService.assignRoom(dto, req.user);
  }

  @Post('unassign-room')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  unassignRoom(@Body() dto: UnassignRoomDto, @Request() req: any) {
    return this.roomAssignmentService.unassignRoom(dto.registration_id, req.user);
  }

  @Get(':id/suggest-rooms')
  @UseGuards(JwtAuthGuard)
  suggestRooms(@Param('id') id: string) {
    return this.roomAssignmentService.suggestRooms(id);
  }

  /**
   * Get public QR registrations for admin review
   */
  @Get('public/list')
  @UseGuards(checkPermission('DORM_REG_READ'))
  getPublicRegistrations(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicLinkService.getAllPublicRegistrations({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Trigger auto-link: match pending public registrations with enrolled students
   */
  @Post('public/auto-link')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  autoLinkPublicRegistrations() {
    return this.publicLinkService.autoLinkPendingRegistrations();
  }

  /**
   * Check single student against pending public registrations
   */
  @Post('public/check-student/:studentId')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  checkStudentLink(@Param('studentId') studentId: string) {
    return this.publicLinkService.checkStudentLink(studentId);
  }

  @Post('public/:publicRegistrationId/link-student/:studentId')
  @UseGuards(checkPermission('DORM_REG_UPDATE'))
  linkPublicRegistration(
    @Param('publicRegistrationId') publicRegistrationId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.publicLinkService.linkRegistrationToStudent(publicRegistrationId, studentId);
  }
}
