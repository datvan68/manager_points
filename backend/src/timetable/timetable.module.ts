import { Module } from '@nestjs/common';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { SchoolTimetableAdapter } from './school-timetable.adapter';
import { MongooseModule } from '@nestjs/mongoose';
import { TimetableSnapshot, TimetableSnapshotSchema } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateSchema } from './timetable-sync-state.schema';
import { TimetableSyncService } from './timetable-sync.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: TimetableSnapshot.name, schema: TimetableSnapshotSchema },
    { name: TimetableSyncState.name, schema: TimetableSyncStateSchema },
  ])],
  controllers: [TimetableController],
  providers: [TimetableService, SchoolTimetableAdapter, TimetableSyncService],
})
export class TimetableModule {}
