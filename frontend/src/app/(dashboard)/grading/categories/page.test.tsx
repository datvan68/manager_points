import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesPage from './page';
import { categoryApi } from '@/api/category-api';
import { criteriaApi } from '@/api/criteria-api';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }));
vi.mock('@/components/guards/RouteGuard', () => ({ RouteGuard: ({ children }: any) => <>{children}</> }));
vi.mock('@/api/auth-api', () => ({ tokenStorage: { getUser: vi.fn(() => ({ role: 'admin' })) } }));
vi.mock('@/api/category-api', () => ({ categoryApi: { getCategories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() } }));
vi.mock('@/api/criteria-api', () => ({ criteriaApi: { getCriteria: vi.fn(), createCriterion: vi.fn(), updateCriterion: vi.fn(), deleteCriterion: vi.fn(), deleteCriteria: vi.fn() } }));
vi.mock('@/components/ui/TabNavigation', () => ({ default: ({ tabs, onTabChange }: any) => <nav>{tabs.map((tab: any) => <button key={tab.id} onClick={() => onTabChange(tab.id)}>{tab.label}</button>)}</nav> }));
vi.mock('@/components/grading/CategoryModal', () => ({ default: ({ isOpen, onSave, onClose }: any) => isOpen ? <div role="dialog" aria-label="category modal"><button onClick={onClose}>Hủy</button><button onClick={() => onSave({ id: 'new', name: 'Mới', maxPoints: 10 })}>save category</button></div> : null }));
vi.mock('@/components/grading/CriteriaModal', () => ({ default: ({ isOpen, onSave, onClose }: any) => isOpen ? <div role="dialog" aria-label="criterion modal"><button onClick={onClose}>Hủy</button><button onClick={() => onSave({ categoryId: 'CAT-1', criterion_code: 'C-2', name: 'Mới', description: '  Mô tả ngắn  ', type: 'cong_diem', points: 1, minPoints: 0, maxPoints: 5 })}>save criterion</button></div> : null }));
vi.mock('@/components/modals/ConfirmModal', () => ({ default: ({ isOpen, onConfirm, onClose }: any) => isOpen ? <div role="alertdialog"><button onClick={onClose}>Hủy</button><button onClick={onConfirm}>confirm delete</button></div> : null }));

const categories = [{ _id: 'cat-1', category_code: 'CAT-1', category_name: 'Rèn luyện', max_score: 20, sort_order: 1 }, { _id: 'cat-2', category_code: 'CAT-2', category_name: 'Học tập', max_score: 30, sort_order: 2 }];
const criteria = [{ _id: 'cri-1', category_id: 'cat-1', criterion_code: 'C-1', criterion_name: 'Tham gia hoạt động', description: 'Mô tả hoạt động', criterion_type: 'cong_diem', score_per_unit: 2, min_score: 0, max_score: 10, is_locked: false }, { _id: 'cri-2', category_id: 'cat-2', criterion_code: 'C-2', criterion_name: 'Điểm học tập', criterion_type: 'ky_luat', score_per_unit: 1, min_score: 0, max_score: 5, is_locked: true }];

describe('CategoriesPage master-detail workspace', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(categoryApi.getCategories).mockResolvedValue(categories as any); vi.mocked(criteriaApi.getCriteria).mockResolvedValue(criteria as any); });

  it('loads categories and criteria in one searchable master-detail flow', async () => {
    render(<CategoriesPage />);
    expect((await screen.findAllByText('Rèn luyện')).length).toBeGreaterThan(0);
    expect(screen.getByText('Tham gia hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Mô tả hoạt động')).toBeInTheDocument();
    expect(screen.queryByText('Kanban')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tìm danh mục'), { target: { value: 'học' } });
    expect(screen.getByText('Học tập')).toBeInTheDocument();
    expect(screen.getAllByText('Rèn luyện')).toHaveLength(1);
  });

  it('supports mobile drill-down and returns to the category list', async () => {
    render(<CategoriesPage />);
    await screen.findAllByText('Rèn luyện');
    fireEvent.click(screen.getAllByRole('button', { name: /Học tập/ })[0]);
    expect(await screen.findByText('Điểm học tập')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));
    expect(screen.getByLabelText('Tìm danh mục')).toBeInTheDocument();
  });

  it('keeps category and criterion CRUD entry points', async () => {
    render(<CategoriesPage />);
    await screen.findAllByText('Rèn luyện');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tiêu chí' }));
    expect(screen.getByRole('dialog', { name: 'criterion modal' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'save criterion' }));
    await waitFor(() => expect(criteriaApi.createCriterion).toHaveBeenCalledWith(expect.objectContaining({ description: 'Mô tả ngắn' })));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    expect(screen.getByRole('dialog', { name: 'category modal' })).toBeInTheDocument();
  });

  it('renders an empty state and preserves redirect for a non-admin', async () => {
    vi.mocked(categoryApi.getCategories).mockResolvedValue([]);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([]);
    render(<CategoriesPage />);
    expect(await screen.findByText('Chưa có danh mục phù hợp.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects users without administrator access', async () => {
    const auth = await import('@/api/auth-api');
    vi.mocked(auth.tokenStorage.getUser).mockReturnValue({ role: 'student' } as any);
    render(<CategoriesPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/grading/score'));
  });
});
