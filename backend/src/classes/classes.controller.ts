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
import { checkPermission } from '../auth/guards/check-permission.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ImportClassConfirmDto } from './dto/import-class.dto';

@ApiTags('Classes')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @UseGuards(checkPermission('CLASS_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new class (requires CLASS_CREATE permission)',
  })
  create(@Body() createClassDto: CreateClassDto) {
    return this.classesService.create(createClassDto);
  }

  @Post('import/preview')
  @UseGuards(checkPermission('CLASS_CREATE'))
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Preview imported classes from Excel/CSV' })
  previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hợp lệ');
    }
    return this.classesService.previewImport(file);
  }

  @Post('import/confirm')
  @UseGuards(checkPermission('CLASS_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm import classes into database' })
  confirmImport(@Body() confirmDto: ImportClassConfirmDto) {
    return this.classesService.confirmImport(confirmDto);
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

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get summary of all classes (student count, avatars)',
  })
  getClassSummary(@Request() req?: any) {
    return this.classesService.getClassSummary(req?.user);
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
  @UseGuards(checkPermission('CLASS_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a class (requires CLASS_UPDATE permission)',
  })
  update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto) {
    return this.classesService.update(id, updateClassDto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CLASS_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a class (requires CLASS_DELETE permission)',
  })
  remove(@Param('id') id: string) {
    return this.classesService.remove(id);
  }
}
