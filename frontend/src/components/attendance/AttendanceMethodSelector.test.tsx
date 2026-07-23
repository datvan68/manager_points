import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttendanceMethodSelector from './AttendanceMethodSelector';

// Mock useGeolocation
vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    latitude: 10.762622,
    longitude: 106.660172,
    getCurrentPosition: vi.fn(),
    error: null,
  }),
}));

describe('AttendanceMethodSelector', () => {
  it('renders all 3 attendance method cards when allowedMethods includes qr, proximity, and manual_class', () => {
    render(
      <AttendanceMethodSelector
        onSelect={vi.fn()}
        allowedMethods={['qr', 'proximity', 'manual_class']}
      />,
    );

    expect(screen.getByText('Chọn hình thức điểm danh')).toBeInTheDocument();
    expect(screen.getByText('QR Code')).toBeInTheDocument();
    expect(screen.getByText('Phạm vi GPS')).toBeInTheDocument();
    expect(screen.getByText('Theo lớp')).toBeInTheDocument();
  });

  it('renders only 2 method cards when manual_class is not included in allowedMethods', () => {
    render(
      <AttendanceMethodSelector
        onSelect={vi.fn()}
        allowedMethods={['qr', 'proximity']}
      />,
    );

    expect(screen.getByText('QR Code')).toBeInTheDocument();
    expect(screen.getByText('Phạm vi GPS')).toBeInTheDocument();
    expect(screen.queryByText('Theo lớp')).toBeNull();
  });

  it('calls onSelect with method manual_class when clicking Theo lớp card', async () => {
    const onSelectMock = vi.fn().mockResolvedValue(undefined);
    render(
      <AttendanceMethodSelector
        onSelect={onSelectMock}
        allowedMethods={['qr', 'proximity', 'manual_class']}
      />,
    );

    const classCard = screen.getByText('Theo lớp').closest('[role="button"]');
    expect(classCard).not.toBeNull();
    fireEvent.click(classCard!);

    expect(onSelectMock).toHaveBeenCalledWith({
      method: 'manual_class',
    });
  });

  it('calls onSelect with method qr when clicking QR Code card', async () => {
    const onSelectMock = vi.fn().mockResolvedValue(undefined);
    render(
      <AttendanceMethodSelector
        onSelect={onSelectMock}
        allowedMethods={['qr', 'proximity', 'manual_class']}
      />,
    );

    const qrCard = screen.getByText('QR Code').closest('[role="button"]');
    expect(qrCard).not.toBeNull();
    fireEvent.click(qrCard!);

    expect(onSelectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'qr',
      }),
    );
  });
});
