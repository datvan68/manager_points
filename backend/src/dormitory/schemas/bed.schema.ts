import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';
import { Room } from './room.schema';

export type BedDocument = Bed & Document;

@Schema({ timestamps: true })
export class Bed {
  @Prop({ required: true })
  bed_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId | Room;

  @Prop()
  position: string; // e.g. 'Tầng 1 - Trái', 'Tầng 2 - Phải'

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.bedStatus,
    default: 'Trống',
  })
  status: string;
}

export const BedSchema = SchemaFactory.createForClass(Bed);

// Compound unique index: bed_code unique within a room
BedSchema.index({ bed_code: 1, room_id: 1 }, { unique: true });
