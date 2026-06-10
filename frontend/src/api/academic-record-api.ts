import { tokenStorage } from './auth-api';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  async getAcademicRecords(): Promise<AcademicRecord[]> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<AcademicRecord[]>(res);
  },

  async getAcademicRecord(id: string): Promise<AcademicRecord> {
    const res = await fetch(`${API_BASE}/academic-records/${id}`);
    return handleResponse<AcademicRecord>(res);
  },

  async getAcademicRecordsByStudent(studentId: string): Promise<AcademicRecord[]> {
    const res = await fetch(`${API_BASE}/academic-records/student/${studentId}`);
    return handleResponse<AcademicRecord[]>(res);
  },

  async getAcademicRecordsByDailyReport(dailyReportId: string): Promise<AcademicRecord[]> {
    const res = await fetch(`${API_BASE}/academic-records/daily-report/${dailyReportId}`);
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
  }
};
