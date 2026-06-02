import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SemestersService } from './semesters.service';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('semesters')
@Controller('semesters')
export class SemestersController {
  constructor(private readonly semestersService: SemestersService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới một học kỳ' })
  @ApiResponse({ status: 201, description: 'Học kỳ được tạo thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  create(@Body() createSemesterDto: CreateSemesterDto) {
    return this.semestersService.create(createSemesterDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả học kỳ' })
  @ApiResponse({ status: 200, description: 'Trả về mảng danh sách học kỳ.' })
  findAll() {
    return this.semestersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một học kỳ bằng ID' })
  @ApiResponse({
    status: 200,
    description: 'Trả về dữ liệu chi tiết của học kỳ.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ.' })
  findOne(@Param('id') id: string) {
    return this.semestersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật một học kỳ bằng ID' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thông tin học kỳ thành công.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ.' })
  update(
    @Param('id') id: string,
    @Body() updateSemesterDto: UpdateSemesterDto,
  ) {
    return this.semestersService.update(id, updateSemesterDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa một học kỳ bằng ID' })
  @ApiResponse({ status: 200, description: 'Xóa học kỳ thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ.' })
  remove(@Param('id') id: string) {
    return this.semestersService.remove(id);
  }
}
