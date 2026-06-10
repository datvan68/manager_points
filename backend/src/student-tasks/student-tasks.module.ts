import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentTask, StudentTaskSchema } from './schemas/student-task.schema';
import { StudentTasksController } from './student-tasks.controller';
import { StudentTasksService } from './student-tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentTaskProgressModule } from '../student-task-progress/student-task-progress.module';

import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentTask.name, schema: StudentTaskSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
    NotificationsModule,
    StudentTaskProgressModule,
  ],
  controllers: [StudentTasksController],
  providers: [StudentTasksService],
  exports: [StudentTasksService],
})
export class StudentTasksModule {}
