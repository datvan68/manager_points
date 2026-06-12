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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';

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

  @Post('check-duplicate')
  @UseGuards(checkPermission('STUDENT_CREATE'))
  checkDuplicate(@Body('studentCodes') studentCodes: string[], @Request() req: any) {
    return this.studentsService.checkDuplicate(studentCodes, req.user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: any) {
    return this.studentsService.findAll(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMe(@Request() req: any) {
    return this.studentsService.findMe(req.user);
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
