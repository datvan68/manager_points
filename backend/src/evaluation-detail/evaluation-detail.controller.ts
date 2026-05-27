import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EvaluationDetailService } from './evaluation-detail.service';
import { CreateEvaluationDetailDto } from './dto/create-evaluation-detail.dto';
import { UpdateEvaluationDetailDto } from './dto/update-evaluation-detail.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('evaluation-detail')
@Controller('evaluation-detail')
export class EvaluationDetailController {
  constructor(private readonly evaluationDetailService: EvaluationDetailService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới chi tiết chấm điểm' })
  @ApiResponse({ status: 201, description: 'Chi tiết chấm điểm được tạo thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  create(@Body() createEvaluationDetailDto: CreateEvaluationDetailDto) {
    return this.evaluationDetailService.create(createEvaluationDetailDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả chi tiết chấm điểm' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách chi tiết chấm điểm.' })
  findAll() {
    return this.evaluationDetailService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết chấm điểm bằng ID' })
  @ApiResponse({ status: 200, description: 'Trả về dữ liệu chi tiết chấm điểm.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chi tiết chấm điểm.' })
  findOne(@Param('id') id: string) {
    return this.evaluationDetailService.findOne(id);
  }

  @Get('summary/:summaryId')
  @ApiOperation({ summary: 'Lấy danh sách chi tiết chấm điểm theo ID bảng tổng kết' })
  @ApiResponse({ status: 200, description: 'Trả về danh sách chi tiết chấm điểm của bảng tổng kết.' })
  findBySummaryId(@Param('summaryId') summaryId: string) {
    return this.evaluationDetailService.findBySummaryId(summaryId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật chi tiết chấm điểm bằng ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chi tiết chấm điểm.' })
  update(@Param('id') id: string, @Body() updateEvaluationDetailDto: UpdateEvaluationDetailDto) {
    return this.evaluationDetailService.update(id, updateEvaluationDetailDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa chi tiết chấm điểm bằng ID' })
  @ApiResponse({ status: 200, description: 'Xóa chi tiết chấm điểm thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chi tiết chấm điểm.' })
  remove(@Param('id') id: string) {
    return this.evaluationDetailService.remove(id);
  }
}
