import { tokenStorage } from './auth-api';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface DailyClassReport {
  _id: string;
  class_id: any | string;
  user_id: any | string;
  report_date: string;
  total_present: number;
  total_absent: number;
  teacher_name: string;
  class_note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDailyClassReportDto {
  class_id: string;
  user_id: string;
  report_date: string;
  total_present: number;
  total_absent: number;
  teacher_name: string;
  class_note?: string;
}

export interface UpdateDailyClassReportDto {
  class_id?: string;
  user_id?: string;
  report_date?: string;
  total_present?: number;
  total_absent?: number;
  teacher_name?: string;
  class_note?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const dailyClassReportApi = {
  async getDailyClassReports(): Promise<DailyClassReport[]> {
    const res = await fetch(`${API_BASE}/daily-class-reports`);
    return handleResponse<DailyClassReport[]>(res);
  },

  async getDailyClassReport(id: string): Promise<DailyClassReport> {
    const res = await fetch(`${API_BASE}/daily-class-reports/${id}`);
    return handleResponse<DailyClassReport>(res);
  },

  async getDailyClassReportsByClass(classId: string): Promise<DailyClassReport[]> {
    const res = await fetch(`${API_BASE}/daily-class-reports/class/${classId}`);
    return handleResponse<DailyClassReport[]>(res);
  },

  async createDailyClassReport(dto: CreateDailyClassReportDto): Promise<DailyClassReport> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/daily-class-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<DailyClassReport>(res);
  },

  async updateDailyClassReport(id: string, dto: UpdateDailyClassReportDto): Promise<DailyClassReport> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/daily-class-reports/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<DailyClassReport>(res);
  },

  async deleteDailyClassReport(id: string): Promise<DailyClassReport> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/daily-class-reports/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<DailyClassReport>(res);
  },

  async getDeletedDailyClassReports(): Promise<DailyClassReport[]> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/daily-class-reports/deleted/all`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<DailyClassReport[]>(res);
  },

  async restoreDailyClassReport(id: string): Promise<DailyClassReport> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/daily-class-reports/${id}/restore`, {
      method: 'PATCH',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<DailyClassReport>(res);
  },

  async forceDeleteDailyClassReport(id: string): Promise<DailyClassReport> {
    const token = tokenStorage.getAccessToken() || '';
    const res = await fetch(`${API_BASE}/daily-class-reports/${id}/force`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    return handleResponse<DailyClassReport>(res);
  }
};
