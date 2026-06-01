import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyClassReportService } from './daily-class-report.service';
import { DailyClassReportController } from './daily-class-report.controller';
import { DailyClassReport, DailyClassReportSchema } from './schemas/daily-class-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyClassReport.name, schema: DailyClassReportSchema },
    ]),
  ],
  controllers: [DailyClassReportController],
  providers: [DailyClassReportService],
  exports: [DailyClassReportService],
})
export class DailyClassReportModule {}
