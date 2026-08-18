import { PartialType } from '@nestjs/swagger';
import { CreateRosterEntryDto } from './create-roster-entry.dto';

export class UpdateRosterEntryDto extends PartialType(CreateRosterEntryDto) {}
