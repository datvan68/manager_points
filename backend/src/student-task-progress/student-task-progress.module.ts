import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentTaskProgressController } from './student-task-progress.controller';
import { StudentTaskProgressService } from './student-task-progress.service';
import { StudentTaskProgress, StudentTaskProgressSchema } from './schemas/student-task-progress.schema';
import { StudentTask, StudentTaskSchema } from '../student-tasks/schemas/student-task.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Role, RoleSchema } from '../auth/schemas/role.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentTaskProgress.name, schema: StudentTaskProgressSchema },
      { name: StudentTask.name, schema: StudentTaskSchema },
      { name: Student.name, schema: StudentSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [StudentTaskProgressController],
  providers: [StudentTaskProgressService],
  exports: [StudentTaskProgressService],
})
export class StudentTaskProgressModule {}
