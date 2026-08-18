import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class PdfTemplateStyleDto {
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() @IsNumber() @Min(6) @Max(48) fontSize?: number;
  @IsOptional() @IsNumber() @Min(5) @Max(48) minFontSize?: number;
  @IsOptional() @IsInt() fontWeight?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() horizontalAlign?: string;
  @IsOptional() @IsString() verticalAlign?: string;
  @IsOptional() @IsNumber() @Min(0.8) @Max(3) lineHeight?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(12) padding?: number;
  @IsOptional() @IsString() background?: string;
  @IsOptional() @IsString() overflow?: string;
  @IsOptional() @IsInt() @Min(1) @Max(8) maxLines?: number;
}

export class PdfTemplateFieldDto {
  @IsString() key: string;
  @IsInt() @Min(0) pageIndex: number;
  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
  @IsNumber() @Min(0.0001) @Max(1) width: number;
  @IsNumber() @Min(0.0001) @Max(1) height: number;
  @IsNumber() @Min(-180) @Max(180) rotation: number;
  @IsNumber() @Min(-10000) @Max(10000) zIndex: number;
  @IsOptional() @IsString() formatter?: string;
  @ValidateNested() @Type(() => PdfTemplateStyleDto) style: PdfTemplateStyleDto;
}

export class UpdatePdfTemplateDto {
  @IsInt() @Min(0) revision: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PdfTemplateFieldDto) fields: PdfTemplateFieldDto[];
}

