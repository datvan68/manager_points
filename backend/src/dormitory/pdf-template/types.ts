import { PdfTemplateFieldDto } from './dto/update-pdf-template.dto';

export type CreatePdfTemplateDraftInput = { revision: number; fields: PdfTemplateFieldDto[] };

