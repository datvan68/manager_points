import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activityAttendanceGrantApi } from '@/api/activity-api';
import AttendanceGrantManager from './AttendanceGrantManager';

vi.mock('@/api/activity-api', () => ({
  activityAttendanceGrantApi: {
    getCandidates: vi.fn(),
    getGrants: vi.fn(),
    upsertGrant: vi.fn(),
  },
}));

const teacher = {
  _id: 'teacher-1',
  user_name: 'Cô An',
  email: 'an@example.test',
  classes: [],
  grant_status: 'default' as const,
  effective_methods: ['manual_class'] as const,
};
const teacherTwo = {
  ...teacher,
  _id: 'teacher-2',
  user_name: 'Thầy Bình',
  email: 'binh@example.test',
};

async function selectTeacher(name = 'Cô An') {
  const input = screen.getByPlaceholderText('Chọn giáo viên');
  fireEvent.click(input);
  const option = await screen.findByText((content) => content.includes(name));
  fireEvent.click(option);
}

describe('AttendanceGrantManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityAttendanceGrantApi.getCandidates).mockResolvedValue([teacher as any]);
    vi.mocked(activityAttendanceGrantApi.getGrants).mockResolvedValue([]);
  });

  it('shows one teacher selector and exactly three accessible method buttons using effective state', async () => {
    render(<AttendanceGrantManager activityId="activity-1" />);

    await screen.findByPlaceholderText('Chọn giáo viên');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    await selectTeacher();

    const buttons = screen.getByRole('group', { name: 'Phương thức điểm danh' })
      .querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'QR' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'GPS' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lớp thủ công' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('persists a complete method set immediately and reconciles the response', async () => {
    vi.mocked(activityAttendanceGrantApi.upsertGrant).mockResolvedValue({
      _id: 'grant-1',
      teacher_id: 'teacher-1',
      allowed_methods: ['qr', 'manual_class'],
      status: 'active',
    });
    render(<AttendanceGrantManager activityId="activity-1" />);
    await selectTeacher();
    fireEvent.click(screen.getByRole('button', { name: 'QR' }));

    await waitFor(() => expect(activityAttendanceGrantApi.upsertGrant).toHaveBeenCalledWith(
      'activity-1',
      'teacher-1',
      ['qr', 'manual_class'],
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'QR' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('serializes rapid toggles without losing the adjacent update', async () => {
    let resolveFirst!: (value: any) => void;
    vi.mocked(activityAttendanceGrantApi.upsertGrant)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({
        _id: 'grant-1',
        teacher_id: 'teacher-1',
        allowed_methods: ['qr', 'proximity', 'manual_class'],
        status: 'active',
    });
    render(<AttendanceGrantManager activityId="activity-1" />);
    await selectTeacher();
    fireEvent.click(screen.getByRole('button', { name: 'QR' }));
    fireEvent.click(screen.getByRole('button', { name: 'GPS' }));

    expect(activityAttendanceGrantApi.upsertGrant).toHaveBeenCalledTimes(1);
    resolveFirst({
      _id: 'grant-1',
      teacher_id: 'teacher-1',
      allowed_methods: ['qr', 'manual_class'],
      status: 'active',
    });
    await waitFor(() => expect(activityAttendanceGrantApi.upsertGrant).toHaveBeenCalledTimes(2));
    expect(activityAttendanceGrantApi.upsertGrant).toHaveBeenLastCalledWith(
      'activity-1',
      'teacher-1',
      ['qr', 'proximity', 'manual_class'],
    );
  });

  it('restores confirmed state and keeps selection when persistence fails', async () => {
    vi.mocked(activityAttendanceGrantApi.upsertGrant).mockRejectedValue(new Error('Mất kết nối'));
    render(<AttendanceGrantManager activityId="activity-1" />);
    const select = await screen.findByPlaceholderText('Chọn giáo viên');
    await selectTeacher();
    expect(screen.getByRole('button', { name: 'Lớp thủ công' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Lớp thủ công' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
    expect(select).toHaveValue('Cô An');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lớp thủ công' })).toHaveAttribute('aria-pressed', 'true'));
    expect(activityAttendanceGrantApi.upsertGrant).toHaveBeenCalledWith('activity-1', 'teacher-1', []);
  });

  it('filters the scrollable teacher list by name', async () => {
    vi.mocked(activityAttendanceGrantApi.getCandidates).mockResolvedValue([teacher as any, teacherTwo as any]);
    render(<AttendanceGrantManager activityId="activity-1" />);

    const input = await screen.findByPlaceholderText('Chọn giáo viên');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'Bình' } });

    expect(screen.getByText((c) => c.includes('Thầy Bình'))).toBeInTheDocument();
    expect(screen.queryByText((c) => c.includes('Cô An'))).not.toBeInTheDocument();
  });

  it('keeps pending and errors scoped to their teacher during concurrent saves', async () => {
    vi.mocked(activityAttendanceGrantApi.getCandidates).mockResolvedValue([teacher as any, teacherTwo as any]);
    let rejectFirst!: (reason: Error) => void;
    let resolveSecond!: (value: any) => void;
    vi.mocked(activityAttendanceGrantApi.upsertGrant)
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<AttendanceGrantManager activityId="activity-1" />);

    await selectTeacher();
    fireEvent.click(screen.getByRole('button', { name: 'QR' }));
    expect(screen.getByRole('status')).toHaveTextContent('Đang lưu');

    await selectTeacher('Thầy Bình');
    fireEvent.click(screen.getByRole('button', { name: 'GPS' }));
    expect(screen.getByRole('status')).toHaveTextContent('Đang lưu');
    rejectFirst(new Error('Lỗi của cô An'));
    await waitFor(() => expect(activityAttendanceGrantApi.upsertGrant).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang lưu');

    resolveSecond({
      _id: 'grant-2',
      teacher_id: 'teacher-2',
      allowed_methods: ['proximity', 'manual_class'],
      status: 'active',
    });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());

    await selectTeacher();
    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi của cô An');
  });
});
