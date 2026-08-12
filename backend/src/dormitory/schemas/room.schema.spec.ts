import { RoomSchema } from './room.schema';
import { BuildingSchema } from './building.schema';
import { CreateRoomDto } from '../dto/create-room.dto';
import { CreateBuildingDto } from '../dto/create-building.dto';
import { ValidationPipe } from '@nestjs/common';

describe('Dormitory schemas', () => {
  it('does not support obsolete floor fields', () => {
    expect(RoomSchema.path('floor')).toBeUndefined();
    expect(BuildingSchema.path('floor_count')).toBeUndefined();
  });

  it('rejects obsolete floor fields under the global validation contract', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ room_code: 'A101', room_name: 'A101', building_id: '507f1f77bcf86cd799439011', floor: 1, room_type: 'Thường', bed_count: 4, room_price: 1 }, { type: 'body', metatype: CreateRoomDto })).rejects.toThrow();
    await expect(pipe.transform({ building_code: 'A', name: 'A', floor_count: 2 }, { type: 'body', metatype: CreateBuildingDto })).rejects.toThrow();
  });
});
