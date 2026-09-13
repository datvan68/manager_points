export interface TimetableFilters {
  year: string;
  semester: string;
  week: string;
  faculty?: string;
  course?: string;
  className?: string;
}

export interface TimetableOption {
  label: string;
  value: string;
  parent?: Partial<TimetableFilters>;
  startDate?: string;
  endDate?: string;
}

export interface TimetableWeekDate {
  year: string;
  semester: string;
  week: string;
  startDate: string;
  endDate: string;
}

export interface TimetableClassSelection {
  year: string;
  semester: string;
  faculty?: string;
  course?: string;
  className: string;
  weekCount?: number;
}

export interface TimetableRollingPolicy {
  enabled: boolean;
  weekDates?: TimetableWeekDate[];
}

export interface TimetableSyncSettings {
  enabled: boolean;
  intervalMinutes: number;
  coverage: TimetableFilters[];
  selectedClasses?: TimetableClassSelection[];
  rolling?: TimetableRollingPolicy;
}

export interface TimetableClassSyncStatus {
  classSelection: TimetableClassSelection;
  weekCount: number;
  targetWeeks: string[];
  status: 'valid' | 'pending' | 'running' | 'failed' | 'missing' | 'configuration';
  weeks: Array<{ week: string; status: 'valid' | 'pending' | 'running' | 'failed' | 'missing'; failure?: string }>;
  error?: string;
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
  availableCoverage?: TimetableFilters[];
  selectedClasses?: TimetableClassSelection[];
  rolling?: TimetableRollingPolicy;
  weekDates?: TimetableWeekDate[];
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
  status?: 'valid' | 'pending' | 'failed' | 'missing' | 'busy';
  pending?: boolean;
  refresh?: { pending: boolean; stale: boolean; lastSuccessfulUpdate?: string; failure?: string };
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
