import { httpClient, handleResponse } from './http-client';
import { Category } from './category-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Criterion {
  _id: string;
  category_id: string | Category;
  criterion_name: string;
  score_per_unit: number;
  max_score: number;
  min_score: number;
  criterion_type: 'khen_thuong' | 'cong_diem' | 'ky_luat';
  is_locked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCriterionDto {
  category_id: string;
  criterion_name: string;
  score_per_unit?: number;
  max_score?: number;
  min_score?: number;
  criterion_type: 'khen_thuong' | 'cong_diem' | 'ky_luat';
  is_locked?: boolean;
}

export interface UpdateCriterionDto {
  category_id?: string;
  criterion_name?: string;
  score_per_unit?: number;
  max_score?: number;
  min_score?: number;
  criterion_type?: 'khen_thuong' | 'cong_diem' | 'ky_luat';
  is_locked?: boolean;
}

export const criteriaApi = {
  async getCriteria(categoryId?: string): Promise<Criterion[]> {
    const url = categoryId 
      ? `${API_BASE}/criteria?category_id=${categoryId}` 
      : `${API_BASE}/criteria`;
    const res = await httpClient(url);
    return handleResponse<Criterion[]>(res);
  },

  async getCriterion(id: string): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria/${id}`);
    return handleResponse<Criterion>(res);
  },

  async createCriterion(dto: CreateCriterionDto): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Criterion>(res);
  },

  async updateCriterion(id: string, dto: UpdateCriterionDto): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Criterion>(res);
  },

  async deleteCriterion(id: string): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Criterion>(res);
  },

  async deleteCriteria(ids: string[]): Promise<{ deletedCount: number }> {
    const res = await httpClient(`${API_BASE}/criteria/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return handleResponse<{ deletedCount: number }>(res);
  }
};

