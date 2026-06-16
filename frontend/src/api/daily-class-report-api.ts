import { httpClient, handleResponse } from './http-client';
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
  recordedStudentsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDailyClassReportDto {
  class_id: string;
  reported_by: string;
  report_date: string;
  total_present: number;
  total_absent: number;
  teacher_name: string;
  class_notes?: string;
}

export interface UpdateDailyClassReportDto {
  class_id?: string;
  reported_by?: string;
  report_date?: string;
  total_present?: number;
  total_absent?: number;
  teacher_name?: string;
  class_notes?: string;
}

export const dailyClassReportApi = {
  async getDailyClassReports(params?: {
    page?: number;
    limit?: number;
    classId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<DailyClassReport[] | { data: DailyClassReport[]; meta: any }> {
    const queryParts: string[] = [];
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParts.push(`${key}=${encodeURIComponent(val)}`);
        }
      });
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const res = await httpClient(`${API_BASE}/daily-class-reports${queryString}`);
    return handleResponse<any>(res);
  },

  async getDailyClassReport(id: string): Promise<DailyClassReport> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/${id}`);
    return handleResponse<DailyClassReport>(res);
  },

  async getDailyClassReportsByClass(classId: string): Promise<DailyClassReport[]> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/class/${classId}`);
    return handleResponse<DailyClassReport[]>(res);
  },

  async createDailyClassReport(dto: CreateDailyClassReportDto): Promise<DailyClassReport> {
    const res = await httpClient(`${API_BASE}/daily-class-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<DailyClassReport>(res);
  },

  async updateDailyClassReport(id: string, dto: UpdateDailyClassReportDto): Promise<DailyClassReport> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    return handleResponse<DailyClassReport>(res);
  },

  async deleteDailyClassReport(id: string): Promise<DailyClassReport> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<DailyClassReport>(res);
  },

  async deleteDailyClassReportsBulk(ids: string[]): Promise<{
    deletedCount: number;
    failed: Array<{ id: string; message: string }>;
  }> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
    return handleResponse<{
      deletedCount: number;
      failed: Array<{ id: string; message: string }>;
    }>(res);
  },

  async getDeletedDailyClassReports(): Promise<DailyClassReport[]> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/deleted/all`);
    return handleResponse<DailyClassReport[]>(res);
  },

  async restoreDailyClassReport(id: string): Promise<DailyClassReport> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/${id}/restore`, {
      method: 'PATCH',
    });
    return handleResponse<DailyClassReport>(res);
  },

  async forceDeleteDailyClassReport(id: string): Promise<DailyClassReport> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/${id}/force`, {
      method: 'DELETE',
    });
    return handleResponse<DailyClassReport>(res);
  },

  async importClassRecords(rows: any[], commit?: boolean): Promise<{ success: boolean; errors: any[]; reportsCreated?: number; recordsCreated?: number; count: number }> {
    const res = await httpClient(`${API_BASE}/daily-class-reports/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows, commit }),
    });
    return handleResponse<{ success: boolean; errors: any[]; reportsCreated?: number; recordsCreated?: number; count: number }>(res);
  }
};
