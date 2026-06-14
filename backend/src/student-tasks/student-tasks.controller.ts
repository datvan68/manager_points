import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StudentTasksService } from './student-tasks.service';
import { CreateStudentTaskDto } from './dto/create-student-task.dto';
import { UpdateStudentTaskDto } from './dto/update-student-task.dto';
import { QueryStudentTaskDto } from './dto/query-student-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('student-tasks')
@Controller('student-tasks')
@UseGuards(JwtAuthGuard)
export class StudentTasksController {
  constructor(private readonly studentTasksService: StudentTasksService) {}

  @Post()
  @UseGuards(checkPermission('CREATE_STUDENT_TASK'))
  @ApiOperation({ summary: 'Tạo nhiệm vụ học tập mới' })
  create(@Body() createDto: CreateStudentTaskDto, @Req() req: any) {
    return this.studentTasksService.create(createDto, req.user?.userId);
  }

  @Get('assignees/teachers')
  @UseGuards(checkPermission('READ_STUDENT_TASK'))
  @ApiOperation({ summary: 'Lấy danh sách giáo viên để phân công' })
  getTeachers() {
    return this.studentTasksService.getTeachers();
  }

  @Get()
  @UseGuards(checkPermission('READ_STUDENT_TASK'))
  @ApiOperation({ summary: 'Lấy danh sách nhiệm vụ học tập có phân trang và bộ lọc' })
  findAll(@Query() query: QueryStudentTaskDto, @Req() req: any) {
    return this.studentTasksService.findAll(query, req.user);
  }

  @Get(':id/access')
  @ApiOperation({ summary: 'Kiểm tra quyền truy cập nhiệm vụ của user hiện tại' })
  checkAccess(@Param('id') id: string, @Req() req: any) {
    return this.studentTasksService.checkAccess(id, req.user);
  }

  @Get(':id')
  @UseGuards(checkPermission('READ_STUDENT_TASK'))
  @ApiOperation({ summary: 'Lấy chi tiết nhiệm vụ học tập' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.studentTasksService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(checkPermission('UPDATE_STUDENT_TASK'))
  @ApiOperation({ summary: 'Cập nhật thông tin nhiệm vụ học tập' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStudentTaskDto,
    @Req() req: any,
  ) {
    return this.studentTasksService.update(id, updateDto, req.user?.userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái nhiệm vụ nhanh' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any,
  ) {
    return this.studentTasksService.updateStatus(id, status, req.user);
  }

  @Delete(':id')
  @UseGuards(checkPermission('DELETE_STUDENT_TASK'))
  @ApiOperation({ summary: 'Xóa nhiệm vụ học tập (soft delete)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.studentTasksService.remove(id, req.user?.userId);
  }
}
