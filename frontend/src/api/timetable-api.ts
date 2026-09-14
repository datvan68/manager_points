import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';

export interface TimetableOption { label: string; value: string; parent?: Partial<TimetableFilters>; startDate?: string; endDate?: string }
export interface TimetableFilters { year: string; semester: string; week: string; faculty?: string; course?: string; className?: string }
export interface TimetableClassSelection { year: string; semester: string; faculty?: string; course?: string; className: string; weekCount?: number; derivedFromSystemClassId?: string }
export interface TimetableClassLink extends TimetableClassSelection { systemClassId: string; sourceLabel: string; matchMethod: 'auto' | 'manual' }
export interface TimetableWeekDate { year: string; semester: string; week: string; startDate: string; endDate: string }
export interface TimetableRollingPolicy { enabled: boolean; weekDates?: TimetableWeekDate[] }
export interface TimetableSourcePeriod { year: string; semester: string }
export interface TimetableOptions { years: TimetableOption[]; semesters: TimetableOption[]; weeks: TimetableOption[]; faculties: TimetableOption[]; courses: TimetableOption[]; classes: TimetableOption[]; syncedAt?: string; coverage?: string[]; availableCoverage?: TimetableFilters[]; selectedClasses?: TimetableClassSelection[]; classLinks?: TimetableClassLink[]; rolling?: TimetableRollingPolicy; weekDates?: TimetableWeekDate[] }
export interface TimetableLesson { classLabel?: string; sessionLabel?: string; day: number; startPeriod: number; endPeriod: number; subject: string; subjectCode?: string; teacher?: string; room?: string; onlineUrl?: string; sourceTime?: string }
export interface TimetableResult { filters: TimetableFilters; classLabel?: string; sessionLabel?: string; periods: string[]; lessons: TimetableLesson[]; isEmpty: boolean; syncedAt?: string; coverageKey?: string; status?: 'valid' | 'pending' | 'failed' | 'missing' | 'busy'; pending?: boolean; refresh?: { pending: boolean; stale: boolean; lastSuccessfulUpdate?: string; failure?: string } }
export interface TimetableSyncJob { id: string; status: string; total?: number; completed?: number; error?: string; coverage?: TimetableFilters[]; failures?: Array<{ coverage: TimetableFilters; reason: string }> }
export interface TimetableClassSyncStatus { classSelection: TimetableClassSelection; weekCount: number; targetWeeks: string[]; status: string; weeks: Array<{ week: string; label?: string; startDate?: string; endDate?: string; status: string; failure?: string; snapshotExists?: boolean; lastSuccessfulUpdate?: string; isEmpty?: boolean }>; error?: string }
export type TimetableWeekSyncIntent = 'sync' | 'update';
export interface TimetableWeekSyncRequest extends TimetableClassSelection { week: string; intent?: TimetableWeekSyncIntent }
export interface TimetableBulkWeekSyncRequest extends TimetableClassLink { week: string }
export interface TimetableWeekSyncStatus { key: string; selection: TimetableFilters; status: string; snapshotExists: boolean; lastSuccessfulUpdate: string | null; isEmpty: boolean; failure?: string | null; cooldownUntil?: string | null }
export interface TimetableSyncSettings { enabled: boolean; intervalMinutes: number; coverage: TimetableFilters[]; sourcePeriod?: TimetableSourcePeriod; selectedClasses?: TimetableClassSelection[]; classLinks?: TimetableClassLink[]; rolling?: TimetableRollingPolicy }
export interface TimetableSnapshotMetadata extends TimetableFilters { coverageKey: string; syncedAt: string; jobId: string }
export interface TimetableSnapshotsQuery extends Partial<TimetableFilters> { page?: number; limit?: number }
export interface TimetableSnapshotsResponse { data: TimetableSnapshotMetadata[]; total: number; page: number; limit: number; totalPages: number }

