import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import RosterStudentLinkModal from './RosterStudentLinkModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('RosterStudentLinkModal', () => {
  const registration = { _id: 'entry-1', roster_entry_code: 'DK-1', full_name: 'Nguyễn A', semester: 'HK1', academic_year: '2026-2027', identity_state: 'CONFLICT' as const };
  const candidate = { _id: 'student-1', student_code: 'SV001', full_name: 'Nguyễn Văn A', status: 'Studying' as const, class_id: { _id: 'class-1', class_name: 'CNTT K20' } };

  it('searches current-class candidates, requires a selection and patches only after explicit confirmation', async () => {
    const candidates = vi.spyOn(dormitoryApi.roster, 'getLinkCandidates').mockResolvedValue({ data: [candidate], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } });
    const update = vi.spyOn(dormitoryApi.roster, 'update').mockResolvedValue({ ...registration, student_id: candidate._id, identity_state: 'LINKED' } as any);
    const onSuccess = vi.fn();
    render(<RosterStudentLinkModal open registration={registration} onOpenChange={vi.fn()} onSuccess={onSuccess} />);

    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(candidates).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, search: undefined, signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('button', { name: 'Xác nhận liên kết' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /SV001/ }));
    expect(screen.getByRole('button', { name: 'Xác nhận liên kết' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận liên kết' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('entry-1', { student_id: 'student-1' }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('keeps the selected candidate and dialog open after a sanitized link failure', async () => {
    vi.spyOn(dormitoryApi.roster, 'getLinkCandidates').mockResolvedValue({ data: [candidate], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } });
    vi.spyOn(dormitoryApi.roster, 'update').mockRejectedValue(new Error('Sinh viên đã có mục Danh sách KTX trong học kỳ này.'));
    render(<RosterStudentLinkModal open registration={registration} onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /SV001/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận liên kết' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sinh viên đã có mục Danh sách KTX trong học kỳ này.');
    expect(screen.getByText(/Đã chọn:/)).toBeInTheDocument();
  });
});
