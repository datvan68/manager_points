import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimetableLookup from './TimetableLookup';
import { timetableApi } from '@/api/timetable-api';
vi.mock('@/api/timetable-api', async () => { const actual = await vi.importActual<typeof import('@/api/timetable-api')>('@/api/timetable-api'); return { ...actual, timetableApi: { getOptions: vi.fn(), getTimetable: vi.fn() } }; });
describe('TimetableLookup', () => { it('loads opaque options and renders filters', async () => { vi.mocked(timetableApi.getOptions).mockResolvedValue({ years: [{ label: '2025-2026', value: 'y|1' }], semesters: [{ label: 'Học kỳ 2', value: 's|2' }], weeks: [], faculties: [], courses: [], classes: [] }); render(<TimetableLookup />); await waitFor(() => expect(screen.getByRole('option', { name: '2025-2026' })).toBeInTheDocument()); expect(screen.getByLabelText('Niên học')).toHaveValue(''); }); });
