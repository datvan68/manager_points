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
  createdAt?: string;
  updatedAt?: string;

  // Tương thích ngược với dữ liệu cũ
  evaluation_detail_id?: any | string;
  criteria_id?: any | string;
  points_effect?: number;
  date_record?: string;
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

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
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

  async getAcademicRecordsByStudent(studentId: string): Promise<AcademicRecord[]> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/student/${studentId}`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    });
    return handleResponse<AcademicRecord[]>(res);
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

