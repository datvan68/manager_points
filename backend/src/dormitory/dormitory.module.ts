import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { Building, BuildingSchema } from './schemas/building.schema';
import { Room, RoomSchema } from './schemas/room.schema';
import { Bed, BedSchema } from './schemas/bed.schema';
import { DormitoryRosterEntry, DormitoryRosterEntrySchema } from './schemas/dormitory-roster-entry.schema';
import { Contract, ContractSchema } from './schemas/contract.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Violation, ViolationSchema } from './schemas/violation.schema';
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from './schemas/maintenance-request.schema';
import {
  UtilityConfig,
  UtilityConfigSchema,
} from './schemas/utility-config.schema';
import {
  RoomFeeConfig,
  RoomFeeConfigSchema,
} from './schemas/room-fee-config.schema';
import {
  RoomFeeInvoice,
  RoomFeeInvoiceSchema,
} from './schemas/room-fee-invoice.schema';
import { MeterReading, MeterReadingSchema } from './schemas/meter-reading.schema';

// Services
import { BuildingsService } from './services/buildings.service';
import { RoomsService } from './services/rooms.service';
import { BedsService } from './services/beds.service';
import { ContractsService } from './services/contracts.service';
import { RoomAssignmentService } from './services/room-assignment.service';
import { InvoicesService } from './services/invoices.service';
import { RoomFeeInvoicesService } from './services/room-fee-invoices.service';
import { ViolationsService } from './services/violations.service';
import { MaintenanceService } from './services/maintenance.service';
import { DormitoryReportsService } from './services/dormitory-reports.service';
import { DormitoryRosterService } from './services/dormitory-roster.service';
import { DormitoryRosterIdentityService } from './services/dormitory-roster-identity.service';

// Controllers
import { BuildingsController } from './controllers/buildings.controller';
import { RoomsController } from './controllers/rooms.controller';
import { BedsController } from './controllers/beds.controller';
import { DormitoryRosterController } from './controllers/dormitory-roster.controller';
import { ContractsController } from './controllers/contracts.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { RoomFeeInvoicesController } from './controllers/room-fee-invoices.controller';
import { ViolationsController } from './controllers/violations.controller';
import { MaintenanceController } from './controllers/maintenance.controller';
import { DormitoryReportsController } from './controllers/dormitory-reports.controller';
import { DormitoryQrController } from './controllers/dormitory-qr.controller';

// External schemas needed for cross-references
import {
  Student,
  StudentSchema,
} from '../students/schemas/student.schema';
import { SemestersModule } from '../semesters/semesters.module';
import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';
import { PdfTemplateModule } from '../pdf-template/pdf-template.module';
import {
  DORMITORY_ROSTER_APPLICATION_DESCRIPTOR,
  DORMITORY_RESIDENCE_INFO_DESCRIPTOR,
  DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR,
} from './pdf-template-adapter';

@Module({
  imports: [
    SemestersModule,
    PdfTemplateModule.register([
      DORMITORY_ROSTER_APPLICATION_DESCRIPTOR,
      DORMITORY_RESIDENCE_INFO_DESCRIPTOR,
      DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR,
    ]),
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Bed.name, schema: BedSchema },
      { name: DormitoryRosterEntry.name, schema: DormitoryRosterEntrySchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: UtilityConfig.name, schema: UtilityConfigSchema },
      { name: RoomFeeConfig.name, schema: RoomFeeConfigSchema },
      { name: RoomFeeInvoice.name, schema: RoomFeeInvoiceSchema },
      { name: MeterReading.name, schema: MeterReadingSchema },
      { name: Violation.name, schema: ViolationSchema },
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Semester.name, schema: SemesterSchema },
    ]),
  ],
  controllers: [
    BuildingsController,
    RoomsController,
    BedsController,
    DormitoryRosterController,
    ContractsController,
    InvoicesController,
    RoomFeeInvoicesController,
    ViolationsController,
    MaintenanceController,
    DormitoryReportsController,
    DormitoryQrController,
  ],
  providers: [
    BuildingsService,
    RoomsService,
    BedsService,
    ContractsService,
    RoomAssignmentService,
    InvoicesService,
    RoomFeeInvoicesService,
    ViolationsService,
    MaintenanceService,
    DormitoryReportsService,
    DormitoryRosterService,
    DormitoryRosterIdentityService,
  ],
  exports: [
    BuildingsService,
    RoomsService,
    BedsService,
    ContractsService,
    InvoicesService,
    RoomFeeInvoicesService,
  ],
})
export class DormitoryModule {}
