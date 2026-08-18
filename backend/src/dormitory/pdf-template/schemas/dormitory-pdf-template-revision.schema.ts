import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PdfTemplateRevisionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
export type DormitoryPdfTemplateRevisionDocument = HydratedDocument<DormitoryPdfTemplateRevision>;

@Schema({ timestamps: true, collection: 'dormitory_pdf_template_revisions' })
export class DormitoryPdfTemplateRevision {
  @Prop({ required: true, index: true }) template_code: string;
  @Prop({ type: Types.ObjectId, ref: 'DormitoryPdfTemplate', required: true, index: true }) template_id: Types.ObjectId;
  @Prop({ required: true }) revision: number;
  @Prop({ required: true, default: 0 }) revision_token: number;
  @Prop({ required: true, enum: ['DRAFT', 'PUBLISHED', 'SUPERSEDED'], index: true }) status: PdfTemplateRevisionStatus;
  @Prop({ required: true }) source_filename: string;
  @Prop({ required: true }) source_checksum: string;
  @Prop({ required: true }) layout_checksum: string;
  @Prop({ type: Buffer, required: true, select: false }) source_pdf: Buffer;
  @Prop({ type: Object, required: true }) layout: Record<string, unknown>;
  @Prop({ type: Types.ObjectId, default: null }) created_by?: Types.ObjectId | null;
  @Prop({ type: Types.ObjectId, default: null }) published_by?: Types.ObjectId | null;
  @Prop({ type: Date, default: null }) published_at?: Date | null;
}

export const DormitoryPdfTemplateRevisionSchema = SchemaFactory.createForClass(DormitoryPdfTemplateRevision);
DormitoryPdfTemplateRevisionSchema.index({ template_code: 1, revision: 1 }, { unique: true });
DormitoryPdfTemplateRevisionSchema.index({ template_code: 1, status: 1 });

