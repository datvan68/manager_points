import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SemestersService } from './semesters.service';
import { SemestersController } from './semesters.controller';
import { Semester, SemesterSchema } from './schemas/semester.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Semester.name, schema: SemesterSchema }]),
  ],
  controllers: [SemestersController],
  providers: [SemestersService],
  exports: [SemestersService],
})
export class SemestersModule {}
