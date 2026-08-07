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
import { RegistrationsService } from '../services/registrations.service';
import { RoomAssignmentService } from '../services/room-assignment.service';
import { CreateRegistrationDto } from '../dto/create-registration.dto';
import {
  ApproveRegistrationDto,
  BulkApproveRegistrationDto,
} from '../dto/approve-registration.dto';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { checkPermission } from '../../auth/guards/check-permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PublicRegistrationLinkService } from '../services/public-registration-link.service';
import { CreateTemporaryRegistrationDto } from '../dto/create-temporary-registration.dto';

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
  @UseGuards(checkPermission('DORM_REG_VIEW'))
  findUnclassified(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.registrationsService.findUnclassified({ page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined, search });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.registrationsService.findOne(id);
  }

  @Patch(':id/approve')
  @UseGuards(checkPermission('DORM_REG_APPROVE'))
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRegistrationDto,
    @Request() req: any,
  ) {
    return this.registrationsService.approve(id, dto, req.user);
  }

  @Post('bulk-approve')
  @UseGuards(checkPermission('DORM_REG_APPROVE'))
  bulkApprove(@Body() dto: BulkApproveRegistrationDto, @Request() req: any) {
    return this.registrationsService.bulkApprove(dto, req.user);
  }

  @Post('assign-room')
  @UseGuards(checkPermission('DORM_REG_APPROVE'))
  assignRoom(@Body() dto: AssignRoomDto, @Request() req: any) {
    return this.roomAssignmentService.assignRoom(dto, req.user);
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
  @UseGuards(checkPermission('DORM_REG_VIEW'))
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
  @UseGuards(checkPermission('DORM_REG_APPROVE'))
  autoLinkPublicRegistrations() {
    return this.publicLinkService.autoLinkPendingRegistrations();
  }

  /**
   * Check single student against pending public registrations
   */
  @Post('public/check-student/:studentId')
  @UseGuards(checkPermission('DORM_REG_APPROVE'))
  checkStudentLink(@Param('studentId') studentId: string) {
    return this.publicLinkService.checkStudentLink(studentId);
  }
}
