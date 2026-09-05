const DOMAIN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarDate = `${number}-${string}-${string}`;

function validParts(year: number, month: number, day: number) {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function formatParts(year: number, month: number, day: number): CalendarDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as CalendarDate;
}

export function parseCalendarDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  return validParts(year, month, day) ? formatParts(year, month, day) : null;
}

export function calendarDateFrom(value: unknown): CalendarDate | null {
  const literal = parseCalendarDate(value);
  if (literal) return literal;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value.trim())) return null;
  const date = value instanceof Date ? value : typeof value === 'string' && value.trim() ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: DOMAIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  const day = Number(parts.find(part => part.type === 'day')?.value);
  return validParts(year, month, day) ? formatParts(year, month, day) : null;
}

export function parseVietnameseDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  return validParts(year, month, day) ? formatParts(year, month, day) : null;
}

export function canonicalDate(value: unknown): Date | null {
  const date = parseCalendarDate(value) || parseVietnameseDate(value) || calendarDateFrom(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function calendarDateRange(value: unknown): { start: Date; end: Date } | null {
  const date = calendarDateFrom(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function calendarDateDistance(left: unknown, right: unknown): number | null {
  const leftDate = calendarDateFrom(left); const rightDate = calendarDateFrom(right);
  if (!leftDate || !rightDate) return null;
  return Math.round(Math.abs(Date.parse(`${leftDate}T00:00:00Z`) - Date.parse(`${rightDate}T00:00:00Z`)) / DAY_MS);
}
