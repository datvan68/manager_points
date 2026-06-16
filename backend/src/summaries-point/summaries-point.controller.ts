import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { SummariesPointService } from './summaries-point.service';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkRole } from '../auth/guards/check-role.guard';

@ApiTags('summaries-points')
@Controller('summaries-points')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SummariesPointController {
  constructor(private readonly summariesPointService: SummariesPointService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới điểm tổng kết' })
  @ApiResponse({
    status: 201,
    description: 'Điểm tổng kết được tạo thành công.',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  create(
    @Body() createSummaryPointDto: CreateSummaryPointDto,
    @Request() req: any,
  ) {
    return this.summariesPointService.create(createSummaryPointDto, req.user);
  }

  @Post('initialize-class')
  @ApiOperation({ summary: 'Khởi tạo bảng điểm rèn luyện hàng loạt cho một lớp học' })
  @ApiResponse({ status: 200, description: 'Khởi tạo bảng điểm rèn luyện thành công.' })
  initializeClass(
    @Body() body: { classId: string; semesterId: string },
    @Request() req: any,
  ) {
    return this.summariesPointService.initializeClass(body.classId, body.semesterId, req.user);
  }

  @Post('export-pdf')
  @ApiOperation({
    summary: 'Xuất file PDF kết quả điểm rèn luyện sinh viên bằng Puppeteer',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về file PDF dưới dạng stream.',
  })
  async exportPdf(@Body() body: any, @Res() res: express.Response) {
    try {
      const {
        selectedStudents,
        categories,
        evaluationCounts,
        semesterName,
        className,
        pdfConfig,
      } = body;
      const pdfBuffer = await this.summariesPointService.generatePdf(
        selectedStudents,
        categories,
        evaluationCounts,
        semesterName,
        className,
        pdfConfig,
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
  @ApiResponse({
    status: 200,
    description: 'Trả về mảng danh sách điểm tổng kết.',
  })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('semesterId') semesterId?: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('studentIds') studentIds?: string,
    @Query('status') status?: string,
  ) {
    return this.summariesPointService.findAll(req.user, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      semesterId,
      classId,
      studentId,
      studentIds,
      status,
    });
  }

  // New endpoint: get latest locked summary for the logged‑in student
  @Get('me/latest')
  @ApiOperation({ summary: 'Lấy điểm rèn luyện mới nhất của sinh viên hiện tại' })
  @ApiResponse({ status: 200, description: 'Trả về điểm mới nhất.' })
  async getLatest(
    @Request() req: any,
    @Query('semesterId') semesterId?: string,
    @Query('periodId') periodId?: string,
  ) {
    const userId = req.user?.userId;
    return this.summariesPointService.findLatestForStudent(userId, semesterId, periodId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết điểm tổng kết bằng ID' })
  @ApiResponse({
    status: 200,
    description: 'Trả về dữ liệu chi tiết điểm tổng kết.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm tổng kết.' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.summariesPointService.findOne(id, req.user);
  }

  @Patch('cancel-approval/bulk')
  @UseGuards(checkRole('Admin', 'Supervisor'))
  @ApiOperation({ summary: 'Hủy duyệt điểm rèn luyện hàng loạt' })
  @ApiResponse({ status: 200, description: 'Hủy duyệt hàng loạt thành công.' })
  @ApiResponse({ status: 403, description: 'Không có quyền.' })
  async cancelApprovalBulk(@Body() body: any, @Request() req: any) {
    const { summaryIds } = body;
    return this.summariesPointService.cancelApprovalBulk(summaryIds, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật điểm tổng kết bằng ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm tổng kết.' })
  update(
    @Param('id') id: string,
    @Body() updateSummaryPointDto: UpdateSummaryPointDto,
    @Request() req: any,
  ) {
    return this.summariesPointService.update(id, updateSummaryPointDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa điểm tổng kết bằng ID' })
  @ApiResponse({ status: 200, description: 'Xóa điểm tổng kết thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm tổng kết.' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.summariesPointService.remove(id, req.user);
  }

  @Patch(':id/approve')
  @UseGuards(checkRole('Admin', 'Supervisor'))
  @ApiOperation({ summary: 'Phê duyệt điểm rèn luyện' })
  @ApiResponse({ status: 200, description: 'Phê duyệt điểm thành công.' })
  @ApiResponse({ status: 403, description: 'Không có quyền.' })
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.summariesPointService.approveGrading(id, req.user);
  }

  // Keep finalize endpoint as a temporary alias (deprecated)
  @Patch(':id/finalize')
  @UseGuards(checkRole('Admin', 'Supervisor'))
  @ApiOperation({ summary: 'Chốt điểm rèn luyện (Đã lỗi thời, dùng /approve)' })
  @ApiResponse({ status: 200, description: 'Chốt điểm thành công.' })
  @ApiResponse({ status: 403, description: 'Không có quyền.' })
  async finalize(@Param('id') id: string, @Request() req: any) {
    return this.summariesPointService.approveGrading(id, req.user);
  }

  @Patch(':id/cancel-approval')
  @UseGuards(checkRole('Admin', 'Supervisor'))
  @ApiOperation({ summary: 'Hủy duyệt điểm rèn luyện' })
  @ApiResponse({ status: 200, description: 'Hủy duyệt thành công.' })
  @ApiResponse({ status: 403, description: 'Không có quyền.' })
  async cancelApproval(@Param('id') id: string, @Request() req: any) {
    return this.summariesPointService.cancelApproval(id, req.user);
  }


}
