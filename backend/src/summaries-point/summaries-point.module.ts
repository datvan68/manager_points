import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SummariesPointService } from './summaries-point.service';
import { SummariesPointController } from './summaries-point.controller';
import { SummaryPoint, SummaryPointSchema } from './schemas/summary-point.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SummaryPoint.name, schema: SummaryPointSchema }]),
  ],
  controllers: [SummariesPointController],
  providers: [SummariesPointService],
  exports: [SummariesPointService],
})
export class SummariesPointModule {}
