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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { checkRole } from '../auth/guards/check-role.guard';

@ApiTags('Classes')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new class (requires Admin, Teacher, or Supervisor role)',
  })
  create(@Body() createClassDto: CreateClassDto) {
    return this.classesService.create(createClassDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all classes scoped by requester role' })
  findAll(@Request() req?: any) {
    return req?.user
      ? this.classesService.findAll(req.user)
      : this.classesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get class by ID scoped by requester role' })
  findOne(@Param('id') id: string, @Request() req?: any) {
    return req?.user
      ? this.classesService.findOne(id, req.user)
      : this.classesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a class (requires Admin, Teacher, or Supervisor role)',
  })
  update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto) {
    return this.classesService.update(id, updateClassDto);
  }

  @Delete(':id')
  @UseGuards(checkRole('Admin', 'Teacher', 'Supervisor'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a class (requires Admin, Teacher, or Supervisor role)',
  })
  remove(@Param('id') id: string) {
    return this.classesService.remove(id);
  }
}
