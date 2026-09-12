import type { TimetableFilters, TimetableOptions } from '@/api/timetable-api';

export const fields = [
  ['year', 'Niên học', 'years'], ['semester', 'Học kỳ', 'semesters'],
  ['week', 'Tuần', 'weeks'], ['faculty', 'Khoa', 'faculties'],
  ['course', 'Khóa', 'courses'], ['className', 'Lớp', 'classes'],
] as const;

export const emptyOptions: TimetableOptions = { years: [], semesters: [], weeks: [], faculties: [], courses: [], classes: [] };
export const emptyFilters: TimetableFilters = { year: '', semester: '', week: '', faculty: '', course: '', className: '' };
export const selectionKey = (filters: TimetableFilters) => JSON.stringify(fields.map(([field]) => filters[field] || ''));

export function changeFilter(filters: TimetableFilters, key: keyof TimetableFilters, value: string): TimetableFilters {
  const index = fields.findIndex(([field]) => field === key);
  return { ...filters, ...Object.fromEntries(fields.slice(index + 1).map(([field]) => [field, ''])), [key]: value };
}
