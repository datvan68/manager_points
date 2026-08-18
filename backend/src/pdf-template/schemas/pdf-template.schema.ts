import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import type { PdfTemplateAudit, PdfTemplateLayout, PdfTemplatePage } from '../types';

export type PdfTemplateDocument = HydratedDocument<PdfTemplate>;

@Schema({ collection: 'pdf_templates', timestamps: true, versionKey: false })
export class PdfTemplate {
  @Prop({ required: true, trim: true, unique: true, index: true }) templateTypeCode!: string;
  @Prop({ required: true, trim: true }) moduleCode!: string;
  @Prop({ required: true, trim: true }) featureCode!: string;
  @Prop({ required: true, trim: true }) displayName!: string;
  @Prop({ required: true, enum: ['application/pdf'] }) sourceMimeType!: string;
  @Prop({ required: true }) sourceFilename!: string;
  @Prop({ required: true }) sourceChecksum!: string;
  @Prop({ required: true, min: 1 }) sourceBytes!: number;
  @Prop({ required: true, type: Buffer }) sourcePdf!: Buffer;
  @Prop({ required: true, type: MongooseSchema.Types.Mixed }) pages!: PdfTemplatePage[];
  @Prop({ required: true, type: MongooseSchema.Types.Mixed }) layout!: PdfTemplateLayout;
  @Prop({ required: true, min: 1, default: 1 }) version!: number;
  @Prop({ required: true, default: true }) active!: boolean;
  @Prop({ required: true, type: MongooseSchema.Types.Mixed }) audit!: PdfTemplateAudit;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) updatedBy!: Types.ObjectId | null;
}

export const PdfTemplateSchema = SchemaFactory.createForClass(PdfTemplate);
PdfTemplateSchema.index({ templateTypeCode: 1 }, { unique: true });
