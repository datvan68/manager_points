import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import RosterStudentLinkModal from './RosterStudentLinkModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('lucide-react', () => ({ Check: () => <span />, ChevronLeft: () => <span />, ChevronRight: () => <span />, Loader2: () => <span />, Search: () => <span />, X: () => <span /> }));

describe('RosterStudentLinkModal', () => {
  it('renders complete identity details and radio selection semantics', async () => {
    const getCandidates = vi.spyOn(dormitoryApi.roster, 'getLinkCandidates').mockResolvedValue({ data: [{ _id: 'student-1', student_code: 'SV-0001', full_name: 'Nguyễn Thị Minh Anh', date_bir: '2004-01-02', match_score: 96, recommended: true, match_reasons: ['NAME_SIMILAR', 'DOB_NEAR'], class_id: { _id: 'class-1', class_name: 'KTPM-K65-Lớp có tên rất dài' } }], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } } as any);
    render(<RosterStudentLinkModal open registration={{ _id: 'entry-1', roster_entry_code: 'DK-1', full_name: 'Hồ sơ KTX', date_of_birth: '2004-01-01' } as any} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(getCandidates).toHaveBeenCalledWith(expect.objectContaining({ roster_entry_id: 'entry-1' })));
    const candidate = await screen.findByRole('radio', { name: /SV-0001/ });
    expect(screen.getByText('Nguyễn Thị Minh Anh')).toBeInTheDocument();
    expect(screen.getByText(/Gợi ý 96\/100/)).toBeInTheDocument();
    expect(screen.getAllByText(/KTPM-K65-Lớp có tên rất dài/)).toHaveLength(2);
    expect(candidate).toHaveAttribute('aria-checked', 'false');
    candidate.click();
    await waitFor(() => expect(candidate).toHaveAttribute('aria-checked', 'true'));
  });
});
