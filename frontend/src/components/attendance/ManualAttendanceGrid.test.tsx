import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ManualAttendanceGrid from './ManualAttendanceGrid';

describe('ManualAttendanceGrid', () => {
  it('activates a student card by pointer and keyboard, including the second toggle', () => {
    const onCheckin = vi.fn().mockResolvedValue(undefined);
    const roster: any = {
      total: 1,
      students: [{ _id: 'student-1', full_name: 'Student One', student_code: 'S001', attendance: null }],
    };
    const { rerender } = render(<ManualAttendanceGrid roster={roster} pending={{}} errors={{}} onCheckin={onCheckin} />);

    fireEvent.click(screen.getByRole('button', { name: /Student One/ }));
    expect(onCheckin).toHaveBeenCalledWith('student-1');

    rerender(<ManualAttendanceGrid roster={{ ...roster, students: [{ ...roster.students[0], attendance: { approval_status: 'approved', status: 'present' } }] }} pending={{}} errors={{}} onCheckin={onCheckin} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Student One/ }), { key: 'Enter' });
    expect(onCheckin).toHaveBeenCalledTimes(2);
  });
});
