import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { StorageOrphanReconciliationService } from './storage-orphan-reconciliation.service';
import { AssetLifecycleState, StorageNamespace } from './storage.interface';

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
  @ApiOperation({ summary: 'Lấy thông số dung lượng và thống kê file hệ thống' })
  async getSummary() {
    return this.reconciliationService.getSummary();
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Lấy danh sách metadata tệp tin quản lý phân trang' })
  async getInventory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: AssetLifecycleState,
    @Query('domain') domain?: 'activities' | 'dormitory',
    @Query('namespace') namespace?: StorageNamespace,
    @Query('search') search?: string,
  ) {
    return this.reconciliationService.getInventory({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      domain,
      namespace,
      search,
    });
  }

  @Post('reconcile/preview')
  @ApiOperation({ summary: 'Chạy quét đối soát kiểm tra (chỉ đọc, không di chuyển file)' })
  async previewReconciliation(@Req() req: any) {
    const actor = req.user?.email || req.user?.username || req.user?.userId || 'system_admin';
    return this.reconciliationService.runReconciliation('preview', actor);
  }

  @Post('reconcile/execute')
  @ApiOperation({ summary: 'Thực thi đối soát và cách ly các tệp tin orphan đã hết hạn grace' })
  async executeReconciliation(@Req() req: any) {
    const actor = req.user?.email || req.user?.username || req.user?.userId || 'system_admin';
    return this.reconciliationService.runReconciliation('execute', actor);
  }

  @Post('restore/:assetId')
  @ApiOperation({ summary: 'Khôi phục tệp tin từ vùng cách ly về vị trí ban đầu' })
  async restoreAsset(@Param('assetId') assetId: string, @Req() req: any) {
    const actor = req.user?.email || req.user?.username || req.user?.userId || 'system_admin';
    return this.reconciliationService.restoreAsset(assetId, actor);
  }

  @Delete('purge/:assetId')
  @ApiOperation({ summary: 'Xóa vĩnh viễn tệp tin khỏi vùng cách ly (cần xác nhận)' })
  async purgeAsset(@Param('assetId') assetId: string, @Req() req: any) {
    const actor = req.user?.email || req.user?.username || req.user?.userId || 'system_admin';
    return this.reconciliationService.purgeAsset(assetId, actor);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Lấy nhật ký kiểm tra và đối soát lưu trữ' })
  async getAuditLogs(@Query('limit') limit?: number) {
    return this.reconciliationService.getAuditLogs(limit ? Number(limit) : undefined);
  }
}
