import { tokenStorage } from './auth-api';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AcademicRecord {
  _id: string;
  evaluation_detail_id?: any | string;
  criteria_id?: any | string;
  student_id: any | string;
  semester_id: any | string;
  record_title: string;
  points_effect: number;
  status: 'active' | 'inactive';
  daily_report_id?: any | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAcademicRecordDto {
  evaluation_detail_id?: string;
  criteria_id?: string;
  student_id: string;
  semester_id: string;
  record_title: string;
  points_effect: number;
  status?: 'active' | 'inactive';
  daily_report_id?: string;
}

export interface UpdateAcademicRecordDto {
  evaluation_detail_id?: string;
  criteria_id?: string;
  student_id?: string;
  semester_id?: string;
  record_title?: string;
  points_effect?: number;
  status?: 'active' | 'inactive';
  daily_report_id?: string;
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
    const res = await fetch(`${API_BASE}/academic-records`);
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

  async updateAcademicRecord(id: string, dto: UpdateAcademicRecordDto): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<AcademicRecord>(res);
  },

  async deleteAcademicRecord(id: string): Promise<AcademicRecord> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/academic-records/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<AcademicRecord>(res);
  }
};
