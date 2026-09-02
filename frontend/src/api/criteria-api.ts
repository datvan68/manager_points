import { httpClient, handleResponse } from "./http-client";
import { Category } from "./category-api";
import { apiCache } from "./api-cache";

import { API_BASE } from "./config";

export interface OptionItem {
  id: string;
  label: string;
  score: number;
}

export interface Criterion {
  _id: string;
  category_id: string | Category;
  criterion_code?: string;
  criterion_name: string;
  description?: string;
  score_per_unit: number;
  max_score: number;
  min_score: number;
  criterion_type: "khen_thuong" | "cong_diem" | "ky_luat";
  is_locked?: boolean;
  is_score_counted?: boolean;
  scoring_mode?: "count" | "single_option";
  options?: OptionItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCriterionDto {
  category_id: string;
  criterion_code: string;
  criterion_name: string;
  description?: string;
  score_per_unit?: number;
  max_score?: number;
  min_score?: number;
  criterion_type: "khen_thuong" | "cong_diem" | "ky_luat";
  is_locked?: boolean;
  is_score_counted?: boolean;
  scoring_mode?: "count" | "single_option";
  options?: OptionItem[];
}

export interface UpdateCriterionDto {
  category_id?: string;
  criterion_code?: string;
  criterion_name?: string;
  description?: string;
  score_per_unit?: number;
  max_score?: number;
  min_score?: number;
  criterion_type?: "khen_thuong" | "cong_diem" | "ky_luat";
  is_locked?: boolean;
  is_score_counted?: boolean;
  scoring_mode?: "count" | "single_option";
  options?: OptionItem[];
}

export const criteriaApi = {
  async getCriteria(categoryId?: string): Promise<Criterion[]> {
    const cacheKey = `criteria_${categoryId || "all"}`;
    return apiCache.get(cacheKey, async () => {
      const url = categoryId
        ? `${API_BASE}/criteria?category_id=${categoryId}`
        : `${API_BASE}/criteria`;
      const res = await httpClient(url);
      return handleResponse<Criterion[]>(res);
    });
  },

  async suggestCriterionCode(
    categoryId: string,
  ): Promise<{ suggestedCode: string }> {
    const res = await httpClient(
      `${API_BASE}/criteria/suggest-code?category_id=${encodeURIComponent(categoryId)}`,
    );
    return handleResponse<{ suggestedCode: string }>(res);
  },

  async getCriterion(id: string): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria/${id}`);
    return handleResponse<Criterion>(res);
  },

  async createCriterion(dto: CreateCriterionDto): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      const errorBody = await res.clone().text();
      console.error("[criteriaApi.createCriterion] request failed", {
        dto,
        status: res.status,
        body: errorBody,
      });
    }
    const data = await handleResponse<Criterion>(res);
    apiCache.invalidate(/^criteria/);
    return data;
  },

  async updateCriterion(
    id: string,
    dto: UpdateCriterionDto,
  ): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      const errorBody = await res.clone().text();
      console.error("[criteriaApi.updateCriterion] request failed", {
        id,
        dto,
        status: res.status,
        body: errorBody,
      });
    }
    const data = await handleResponse<Criterion>(res);
    apiCache.invalidate(/^criteria/);
    return data;
  },

  async deleteCriterion(id: string): Promise<Criterion> {
    const res = await httpClient(`${API_BASE}/criteria/${id}`, {
      method: "DELETE",
    });
    const data = await handleResponse<Criterion>(res);
    apiCache.invalidate(/^criteria/);
    return data;
  },

  async deleteCriteria(ids: string[]): Promise<{ deletedCount: number }> {
    const res = await httpClient(`${API_BASE}/criteria/bulk-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await handleResponse<{ deletedCount: number }>(res);
    apiCache.invalidate(/^criteria/);
    return data;
  },
};
