import { tokenStorage } from './auth-api';
import { API_BASE } from './config';

export interface AcademicRecord {
  _id: string;
  student_id: any | string;
  criterion_id: any | string;
  semester_id: any | string;
  daily_report_id?: any | string;
  record_title?: string;
  description?: string;
  evidence_url?: string;
  recorded_by?: any | string;
  recorded_at?: string;
  status: 'active' | 'inactive';
  is_deleted?: boolean;
  source_type?: string;
  source_id?: any;
  createdAt?: string;
  updatedAt?: string;

  // Tương thích ngược với dữ liệu cũ
  evaluation_detail_id?: any | string;
  criteria_id?: any | string;
  points_effect?: number;
  quantity?: number;
  date_record?: string;
}

export interface PaginatedAcademicRecords {
  data: AcademicRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  has_more: boolean;
}

export interface CreateAcademicRecordDto {
  student_id: string;
  criterion_id: string;
  semester_id: string;
  daily_report_id?: string;
  record_title?: string;
  description?: string;
  evidence_url?: string;
  recorded_by?: string;
  recorded_at?: string;
  status?: 'active' | 'inactive';
  idempotency_key?: string;
  source?: string;
}

export interface IntentScoreDto {
  student_id: string;
  criterion_id: string;
  semester_id: string;
  intent_type: 'increase' | 'decrease' | 'set_target_count' | 'select_option' | 'set_manual_score' | 'clear_score';
  target_count?: number;
  manual_score?: number;
  selected_option_id?: string;
  note?: string;
  baseline_count?: number;
}

export interface UpdateAcademicRecordDto {
  student_id?: string;
  criterion_id?: string;
  semester_id?: string;
  daily_report_id?: string;
  record_title?: string;
  description?: string;
  evidence_url?: string;
  recorded_by?: string;
  recorded_at?: string;
  status?: 'active' | 'inactive';
}

export interface BulkDeleteAcademicRecordsResult {
  requested: number;
  succeeded: string[];
  failed: Array<{ id: string; message: string }>;
  succeededCount: number;
  failedCount: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.message || data.error || 'Đã xảy ra lỗi');
    (error as any).status = res.status;
    throw error;
  }
  return data as T;
}

export const academicRecordApi = {
  async getAcademicRecords(params?: {
    page?: number;
    limit?: number;
    search?: string;
    classId?: string;
    semesterId?: string;
    studentId?: string;
    startDate?: string;
    endDate?: string;
    creator?: string;
  }): Promise<AcademicRecord[] | { data: AcademicRecord[]; meta: any }> {
    const token = tokenStorage.getAccessToken() || '';
    const queryParts: string[] = [];
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParts.push(`${key}=${encodeURIComponent(val)}`);
        }
      });
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const res = await fetch(`${API_BASE}/academic-records${queryString}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<any>(res);
  },

  async getAcademicRecord(id: string): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/${id}`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    });
    return handleResponse<AcademicRecord>(res);
  },

  async sendIntent(intent: IntentScoreDto): Promise<{
    success: boolean;
    actual_count: number;
    evaluation_detail: any;
    sync_status?: 'synced' | 'summary_missing' | 'summary_locked';
    warning_code?: string;
    summary?: {
      _id: string;
      total_score: number | null;
      grading: string | null;
      status: string;
    } | null;
  }> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(intent),
    });
    return handleResponse(res);
  },

  async getAcademicRecordsByStudent(
    studentId: string,
    params?: { page?: number; limit?: number },
  ): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const queryParts: string[] = [];
    if (params) {
      if (params.page !== undefined) queryParts.push(`page=${encodeURIComponent(params.page)}`);
      if (params.limit !== undefined) queryParts.push(`limit=${encodeURIComponent(params.limit)}`);
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const res = await fetch(`${API_BASE}/academic-records/student/${studentId}${queryString}`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    });
    return handleResponse<any>(res);
  },

  async getAcademicRecordsByDailyReport(dailyReportId: string): Promise<AcademicRecord[]> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/daily-report/${dailyReportId}`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    });
    return handleResponse<AcademicRecord[]>(res);
  },

  async createAcademicRecord(dto: CreateAcademicRecordDto): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<AcademicRecord>(res);
  },

  async bulkCreateAcademicRecords(records: CreateAcademicRecordDto[]): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ records }),
    });
    return handleResponse<any>(res);
  },

  async updateAcademicRecord(id: string, dto: UpdateAcademicRecordDto, bypassDailyReportCheck?: boolean): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const query = bypassDailyReportCheck ? '?bypassDailyReportCheck=true' : '';
    const res = await fetch(`${API_BASE}/academic-records/${id}${query}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<AcademicRecord>(res);
  },

  async deleteAcademicRecord(id: string, bypassDailyReportCheck?: boolean): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const query = bypassDailyReportCheck ? '?bypassDailyReportCheck=true' : '';
    const res = await fetch(`${API_BASE}/academic-records/${id}${query}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<AcademicRecord>(res);
  },

  async bulkDeleteAcademicRecords(ids: string[]): Promise<BulkDeleteAcademicRecordsResult> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/bulk`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    });
    return handleResponse<BulkDeleteAcademicRecordsResult>(res);
  },

  async getDeletedAcademicRecords(): Promise<AcademicRecord[]> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/deleted/all`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<AcademicRecord[]>(res);
  },

  async restoreAcademicRecord(id: string): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/${id}/restore`, {
      method: 'PATCH',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<AcademicRecord>(res);
  },

  async forceDeleteAcademicRecord(id: string, bypassDailyReportCheck?: boolean): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const query = bypassDailyReportCheck ? '?bypassDailyReportCheck=true' : '';
    const res = await fetch(`${API_BASE}/academic-records/${id}/force${query}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<AcademicRecord>(res);
  },

  async bulkForceDeleteAcademicRecords(ids: string[]): Promise<BulkDeleteAcademicRecordsResult> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/bulk/force`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids }),
    });
    return handleResponse<BulkDeleteAcademicRecordsResult>(res);
  },
  async previewPurgeAcademicRecords(startDate: string, endDate: string): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/purge/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ startDate, endDate }),
    });
    return handleResponse<any>(res);
  },
  async purgeAcademicRecords(startDate: string, endDate: string): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/purge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ startDate, endDate }),
    });
    return handleResponse<any>(res);
  },
  async previewImportRecords(rows: any[]): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/import/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ rows }),
    });
    return handleResponse<any>(res);
  },

  async commitImportRecords(sessionId: string): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/import/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessionId }),
    });
    return handleResponse<any>(res);
  },

  async getImportProgress(sessionId: string): Promise<any> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/import/${sessionId}/progress`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<any>(res);
  }
};

