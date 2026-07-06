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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { checkRole } from '../auth/guards/check-role.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import {
  ImportStudentRequestDto,
  ImportStudentCommitDto,
  ImportStudentPreviewResultDto,
  ImportStudentCommitResultDto,
  ImportStudentProgressDto,
} from './dto/import-student.dto';

@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @UseGuards(checkPermission('STUDENT_CREATE'))
  create(@Body() createStudentDto: CreateStudentDto, @Request() req: any) {
    return this.studentsService.create(createStudentDto, req.user);
  }

  @Post('bulk')
  @UseGuards(checkPermission('STUDENT_IMPORT'))
  createBulk(@Body() createStudentDtos: CreateStudentDto[], @Request() req: any) {
    return this.studentsService.createBulk(createStudentDtos, req.user);
  }

  @Post('import/preview')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview and validate bulk import of students' })
  @ApiBody({ type: ImportStudentRequestDto })
  async importPreview(
    @Body() body: ImportStudentRequestDto,
    @Request() req: any,
  ): Promise<ImportStudentPreviewResultDto> {
    const requester = req.user;
    return this.studentsService.importPreview(body.classId, body.rows, requester);
  }

  @Post('import/confirm')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm and commit bulk import of students' })
  @ApiBody({ type: ImportStudentCommitDto })
  async importConfirm(
    @Body() body: ImportStudentCommitDto,
    @Request() req: any,
  ): Promise<ImportStudentCommitResultDto> {
    const requester = req.user;
    return this.studentsService.importConfirm(body.sessionId, requester);
  }

  @Get('import/:sessionId/progress')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get progress of student import session' })
  async getImportProgress(
    @Param('sessionId') sessionId: string,
  ): Promise<ImportStudentProgressDto> {
    return this.studentsService.getImportProgress(sessionId);
  }

  @Post('check-duplicate')
  @UseGuards(checkPermission('STUDENT_CREATE'))
  checkDuplicate(@Body('studentCodes') studentCodes: string[], @Request() req: any) {
    return this.studentsService.checkDuplicate(studentCodes, req.user);
  }

  @Post('bulk-activate')
  @UseGuards(checkPermission('STUDENT_ACCOUNT_ACTIVATE'))
  bulkActivate(@Body('studentIds') studentIds: string[], @Request() req: any) {
    return this.studentsService.bulkActivateStudentAccounts(studentIds, req.user);
  }

  @Post(':id/activate')
  @UseGuards(checkPermission('STUDENT_ACCOUNT_ACTIVATE'))
  activate(@Param('id') id: string, @Request() req: any) {
    return this.studentsService.activateStudentAccount(id, req.user);
  }

  @Post(':id/lock')
  @UseGuards(checkPermission('STUDENT_ACCOUNT_ACTIVATE'))
  lockAccount(@Param('id') id: string, @Request() req: any) {
    return this.studentsService.lockStudentAccount(id, req.user);
  }

  @Post(':id/unlock')
  @UseGuards(checkPermission('STUDENT_ACCOUNT_ACTIVATE'))
  unlockAccount(@Param('id') id: string, @Request() req: any) {
    return this.studentsService.unlockStudentAccount(id, req.user);
  }

  @Post(':id/reset-password')
  @UseGuards(checkPermission('STUDENT_ACCOUNT_RESET_PASSWORD'))
  resetPassword(@Param('id') id: string, @Request() req: any) {
    return this.studentsService.resetStudentAccountPassword(id, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Request() req: any,
    @Query('classId') classId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('fields') fields?: string,
  ) {
    return this.studentsService.findAll(
      {
        classId,
        departmentId,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        search,
        status,
        fields,
      },
      req.user,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMe(@Request() req: any) {
    return this.studentsService.findMe(req.user);
  }

  @Get('resolve')
  @UseGuards(JwtAuthGuard)
  resolve(@Query('identifier') identifier: string, @Request() req: any) {
    return this.studentsService.resolve(identifier, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.studentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(checkPermission('STUDENT_UPDATE'))
  update(
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Request() req: any,
  ) {
    return this.studentsService.update(id, updateStudentDto, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('STUDENT_DELETE'))
  remove(@Param('id') id: string, @Request() req: any) {
    return this.studentsService.remove(id, req.user);
  }
}
