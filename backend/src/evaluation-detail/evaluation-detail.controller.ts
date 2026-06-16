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
  Query,
} from '@nestjs/common';
import { EvaluationDetailService } from './evaluation-detail.service';
import { CreateEvaluationDetailDto } from './dto/create-evaluation-detail.dto';
import { UpdateEvaluationDetailDto } from './dto/update-evaluation-detail.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { checkRole } from '../auth/guards/check-role.guard';

@ApiTags('evaluation-detail')
@Controller('evaluation-detail')
@UseGuards(checkRole('Admin', 'Teacher', 'Supervisor', 'Student'))
@ApiBearerAuth()
export class EvaluationDetailController {
  constructor(
    private readonly evaluationDetailService: EvaluationDetailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo mới chi tiết chấm điểm' })
  @ApiResponse({
    status: 201,
    description: 'Chi tiết chấm điểm được tạo thành công.',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  create(
    @Body() createEvaluationDetailDto: CreateEvaluationDetailDto,
    @Request() req: any,
  ) {
    return this.evaluationDetailService.create(createEvaluationDetailDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy tất cả chi tiết chấm điểm' })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách chi tiết chấm điểm.',
  })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('summaryId') summaryId?: string,
    @Query('semesterId') semesterId?: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.evaluationDetailService.findAll(
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        summaryId,
        semesterId,
        classId,
        studentId,
      },
      req.user,
    );
  }

  @Get('pre-counts/:summaryId')
  @ApiOperation({
    summary: 'Đếm số academic_record đã có sẵn cho tất cả tiêu chí của bảng tổng kết',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về map { criterionId: count } các ghi nhận đã có sẵn.',
  })
  getPreExistingCounts(@Param('summaryId') summaryId: string, @Request() req: any) {
    return this.evaluationDetailService.getPreExistingCountsForSummary(summaryId, req.user);
  }

  @Post('pre-counts/bulk')
  @ApiOperation({
    summary: 'Đếm hàng loạt số academic_record đã có sẵn cho nhiều bảng tổng kết',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về map { summaryId: { criterionId: counts } } các ghi nhận đã có sẵn.',
  })
  getPreExistingCountsBulk(@Body() body: any, @Request() req: any) {
    const { summaryIds } = body;
    return this.evaluationDetailService.getPreExistingCountsBulk(summaryIds, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết chấm điểm bằng ID' })
  @ApiResponse({
    status: 200,
    description: 'Trả về dữ liệu chi tiết chấm điểm.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy chi tiết chấm điểm.',
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.evaluationDetailService.findOne(id, req.user);
  }

  @Get('summary/:summaryId')
  @ApiOperation({
    summary: 'Lấy danh sách chi tiết chấm điểm theo ID bảng tổng kết',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách chi tiết chấm điểm của bảng tổng kết.',
  })
  findBySummaryId(
    @Param('summaryId') summaryId: string,
    @Request() req: any,
    @Query('includeLogs') includeLogs?: string,
  ) {
    const fetchLogs = includeLogs === 'true';
    return this.evaluationDetailService.findBySummaryId(summaryId, req.user, fetchLogs);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật chi tiết chấm điểm bằng ID' })
  @ApiResponse({ status: 200, description: 'Cập nhật thông tin thành công.' })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy chi tiết chấm điểm.',
  })
  update(
    @Param('id') id: string,
    @Body() updateEvaluationDetailDto: UpdateEvaluationDetailDto,
    @Request() req: any,
  ) {
    return this.evaluationDetailService.update(id, updateEvaluationDetailDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa chi tiết chấm điểm bằng ID' })
  @ApiResponse({
    status: 200,
    description: 'Xóa chi tiết chấm điểm thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy chi tiết chấm điểm.',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.evaluationDetailService.remove(id, req.user);
  }
}
