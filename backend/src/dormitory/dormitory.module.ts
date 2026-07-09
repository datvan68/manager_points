import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { Building, BuildingSchema } from './schemas/building.schema';
import { Room, RoomSchema } from './schemas/room.schema';
import { Bed, BedSchema } from './schemas/bed.schema';
import {
  Registration,
  RegistrationSchema,
} from './schemas/registration.schema';
import { Contract, ContractSchema } from './schemas/contract.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Violation, ViolationSchema } from './schemas/violation.schema';
import {
  MaintenanceRequest,
  MaintenanceRequestSchema,
} from './schemas/maintenance-request.schema';
import {
  PublicRegistration,
  PublicRegistrationSchema,
} from './schemas/public-registration.schema';

// Services
import { BuildingsService } from './services/buildings.service';
import { RoomsService } from './services/rooms.service';
import { BedsService } from './services/beds.service';
import { RegistrationsService } from './services/registrations.service';
import { ContractsService } from './services/contracts.service';
import { RoomAssignmentService } from './services/room-assignment.service';
import { InvoicesService } from './services/invoices.service';
import { ViolationsService } from './services/violations.service';
import { MaintenanceService } from './services/maintenance.service';
import { DormitoryReportsService } from './services/dormitory-reports.service';
import { PublicRegistrationLinkService } from './services/public-registration-link.service';

// Controllers
import { BuildingsController } from './controllers/buildings.controller';
import { RoomsController } from './controllers/rooms.controller';
import { BedsController } from './controllers/beds.controller';
import { RegistrationsController } from './controllers/registrations.controller';
import { ContractsController } from './controllers/contracts.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { ViolationsController } from './controllers/violations.controller';
import { MaintenanceController } from './controllers/maintenance.controller';
import { DormitoryReportsController } from './controllers/dormitory-reports.controller';
import { DormitoryQrController } from './controllers/dormitory-qr.controller';

// External schemas needed for cross-references
import {
  Student,
  StudentSchema,
} from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Bed.name, schema: BedSchema },
      { name: Registration.name, schema: RegistrationSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Violation.name, schema: ViolationSchema },
      { name: MaintenanceRequest.name, schema: MaintenanceRequestSchema },
      { name: PublicRegistration.name, schema: PublicRegistrationSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [
    BuildingsController,
    RoomsController,
    BedsController,
    RegistrationsController,
    ContractsController,
    InvoicesController,
    ViolationsController,
    MaintenanceController,
    DormitoryReportsController,
    DormitoryQrController,
  ],
  providers: [
    BuildingsService,
    RoomsService,
    BedsService,
    RegistrationsService,
    ContractsService,
    RoomAssignmentService,
    InvoicesService,
    ViolationsService,
    MaintenanceService,
    DormitoryReportsService,
    PublicRegistrationLinkService,
  ],
  exports: [
    BuildingsService,
    RoomsService,
    BedsService,
    ContractsService,
    InvoicesService,
  ],
})
export class DormitoryModule {}
