import { httpClient, handleResponse } from './http-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Category {
  _id: string;
  category_code: string;
  category_name: string;
  max_score: number;
  sort_order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryDto {
  category_code: string;
  category_name: string;
  max_score: number;
  sort_order: number;
}

export interface UpdateCategoryDto {
  category_code?: string;
  category_name?: string;
  max_score?: number;
  sort_order?: number;
}

export const categoryApi = {
  async getCategories(): Promise<Category[]> {
    const res = await httpClient(`${API_BASE}/categories`);
    return handleResponse<Category[]>(res);
  },

  async getCategory(id: string): Promise<Category> {
    const res = await httpClient(`${API_BASE}/categories/${id}`);
    return handleResponse<Category>(res);
  },

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const res = await httpClient(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Category>(res);
  },

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const res = await httpClient(`${API_BASE}/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Category>(res);
  },

  async deleteCategory(id: string): Promise<Category> {
    const res = await httpClient(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Category>(res);
  }
};
