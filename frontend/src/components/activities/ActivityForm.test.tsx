import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/auth-api', () => ({
  authApi: { getUsers: vi.fn().mockResolvedValue([{ _id: 'teacher-1', full_name: 'Advisor', role_code: 'TEACHER' }]) },
  tokenStorage: { getAccessToken: vi.fn(() => 'token') },
}));

vi.mock('@/api/student-api', () => ({
  studentApi: { getStudents: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/api/semester-api', () => ({
  semesterApi: { getSemesters: vi.fn().mockResolvedValue([{ _id: 'semester-1', semester_name: 'Semester', status: 'active' }]) },
}));

vi.mock('@/api/criteria-api', () => ({
  criteriaApi: { getCriteria: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/api/activity-api', () => ({
  activityApi: { uploadMedia: vi.fn() },
}));

vi.mock('@/components/calendar/CustomCalendar', () => ({
  CustomCalendar: () => null,
}));

import ActivityForm from './ActivityForm';
import { authApi } from '@/api/auth-api';
import { studentApi } from '@/api/student-api';
import { semesterApi } from '@/api/semester-api';
import { criteriaApi } from '@/api/criteria-api';

Object.defineProperty(URL, 'createObjectURL', { value: vi.fn((file: File) => `blob:${file.name}`), writable: true });
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });

const initialData = {
  name: 'Activity name',
  code: 'ACT-1',
  classroom: 'A.101',
  advisor_id: 'teacher-1',
  president_id: 'student-1',
  semester_id: 'semester-1',
  activity_type: 'club' as const,
  category: 'sports' as const,
  settings: { require_registration_for_attendance: true },
};

describe('ActivityForm create mode', () => {
  beforeEach(() => {
    vi.mocked(authApi.getUsers).mockResolvedValue([{ _id: 'teacher-1', full_name: 'Advisor', role_code: 'TEACHER' }] as any);
    vi.mocked(studentApi.getStudents).mockResolvedValue([] as any);
    vi.mocked(semesterApi.getSemesters).mockResolvedValue([{ _id: 'semester-1', semester_name: 'Semester', status: 'active' }] as any);
    vi.mocked(criteriaApi.getCriteria).mockResolvedValue([] as any);
  });

  it('keeps club-only fields contextual, hides registration settings, and previews selected media', async () => {
    const { container, getByAltText, getByLabelText } = render(
      <ActivityForm initialData={initialData as any} onSubmit={vi.fn()} onCancel={vi.fn()} mode="create" />
    );

    await waitFor(() => expect(container.querySelectorAll('input[class~="bg-transparent"]')).toHaveLength(3));
    expect(container.textContent).not.toContain('Chủ nhiệm sinh viên');

    const advisorTrigger = container.querySelectorAll<HTMLInputElement>('input[class~="bg-transparent"]')[2];
    fireEvent.click(advisorTrigger);
    const advisorViewport = document.querySelectorAll<HTMLElement>('[data-select-content]')[2].firstElementChild as HTMLElement;
    expect(advisorViewport).toHaveClass('overflow-y-auto', 'overscroll-contain', 'touch-pan-y');
    fireEvent.wheel(advisorViewport, { deltaY: 100 });

    const typeTrigger = container.querySelectorAll<HTMLInputElement>('input[class~="bg-transparent"]')[0];
    fireEvent.click(typeTrigger);
    const eventOption = Array.from(document.querySelectorAll<HTMLElement>('[data-select-content] .cursor-pointer'))
      .find((item) => item.textContent?.includes('(Event)'));
    expect(eventOption).toBeTruthy();
    fireEvent.click(eventOption!);

    await waitFor(() => expect(container.querySelectorAll('input[class~="bg-transparent"]')).toHaveLength(2));

    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(container.querySelector('[name="settings.allow_self_registration"]')).not.toBeInTheDocument();

    const [logoInput, coverInput] = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    fireEvent.change(logoInput, { target: { files: [new File(['logo'], 'logo.png', { type: 'image/png' })] } });
    fireEvent.change(coverInput, { target: { files: [new File(['cover'], 'cover.webp', { type: 'image/webp' })] } });

    expect(await getByAltText('Logo preview')).toBeInTheDocument();
    expect(await getByAltText('Cover image preview')).toBeInTheDocument();

    fireEvent.click(getByLabelText('Remove selected logo'));
    fireEvent.click(getByLabelText('Remove selected cover image'));

    await waitFor(() => {
      expect(container.querySelector('[alt="Logo preview"]')).not.toBeInTheDocument();
      expect(container.querySelector('[alt="Cover image preview"]')).not.toBeInTheDocument();
    });
  });

  it('omits President from the create payload and normalizes non-club categories', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <ActivityForm initialData={{ ...initialData, activity_type: 'event' } as any} onSubmit={onSubmit} onCancel={vi.fn()} mode="create" />
    );

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).not.toHaveProperty('president_id');
    expect(payload.category).toBe('other');
  });
});