const query = (values: object) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])).toString();
// Linked-class metadata belongs to settings, not the saved-class sync DTOs.
const classSyncPayload = ({ year, semester, faculty, course, className, weekCount }: TimetableClassSelection) => ({ year, semester, faculty, course, className, weekCount });
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Nguồn thời khóa biểu phản hồi quá lâu. Vui lòng thử lại.'));
      controller.abort();
    }, 45000);
  });
  try {
    return await Promise.race([
      httpClient(url, { ...options, signal: controller.signal }).then(handleResponse<T>),
      timeout,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export const timetableApi = {
  async getOptions(filters: Partial<TimetableFilters> = {}) { return request<TimetableOptions>(`${API_BASE}/timetable/options?${query(filters)}`); },
  async getTimetable(filters: TimetableFilters) { return request<TimetableResult>(`${API_BASE}/timetable?${query(filters)}`); },
  async getSnapshots(filters: TimetableSnapshotsQuery = {}) { return request<TimetableSnapshotsResponse>(`${API_BASE}/timetable/snapshots?${query(filters)}`); },
  async requestDemand(filters: TimetableFilters) { return request<TimetableResult>(`${API_BASE}/timetable/demand`, { method: 'POST', body: JSON.stringify(filters), headers: { 'Content-Type': 'application/json' } }); },
  async loadCatalog(filters: Partial<TimetableFilters> = {}) { return request<TimetableOptions>(`${API_BASE}/timetable/sync/catalog?${query(filters)}`, { method: 'POST' }); },
  async startSync(coverage: TimetableFilters[]) { return request<{ id: string; status: string; total: number }>(`${API_BASE}/timetable/sync`, { method: 'POST', body: JSON.stringify({ coverage }), headers: { 'Content-Type': 'application/json' } }); },
  async getSyncStatus() { return request<{ job: TimetableSyncJob | null; settings: TimetableSyncSettings; lastSuccessfulUpdate: string | null; classStatuses?: TimetableClassSyncStatus[] }>(`${API_BASE}/timetable/sync/status`); },
  async getSyncSettings() { return request<TimetableSyncSettings>(`${API_BASE}/timetable/sync/settings`); },
  async updateSyncSettings(settings: TimetableSyncSettings) { return request<TimetableSyncSettings>(`${API_BASE}/timetable/sync/settings`, { method: 'PATCH', body: JSON.stringify(settings), headers: { 'Content-Type': 'application/json' } }); },
  async startSavedClassSync(selection: TimetableClassSelection) { return request<{ id: string; status: string; total: number }>(`${API_BASE}/timetable/sync/class`, { method: 'POST', body: JSON.stringify(classSyncPayload(selection)), headers: { 'Content-Type': 'application/json' } }); },
  async getSavedClassWeekStatus(selection: TimetableWeekSyncRequest) { return request<TimetableWeekSyncStatus>(`${API_BASE}/timetable/sync/class/week/status?${query({ year: selection.year, semester: selection.semester, faculty: selection.faculty, course: selection.course, className: selection.className, week: selection.week })}`); },
  async syncSavedClassWeek(selection: TimetableWeekSyncRequest, intent: TimetableWeekSyncIntent) { return request<{ status: string; key: string; selection: TimetableFilters; cooldown?: boolean }>(`${API_BASE}/timetable/sync/class/week`, { method: 'POST', body: JSON.stringify({ ...classSyncPayload(selection), week: selection.week, intent }), headers: { 'Content-Type': 'application/json' } }); },
  async syncSavedClassWeeks(selections: TimetableBulkWeekSyncRequest[]) { return request<{ id: string; status: string; total: number }>(`${API_BASE}/timetable/sync/class/weeks`, { method: 'POST', body: JSON.stringify({ selections }), headers: { 'Content-Type': 'application/json' } }); },
  async getDemandStatus(filters: TimetableFilters) { return request<{ status: string; key: string; failure?: string }>(`${API_BASE}/timetable/demand/status?${query(filters)}`); },
  async refreshTimetable(filters: TimetableFilters) { return request<{ status: string; key: string }>(`${API_BASE}/timetable/refresh`, { method: 'POST', body: JSON.stringify(filters), headers: { 'Content-Type': 'application/json' } }); },
};
