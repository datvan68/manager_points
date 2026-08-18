import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentAccountSyncController } from './student-account-sync.controller';
import { Student, StudentSchema } from './schemas/student.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from '../auth/schemas/refresh-token.schema';
import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';
import {
  SummaryPoint,
  SummaryPointSchema,
} from '../summaries-point/schemas/summary-point.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Role, RoleSchema } from '../auth/schemas/role.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { DormitoryRosterEntry, DormitoryRosterEntrySchema } from '../dormitory/schemas/dormitory-roster-entry.schema';
import { DormitoryRosterIdentityService } from '../dormitory/services/dormitory-roster-identity.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: Semester.name, schema: SemesterSchema },
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Class.name, schema: ClassSchema },
      { name: DormitoryRosterEntry.name, schema: DormitoryRosterEntrySchema },
    ]),
  ],
  controllers: [StudentsController, StudentAccountSyncController],
  providers: [StudentsService, DormitoryRosterIdentityService],
  exports: [StudentsService],
})
export class StudentsModule {}
