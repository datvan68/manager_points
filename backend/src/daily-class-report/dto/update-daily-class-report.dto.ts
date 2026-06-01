import { PartialType } from '@nestjs/swagger';
import { CreateDailyClassReportDto } from './create-daily-class-report.dto';

export class UpdateDailyClassReportDto extends PartialType(CreateDailyClassReportDto) {}
