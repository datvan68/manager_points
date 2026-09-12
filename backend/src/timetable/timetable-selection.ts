import { TimetableFilters } from './timetable.types';

export const timetableFields = ['year', 'semester', 'week', 'faculty', 'course', 'className'] as const;

export const timetableKey = (filters: Partial<TimetableFilters>) =>
  JSON.stringify(timetableFields.map((field) => [field, filters[field] || '']));
