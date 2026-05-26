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

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Đã xảy ra lỗi');
  }
  return data as T;
}

export const categoryApi = {
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/categories`);
    return handleResponse<Category[]>(res);
  },

  async getCategory(id: string): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories/${id}`);
    return handleResponse<Category>(res);
  },

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Category>(res);
  },

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return handleResponse<Category>(res);
  },

  async deleteCategory(id: string): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<Category>(res);
  }
};
