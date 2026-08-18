import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PdfTemplateController } from './pdf-template.controller';
import { PdfTemplateService } from './pdf-template.service';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';
import { PdfTemplateRendererService } from './pdf-template-renderer.service';
import { PdfTemplateRegistry } from './registry';
import { PdfTemplateSchema, PdfTemplate } from './schemas/pdf-template.schema';
import { PDF_TEMPLATE_DESCRIPTORS } from './tokens';
import { PdfTemplateTypeDescriptor } from './types';

@Module({ imports: [MongooseModule.forFeature([{ name: PdfTemplate.name, schema: PdfTemplateSchema }])], controllers: [PdfTemplateController], providers: [PdfTemplateRegistry, PdfTemplateService, PdfTemplateIntakeService, PdfTemplateRendererService], exports: [PdfTemplateRegistry, PdfTemplateService, PdfTemplateRendererService] })
export class PdfTemplateModule {
  static register(descriptors: PdfTemplateTypeDescriptor[]): DynamicModule { return { module: PdfTemplateModule, providers: [{ provide: PDF_TEMPLATE_DESCRIPTORS, useValue: descriptors }] }; }
}

