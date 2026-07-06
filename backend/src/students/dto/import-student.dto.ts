import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ImportStudentRequestDto {
  @ApiProperty({ description: 'ID của lớp học cần import sinh viên' })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiProperty({ description: 'Danh sách các dòng dữ liệu từ file Excel', type: [Object] })
  @IsArray()
  rows: any[];
}

export class ImportStudentCommitDto {
  @ApiProperty({ description: 'ID của phiên import (lấy từ preview)' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class ImportStudentPreviewResultDto {
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

export class ImportStudentCommitResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

export class ImportStudentProgressDto {
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

  @ApiProperty()
  acceptedCount: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty()
  skippedCount: number;
}
