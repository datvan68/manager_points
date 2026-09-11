export interface TimetableOption {
  label: string;
  value: string;
}

export interface TimetableFilters {
  year: string;
  semester: string;
  week: string;
  faculty?: string;
  course?: string;
  className?: string;
}

export interface TimetableOptions {
  years: TimetableOption[];
  semesters: TimetableOption[];
  weeks: TimetableOption[];
  faculties: TimetableOption[];
  courses: TimetableOption[];
  classes: TimetableOption[];
  syncedAt?: string;
  coverage?: string[];
}

export interface TimetableLesson {
  classLabel?: string;
  sessionLabel?: string;
  day: number;
  startPeriod: number;
  endPeriod: number;
  subject: string;
  subjectCode?: string;
  teacher?: string;
  room?: string;
  onlineUrl?: string;
  sourceTime?: string;
}

export interface TimetableResult {
  filters: TimetableFilters;
  classLabel?: string;
  sessionLabel?: string;
  periods: string[];
  lessons: TimetableLesson[];
  isEmpty: boolean;
  syncedAt?: string;
  coverageKey?: string;
}

export interface TimetableSourcePage {
  html: string;
  url: string;
}

export type TimetableSourceErrorCode =
  | 'SOURCE_NOT_CONFIGURED'
  | 'SOURCE_SESSION_EXPIRED'
  | 'SOURCE_TIMEOUT'
  | 'SOURCE_INVALID_SELECTION'
  | 'SOURCE_MARKUP_CHANGED'
  | 'SOURCE_UNAVAILABLE';

export class TimetableSourceError extends Error {
  constructor(
    public readonly code: TimetableSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TimetableSourceError';
  }
}
