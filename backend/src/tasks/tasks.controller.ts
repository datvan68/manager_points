import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TaskStatus } from './schemas/task.schema';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() createTaskDto: any) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks' })
  findAll() {
    return this.tasksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task details' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  updateStatus(@Param('id') id: string, @Body('status') status: TaskStatus) {
    return this.tasksService.updateStatus(id, status);
  }

  @Patch(':id/result')
  @ApiOperation({ summary: 'Update task result' })
  updateResult(@Param('id') id: string, @Body('result') result: any) {
    return this.tasksService.updateResult(id, result);
  }
}
