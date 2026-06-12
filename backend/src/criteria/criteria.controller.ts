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
} from '@nestjs/common';
import { CriteriaService } from './criteria.service';
import { CreateCriterionDto } from './dto/create-criterion.dto';
import { UpdateCriterionDto } from './dto/update-criterion.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';

@ApiTags('criteria')
@Controller('criteria')
export class CriteriaController {
  constructor(private readonly criteriaService: CriteriaService) {}

  @Post()
  @UseGuards(checkPermission('CONFIG_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mới một tiêu chí đánh giá' })
  @ApiResponse({ status: 201, description: 'Tạo tiêu chí thành công' })
  create(@Body() createCriterionDto: CreateCriterionDto) {
    return this.criteriaService.create(createCriterionDto);
  }

  @Post('bulk-delete')
  @UseGuards(checkPermission('CONFIG_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa nhiều tiêu chí đánh giá cùng lúc' })
  @ApiResponse({ status: 200, description: 'Xóa thành công các tiêu chí' })
  bulkDelete(@Body('ids') ids: string[]) {
    return this.criteriaService.bulkDelete(ids);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách tất cả các tiêu chí (có thể lọc theo category_id)',
  })
  @ApiQuery({
    name: 'category_id',
    required: false,
    description: 'ID danh mục để lọc tiêu chí',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  findAll(@Query('category_id') categoryId?: string) {
    if (categoryId) {
      return this.criteriaService.findByCategoryId(categoryId);
    }
    return this.criteriaService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết tiêu chí theo MongoDB ID' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiêu chí' })
  findOne(@Param('id') id: string) {
    return this.criteriaService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('CONFIG_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tiêu chí theo MongoDB ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiêu chí' })
  update(
    @Param('id') id: string,
    @Body() updateCriterionDto: UpdateCriterionDto,
  ) {
    return this.criteriaService.update(id, updateCriterionDto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CONFIG_RECORD'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tiêu chí theo MongoDB ID' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiêu chí' })
  remove(@Param('id') id: string) {
    return this.criteriaService.remove(id);
  }
}
