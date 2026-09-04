import { IsMongoId, IsOptional, IsString, Max, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconcileRosterDto {
  @IsMongoId()
  semester_id: string;

  @IsOptional()
  @IsMongoId()
  after_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
