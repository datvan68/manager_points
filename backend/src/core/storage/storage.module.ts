import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageService } from './storage.service';
import { ImageProcessorService } from './image-processor.service';
import { MediaController } from './media.controller';
import { StorageAdminController } from './storage-admin.controller';
import { StorageOrphanReconciliationService } from './storage-orphan-reconciliation.service';
import {
  StorageAuditLog,
  StorageAuditLogSchema,
  StorageReconciliationRun,
  StorageReconciliationRunSchema,
  StorageLock,
  StorageLockSchema,
} from './schemas/storage-audit.schema';
import {
  Activity,
  ActivitySchema,
} from '../../activities/schemas/activity.schema';
import { Invoice, InvoiceSchema } from '../../dormitory/schemas/invoice.schema';
import {
  RoomFeeInvoice,
  RoomFeeInvoiceSchema,
} from '../../dormitory/schemas/room-fee-invoice.schema';
import {
  UtilityConfig,
  UtilityConfigSchema,
} from '../../dormitory/schemas/utility-config.schema';
import {
  RoomFeeConfig,
  RoomFeeConfigSchema,
} from '../../dormitory/schemas/room-fee-config.schema';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: StorageAuditLog.name, schema: StorageAuditLogSchema },
      {
        name: StorageReconciliationRun.name,
        schema: StorageReconciliationRunSchema,
      },
      { name: StorageLock.name, schema: StorageLockSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: RoomFeeInvoice.name, schema: RoomFeeInvoiceSchema },
      { name: UtilityConfig.name, schema: UtilityConfigSchema },
      { name: RoomFeeConfig.name, schema: RoomFeeConfigSchema },
    ]),
  ],
  controllers: [MediaController, StorageAdminController],
  providers: [
    StorageService,
    ImageProcessorService,
    StorageOrphanReconciliationService,
  ],
  exports: [
    StorageService,
    ImageProcessorService,
    StorageOrphanReconciliationService,
  ],
})
export class StorageModule {}
