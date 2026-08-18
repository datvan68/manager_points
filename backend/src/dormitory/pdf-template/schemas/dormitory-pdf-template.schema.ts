import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DormitoryPdfTemplateDocument = HydratedDocument<DormitoryPdfTemplate>;

@Schema({ timestamps: true, collection: 'dormitory_pdf_templates' })
export class DormitoryPdfTemplate {
  @Prop({ required: true, unique: true, index: true }) template_code: string;
  @Prop({ required: true }) name: string;
  @Prop({ default: true }) active: boolean;
  @Prop({ type: Types.ObjectId, ref: 'DormitoryPdfTemplateRevision', default: null }) active_revision_id?: Types.ObjectId | null;
  @Prop({ default: 0 }) current_revision: number;
  @Prop({ type: Types.ObjectId, default: null }) updated_by?: Types.ObjectId | null;
}

export const DormitoryPdfTemplateSchema = SchemaFactory.createForClass(DormitoryPdfTemplate);

