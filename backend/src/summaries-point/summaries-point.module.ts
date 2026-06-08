import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SummariesPointService } from './summaries-point.service';
import { SummariesPointController } from './summaries-point.controller';
import {
  SummaryPoint,
  SummaryPointSchema,
} from './schemas/summary-point.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Class.name, schema: ClassSchema },
    ]),
  ],
  controllers: [SummariesPointController],
  providers: [SummariesPointService],
  exports: [SummariesPointService],
})
export class SummariesPointModule {}
