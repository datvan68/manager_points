import { IsBoolean, IsOptional } from 'class-validator';

export class PreviewPdfTemplateDto {
  @IsOptional() @IsBoolean() realRoster?: boolean;
  @IsOptional() rosterEntryId?: string;
}

