import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SummariesPointService } from './summaries-point.service';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('summaries-point')
@Controller('summaries-point')
export class SummariesPointController {
  constructor(private readonly summariesPointService: SummariesPointService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới điểm tổng kết' })
  @ApiResponse({ status: 201, description: 'Điểm tổng kết được tạo thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  create(@Body() createSummaryPointDto: CreateSummaryPointDto) {
    return this.summariesPointService.create(createSummaryPointDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả điểm tổng kết' })
  @ApiResponse({ status: 200, description: 'Trả về mảng danh sách điểm tổng kết.' })
  findAll() {
    return this.summariesPointService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết điểm tổng kết bằng ID' })
  @ApiResponse({ status: 200, description: 'Trả về dữ liệu chi tiết điểm tổng kết.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm tổng kết.' })
  findOne(@Param('id') id: string) {
    return this.summariesPointService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật điểm tổng kết bằng ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm tổng kết.' })
  update(@Param('id') id: string, @Body() updateSummaryPointDto: UpdateSummaryPointDto) {
    return this.summariesPointService.update(id, updateSummaryPointDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa điểm tổng kết bằng ID' })
  @ApiResponse({ status: 200, description: 'Xóa điểm tổng kết thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm tổng kết.' })
  remove(@Param('id') id: string) {
    return this.summariesPointService.remove(id);
  }
}
