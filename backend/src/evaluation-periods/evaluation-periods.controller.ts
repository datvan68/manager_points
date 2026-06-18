import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EvaluationPeriodsService } from './evaluation-periods.service';
import {
  CreateEvaluationPeriodDto,
  UpdateEvaluationPeriodDto,
} from './dto/evaluation-period.dto';

@ApiTags('Evaluation Periods')
@Controller('evaluation-periods')
export class EvaluationPeriodsController {
  constructor(private readonly service: EvaluationPeriodsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách kỳ đánh giá' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Evaluation Period ID' })
  @ApiOperation({ summary: 'Lấy chi tiết kỳ đánh giá' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo kỳ đánh giá mới (Admin only)' })
  async create(@Body() dto: CreateEvaluationPeriodDto, @Req() req: any) {
    return this.service.create(dto, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Evaluation Period ID' })
  @ApiOperation({ summary: 'Cập nhật kỳ đánh giá (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationPeriodDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('ADMIN_FULL')
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Evaluation Period ID' })
  @ApiOperation({ summary: 'Xóa kỳ đánh giá (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
