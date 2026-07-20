import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    getCurrentPosition: vi.fn(),
  }),
}));

import ProximityCheckinButton from './ProximityCheckinButton';

describe('ProximityCheckinButton', () => {
  it('shows a disabled completed action after a successful check-in', () => {
    render(
      <ProximityCheckinButton
        sessionLatitude={10.762622}
        sessionLongitude={106.660172}
        sessionRadius={50}
        onCheckin={vi.fn().mockResolvedValue(undefined)}
        checkinStatus="success"
      />,
    );

    expect(screen.getByText('Điểm danh thành công!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đã điểm danh' })).toBeDisabled();
  });
});
