import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from './storage.service';

@Injectable()
export class StorageOrphanReconciliationService {
  private readonly logger = new Logger(StorageOrphanReconciliationService.name);

  constructor(private readonly storageService: StorageService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleNightlyReconciliation() {
    this.logger.log('Bắt đầu tiến trình kiểm tra & dọn dẹp lưu trữ định kỳ...');

    try {
      // 1. Clean old staging files older than 1 hour
      const stagingCleaned = await this.storageService.cleanStagingFiles(60 * 60 * 1000);

      // 2. Read capacity metrics
      const capacity = await this.storageService.getCapacityMetrics();

      this.logger.log(
        `Dọn dẹp lưu trữ hoàn tất. Staging đã xóa: ${stagingCleaned}. Dung lượng sử dụng: ${capacity.usagePercent}% (${Math.round(capacity.usedBytes / (1024 * 1024))}MB / ${Math.round(capacity.totalBytes / (1024 * 1024))}MB). Trạng thái: ${capacity.status.toUpperCase()}`,
      );

      if (capacity.status === 'warning') {
        this.logger.warn(`CẢNH BÁO: Dung lượng lưu trữ đã vượt ngưỡng 85%! (${capacity.usagePercent}%)`);
      } else if (capacity.status === 'critical') {
        this.logger.error(`BÁO ĐỘNG ĐỎ: Dung lượng lưu trữ đã vượt ngưỡng 95%! (${capacity.usagePercent}%)`);
      }
    } catch (err) {
      this.logger.error(`Lỗi trong quá trình kiểm tra lưu trữ định kỳ: ${(err as Error).message}`);
    }
  }
}
