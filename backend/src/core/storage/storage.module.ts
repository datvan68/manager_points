import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { ImageProcessorService } from './image-processor.service';
import { MediaController } from './media.controller';
import { StorageOrphanReconciliationService } from './storage-orphan-reconciliation.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MediaController],
  providers: [
    StorageService,
    ImageProcessorService,
    StorageOrphanReconciliationService,
  ],
  exports: [StorageService, ImageProcessorService],
})
export class StorageModule {}
