import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SummariesPointService } from './summaries-point.service';
import { SummariesPointController } from './summaries-point.controller';
import { GradingRealtimeService } from './grading-realtime.service';
import {
  SummaryPoint,
  SummaryPointSchema,
} from './schemas/summary-point.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Criterion, CriterionSchema } from '../criteria/schemas/criterion.schema';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Criterion.name, schema: CriterionSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Semester.name, schema: SemesterSchema },
    ]),
  ],
  controllers: [SummariesPointController],
  providers: [SummariesPointService, GradingRealtimeService],
  exports: [SummariesPointService, GradingRealtimeService],
})
export class SummariesPointModule {}
