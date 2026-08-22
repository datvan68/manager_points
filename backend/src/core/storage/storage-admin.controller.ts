import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { StorageOrphanReconciliationService } from './storage-orphan-reconciliation.service';
import {
  StorageInventoryQueryDto,
  StorageAuditLogQueryDto,
  StorageAssetParamDto,
  StoragePurgeDto,
} from './dto/storage-admin.dto';

@ApiTags('System Storage Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('SYSTEM_ADMIN')
@Controller('system/storage')
export class StorageAdminController {
  constructor(
    private readonly reconciliationService: StorageOrphanReconciliationService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Lấy thông số dung lượng, khả năng và thống kê file hệ thống',
  })
  async getSummary() {
    return this.reconciliationService.getSummary();
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Lấy danh sách metadata tệp tin quản lý phân trang',
  })
  async getInventory(@Query() query: StorageInventoryQueryDto) {
    return this.reconciliationService.getInventory(query);
  }

  @Post('reconcile/preview')
  @ApiOperation({
    summary: 'Chạy quét đối soát kiểm tra (chỉ đọc, không di chuyển file)',
  })
  async previewReconciliation(@Req() req: any) {
    const actor =
      req.user?.email ||
      req.user?.username ||
      req.user?.userId ||
      'system_admin';
    return this.reconciliationService.runReconciliation('preview', actor);
  }

  @Post('reconcile/execute')
  @ApiOperation({
    summary: 'Thực thi đối soát và cách ly các tệp tin orphan đã hết hạn grace',
  })
  @ApiOkResponse({ description: 'Thực thi đối soát và cách ly thành công' })
  @ApiForbiddenResponse({
    description: 'Chức năng thực thi cách ly bị vô hiệu hóa',
  })
  async executeReconciliation(@Req() req: any) {
    const caps = this.reconciliationService.getCapabilities();
    if (!caps.canExecuteReconciliation) {
      throw new ForbiddenException(
        'Thao tác thực thi đối soát và cách ly hiện đang bị vô hiệu hóa bởi cấu hình hệ thống',
      );
    }
    const actor =
      req.user?.email ||
      req.user?.username ||
      req.user?.userId ||
      'system_admin';
    return this.reconciliationService.runReconciliation('execute', actor);
  }

  @Post('restore/:assetId')
  @ApiOperation({
    summary: 'Khôi phục tệp tin từ vùng cách ly về vị trí ban đầu',
  })
  @ApiOkResponse({ description: 'Khôi phục tệp tin thành công' })
  @ApiForbiddenResponse({ description: 'Chức năng khôi phục bị vô hiệu hóa' })
  async restoreAsset(@Param() params: StorageAssetParamDto, @Req() req: any) {
    const caps = this.reconciliationService.getCapabilities();
    if (!caps.canRestore) {
      throw new ForbiddenException(
        'Thao tác khôi phục tệp tin hiện đang bị vô hiệu hóa bởi cấu hình hệ thống',
      );
    }
    const actor =
      req.user?.email ||
      req.user?.username ||
      req.user?.userId ||
      'system_admin';
    return this.reconciliationService.restoreAsset(params.assetId, actor);
  }

  @Delete('purge/:assetId')
  @ApiOperation({
    summary: 'Xóa vĩnh viễn tệp tin khỏi vùng cách ly (cần xác nhận)',
  })
  @ApiOkResponse({ description: 'Xóa vĩnh viễn tệp tin thành công' })
  @ApiForbiddenResponse({
    description: 'Chức năng xóa vĩnh viễn bị vô hiệu hóa',
  })
  async purgeAsset(
    @Param() params: StorageAssetParamDto,
    @Body() body: StoragePurgeDto,
    @Req() req: any,
  ) {
    const caps = this.reconciliationService.getCapabilities();
    if (!caps.canPurge) {
      throw new ForbiddenException(
        'Thao tác xóa vĩnh viễn tệp tin hiện đang bị vô hiệu hóa bởi cấu hình hệ thống',
      );
    }
    const actor =
      req.user?.email ||
      req.user?.username ||
      req.user?.userId ||
      'system_admin';
    return this.reconciliationService.purgeAsset(
      params.assetId,
      actor,
      body.confirmationToken,
      body.confirmationPhrase,
      body.reason,
    );
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Lấy nhật ký kiểm tra và đối soát lưu trữ' })
  async getAuditLogs(@Query() query: StorageAuditLogQueryDto) {
    return this.reconciliationService.getAuditLogs(query.limit);
  }
}
