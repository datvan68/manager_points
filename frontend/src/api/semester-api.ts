const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Semester {
  _id: string;
  semester_name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive' | 'upcoming';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSemesterDto {
  semester_name: string;
  start_date: string;
  end_date: string;
  status?: 'active' | 'inactive' | 'upcoming';
}

export interface UpdateSemesterDto {
  semester_name?: string;
  start_date?: string;
  end_date?: string;
  status?: 'active' | 'inactive' | 'upcoming';
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const semesterApi = {
  async getSemesters(): Promise<Semester[]> {
    const res = await fetch(`${API_BASE}/semesters`);
    return handleResponse<Semester[]>(res);
  },

  async getSemester(id: string): Promise<Semester> {
    const res = await fetch(`${API_BASE}/semesters/${id}`);
    return handleResponse<Semester>(res);
  },

  async createSemester(dto: CreateSemesterDto): Promise<Semester> {
    const res = await fetch(`${API_BASE}/semesters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Semester>(res);
  },

  async updateSemester(id: string, dto: UpdateSemesterDto): Promise<Semester> {
    const res = await fetch(`${API_BASE}/semesters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Semester>(res);
  },

  async deleteSemester(id: string): Promise<Semester> {
    const res = await fetch(`${API_BASE}/semesters/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Semester>(res);
  }
};
