import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type ContractDocument = Contract & Document;

@Schema({ timestamps: true })
export class Contract {
  @Prop({ required: true, unique: true })
  contract_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bed', required: true })
  bed_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'DormitoryRosterEntry' })
  roster_entry_id?: Types.ObjectId;

  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.contractStatus,
    default: 'Hiệu lực',
  })
  status: string;

  @Prop()
  cancellation_reason: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  created_by_id: Types.ObjectId;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
