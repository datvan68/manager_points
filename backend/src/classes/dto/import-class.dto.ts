import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportClassRowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  class_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  class_year: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  department_code: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  advisor_email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  class_course?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  headquarters?: string;
}

export class ImportClassConfirmDto {
  @ApiProperty({ type: [ImportClassRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportClassRowDto)
  rows: ImportClassRowDto[];

  @ApiProperty({ required: false, default: 'skip_duplicates' })
  @IsString()
  @IsOptional()
  mode?: 'skip_duplicates' | 'fail_on_duplicates';
}
