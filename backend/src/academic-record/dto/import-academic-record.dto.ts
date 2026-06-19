import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class ImportAcademicRecordRequestDto {
  @ApiProperty({ description: 'Danh sách các dòng dữ liệu từ file Excel', type: [Object] })
  @IsArray()
  rows: any[];
}

export class ImportAcademicRecordCommitDto {
  @ApiProperty({ description: 'ID của phiên import (lấy từ preview)' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class ImportAcademicRecordPreviewResultDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  totalRows: number;

  @ApiProperty()
  validCount: number;

  @ApiProperty()
  errorCount: number;

  @ApiProperty()
  errors: any[];
}

export class ImportAcademicRecordCommitResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

export class ImportAcademicRecordProgressDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  processedCount: number;

  @ApiProperty()
  insertedCount: number;

  @ApiProperty()
  duplicatedCount: number;

  @ApiProperty()
  totalRows: number;

  @ApiProperty()
  failedItems: any[];
}
