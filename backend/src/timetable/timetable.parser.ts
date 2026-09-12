import * as cheerio from 'cheerio';
import {
  TimetableFilters,
  TimetableLesson,
  TimetableOption,
  TimetableOptions,
  TimetableResult,
  TimetableSourceError,
} from './timetable.types';

const clean = (value: string) => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const datePair = (value: string) => {
  const matches = [...value.matchAll(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/g)];
  if (matches.length < 2) return {};
  const iso = (match: RegExpMatchArray) => `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return { startDate: iso(matches[0]), endDate: iso(matches[1]) };
};
const optionList = ($: cheerio.CheerioAPI, selector: string, parent?: Partial<TimetableFilters>): TimetableOption[] =>
  $(selector).find('option').map((_: number, el: any) => {
    const label = clean($(el).text()); const value = $(el).attr('value') || '';
    const dates = { ...datePair(label), ...datePair(`${$(el).attr('data-start-date') || ''} ${$(el).attr('data-end-date') || ''}`) };
    return { label, value, ...(parent && Object.keys(parent).length ? { parent } : {}), ...(dates.startDate && dates.endDate ? dates : {}) };
  }).get().filter((item: TimetableOption) => item.label && item.value && !/^[-\s]*chọn[-\s]*$/i.test(item.label));

function findSelect($: cheerio.CheerioAPI, words: string[]): string {
  let found = '';
  $('select').each((_: number, el: any) => {
    const text = `${$(el).attr('id') || ''} ${$(el).attr('name') || ''} ${$(el).prev('label').text()}`.toLowerCase();
    if (!found && words.some((word) => text.includes(word))) found = `#${($(el).attr('id') || '').replace(/([:.[\],])/g, '\\$1')}`;
  });
  if (found) return found;
  $('select').each((_: number, el: any) => {
    const text = $(el).parent().text().toLowerCase();
    if (!found && words.some((word) => text.includes(word))) found = `#${($(el).attr('id') || '').replace(/([:.[\],])/g, '\\$1')}`;
  });
  return found;
}

export function parseTimetableOptions(html: string, context: Partial<TimetableFilters> = {}): TimetableOptions {
  const $ = cheerio.load(html);
  const selects = $('select').toArray();
  if (selects.length < 3) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Không nhận diện được bộ lọc thời khóa biểu.');
  const parent = (field: keyof TimetableFilters) => Object.fromEntries(Object.entries(context).filter(([key, value]) => key !== field && value)) as Partial<TimetableFilters>;
  const pick = (words: string[], fallback: number, field?: keyof TimetableFilters) => optionList($, findSelect($, words) || `select:eq(${fallback})`, field ? parent(field) : undefined);
  const pickExact = (suffix: string, fallback: number, field?: keyof TimetableFilters) => optionList($, `select[id$="${suffix}"]`, field ? parent(field) : undefined).length ? optionList($, `select[id$="${suffix}"]`, field ? parent(field) : undefined) : pick([], fallback, field);
  return {
    years: pickExact('_ddlYearID', 0, 'year'),
    semesters: pickExact('_ddlSemester', 1, 'semester'),
    weeks: pickExact('_ddlWeek', 2, 'week'),
    faculties: pickExact('_ddlScienceID', 3, 'faculty'),
    courses: pickExact('_ddlCourseID', 4, 'course'),
    classes: pickExact('_ddlClassID', 5, 'className'),
  };
}

function parsePeriod(value: string): number | undefined {
  const match = value.match(/(?:tiết|period|t)\s*(\d+)/i) || value.match(/^\s*(\d+)\s*$/) || value.match(/\b(\d{1,2})\b/);
  return match ? Number(match[1]) : undefined;
}

function parseLesson(text: string, day: number, startPeriod: number, endPeriod: number, classLabel?: string, sessionLabel?: string): TimetableLesson | undefined {
  const lines = text.split(/\n|\r/).map(clean).filter(Boolean);
  if (!lines.length) return undefined;
  const sourceTime = lines.find((line) => /\d{1,2}:\d{2}/.test(line));
  const subjectLine = lines[0];
  const code = subjectLine.match(/\[([^\]]+)\]/)?.[1];
  const rest = lines.slice(1).filter((line) => line !== sourceTime);
  return { day, startPeriod, endPeriod, ...(classLabel ? { classLabel } : {}), ...(sessionLabel ? { sessionLabel } : {}), subject: subjectLine.replace(/\s*\[[^\]]+\]/, '').trim(), ...(code ? { subjectCode: code } : {}), teacher: rest.find((line) => /giảng viên|giáo viên|teacher|^gv\s*:/i.test(line))?.replace(/^.*?:\s*/, ''), room: rest.find((line) => /phòng|room|^p\s*:/i.test(line))?.replace(/^.*?:\s*/, ''), sourceTime };
}

export function parseTimetable(html: string, filters: TimetableFilters): TimetableResult {
  const $ = cheerio.load(html);
  const table = $('table').filter((_: number, el: any) => {
    const text = clean($(el).find('tr').first().text()).toLowerCase();
    return $(el).find('tr').length >= 1 && $(el).find('td,th').length >= 3 && /lớp học|thứ|day|tiết|period/.test(text);
  }).first();
  if (!table.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Không nhận diện được bảng thời khóa biểu.');
  const rows = table.find('tr').toArray();
  type LogicalCell = { element: any; text: string; originRow: number; rowSpan: number; colSpan: number };
  const grid: LogicalCell[][] = [];
  rows.forEach((row: any, rowIndex: number) => {
    grid[rowIndex] ||= [];
    let column = 0;
    $(row).find('th,td').each((_: number, element: any) => {
      while (grid[rowIndex][column]) column += 1;
      const rowSpan = Math.max(1, Number($(element).attr('rowspan') || 1));
      const colSpan = Math.max(1, Number($(element).attr('colspan') || 1));
      const cell: LogicalCell = { element, text: clean($(element).text()), originRow: rowIndex, rowSpan, colSpan };
      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        grid[r] ||= [];
        for (let c = column; c < column + colSpan; c += 1) grid[r][c] = cell;
      }
      column += colSpan;
    });
  });
  const periods = new Set<string>();
  const lessons: TimetableLesson[] = [];
  let classLabel: string | undefined;
  let sessionLabel: string | undefined;
  grid.forEach((logicalRow, rowIndex) => {
    const row = rows[rowIndex];
    if ($(row).find('th').length > 0 && $(row).find('td').length === 0) return;
    const period = parsePeriod(logicalRow[2]?.text || '');
    const classText = logicalRow[0]?.text || '';
    const sessionText = logicalRow[1]?.text || '';
    if (classText && !classLabel) classLabel = classText;
    if (sessionText) sessionLabel = sessionText;
    if (period) periods.add(String(period));
    logicalRow.slice(3, 10).forEach((cell, index) => {
      if (!cell || cell.originRow !== rowIndex || !cell.text || /lớp|buổi|tiết|class|session|period/i.test(cell.text)) return;
      if (!period) return;
      const cellLines = $(cell.element).contents().map((_: number, node: any) => node.type === 'tag' && node.name === 'br' ? '\n' : $(node).text()).get().join('');
      const lesson = parseLesson(cellLines, index + 1, period, period + Math.max(1, cell.rowSpan) - 1, classText, sessionText);
      if (lesson) lessons.push(lesson);
    });
  });
  return { filters, classLabel, sessionLabel, periods: [...periods].sort((a, b) => Number(a) - Number(b)), lessons, isEmpty: lessons.length === 0 };
}
