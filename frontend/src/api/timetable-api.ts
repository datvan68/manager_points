import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';

export interface TimetableOption { label: string; value: string }
export interface TimetableFilters { year: string; semester: string; week: string; faculty?: string; course?: string; className?: string }
export interface TimetableOptions { years: TimetableOption[]; semesters: TimetableOption[]; weeks: TimetableOption[]; faculties: TimetableOption[]; courses: TimetableOption[]; classes: TimetableOption[] }
export interface TimetableLesson { classLabel?: string; sessionLabel?: string; day: number; startPeriod: number; endPeriod: number; subject: string; subjectCode?: string; teacher?: string; room?: string; onlineUrl?: string; sourceTime?: string }
export interface TimetableResult { filters: TimetableFilters; classLabel?: string; sessionLabel?: string; periods: string[]; lessons: TimetableLesson[]; isEmpty: boolean }

const query = (values: Partial<TimetableFilters>) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, value as string])).toString();
export const timetableApi = {
  async getOptions(filters: Partial<TimetableFilters> = {}) { return handleResponse<TimetableOptions>(await httpClient(`${API_BASE}/timetable/options?${query(filters)}`)); },
  async getTimetable(filters: TimetableFilters) { return handleResponse<TimetableResult>(await httpClient(`${API_BASE}/timetable?${query(filters)}`)); },
};
