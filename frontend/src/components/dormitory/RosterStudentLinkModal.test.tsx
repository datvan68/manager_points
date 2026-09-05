import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import RosterStudentLinkModal from './RosterStudentLinkModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('lucide-react', () => ({ Check: () => <span />, ChevronLeft: () => <span />, ChevronRight: () => <span />, Loader2: () => <span />, Search: () => <span />, X: () => <span /> }));

describe('RosterStudentLinkModal', () => {
  it('renders complete identity details and radio selection semantics', async () => {
    vi.spyOn(dormitoryApi.roster, 'getLinkCandidates').mockResolvedValue({ data: [{ _id: 'student-1', student_code: 'SV-0001', full_name: 'Nguyễn Thị Minh Anh', class_id: { _id: 'class-1', class_name: 'KTPM-K65-Lớp có tên rất dài' } }], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } as any);
    render(<RosterStudentLinkModal open registration={{ _id: 'entry-1', roster_entry_code: 'DK-1', full_name: 'Hồ sơ KTX' } as any} onOpenChange={vi.fn()} />);
    const candidate = await screen.findByRole('radio', { name: /SV-0001/ });
    expect(screen.getByText('Nguyễn Thị Minh Anh')).toBeInTheDocument();
    expect(screen.getAllByText(/KTPM-K65-Lớp có tên rất dài/)).toHaveLength(2);
    expect(candidate).toHaveAttribute('aria-checked', 'false');
    candidate.click();
    await waitFor(() => expect(candidate).toHaveAttribute('aria-checked', 'true'));
  });
});
