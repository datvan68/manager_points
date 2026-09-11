import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TimetableGrid from './TimetableGrid';
describe('TimetableGrid', () => { it('keeps merged multi-period lesson and all week columns', () => { render(<TimetableGrid result={{ filters: { year: 'y', semester: 's', week: 'w' }, periods: ['13', '14'], lessons: [{ day: 1, startPeriod: 13, endPeriod: 14, subject: 'Toán', teacher: 'Cô A' }], isEmpty: false }} />); expect(screen.getByText('Toán')).toBeInTheDocument(); expect(screen.getByText('Chủ nhật')).toBeInTheDocument(); }); });
