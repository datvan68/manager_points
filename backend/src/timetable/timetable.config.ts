import { ConfigService } from '@nestjs/config';

export const SCHOOL_TIMETABLE_ORIGIN = 'https://pmdt.namsaigon.edu.vn';
export const SCHOOL_TIMETABLE_URL = `${SCHOOL_TIMETABLE_ORIGIN}/Pages/Sims/ScheduleOfClass.aspx?pt=4`;

export interface TimetableConfig {
  username: string;
  password: string;
  origin: string;
  timeoutMs: number;
  cacheTtlMs: number;
  maxCacheEntries: number;
  sessionIdleTtlMs: number;
  maxSessionContexts: number;
}

export function getTimetableConfig(config: ConfigService): TimetableConfig {
  return {
    username: config.get<string>('TIMETABLE_SOURCE_USERNAME') || '',
    password: config.get<string>('TIMETABLE_SOURCE_PASSWORD') || '',
    origin: SCHOOL_TIMETABLE_ORIGIN,
    timeoutMs: 15_000,
    cacheTtlMs: 60_000,
    maxCacheEntries: 100,
    sessionIdleTtlMs: 5 * 60_000,
    maxSessionContexts: 100,
  };
}
