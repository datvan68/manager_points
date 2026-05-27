
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student, StudentSchema } from './schemas/student.schema';
import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';
import { SummaryPoint, SummaryPointSchema } from '../summaries-point/schemas/summary-point.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: Semester.name, schema: SemesterSchema },
      { name: SummaryPoint.name, schema: SummaryPointSchema }
    ]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
