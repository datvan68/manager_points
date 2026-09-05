import { IsMongoId, IsOptional, Max, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconcileRosterDto {
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
