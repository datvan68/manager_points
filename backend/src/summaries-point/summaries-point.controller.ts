import { Controller, Get, Post, Body, Patch, Param, Delete, Res } from '@nestjs/common';
import { SummariesPointService } from './summaries-point.service';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as express from 'express';

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

  @Post('export-pdf')
  @ApiOperation({ summary: 'Xuất file PDF kết quả điểm rèn luyện sinh viên bằng Puppeteer' })
  @ApiResponse({ status: 200, description: 'Trả về file PDF dưới dạng stream.' })
  async exportPdf(@Body() body: any, @Res() res: express.Response) {
    try {
      const { selectedStudents, categories, evaluationCounts, semesterName, className, pdfConfig } = body;
      const pdfBuffer = await this.summariesPointService.generatePdf(
        selectedStudents,
        categories,
        evaluationCounts,
        semesterName,
        className,
        pdfConfig
      );
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=phieu_diem_ren_luyen.pdf',
        'Content-Length': pdfBuffer.length.toString(),
      });
      
      res.end(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi khi xuất PDF: ' + error.message });
    }
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
