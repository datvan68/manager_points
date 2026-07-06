import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentTask, StudentTaskSchema } from './schemas/student-task.schema';
import { StudentTasksController } from './student-tasks.controller';
import { StudentTasksService } from './student-tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentTaskProgressModule } from '../student-task-progress/student-task-progress.module';

import { Student, StudentSchema } from '../students/schemas/student.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Role, RoleSchema } from '../auth/schemas/role.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import {
  EvaluationPeriod,
  EvaluationPeriodSchema,
} from '../evaluation-periods/schemas/evaluation-period.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentTask.name, schema: StudentTaskSchema },
      { name: Student.name, schema: StudentSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Class.name, schema: ClassSchema },
      { name: EvaluationPeriod.name, schema: EvaluationPeriodSchema },
    ]),
    NotificationsModule,
    StudentTaskProgressModule,
  ],
  controllers: [StudentTasksController],
  providers: [StudentTasksService],
  exports: [StudentTasksService],
})
export class StudentTasksModule {}
