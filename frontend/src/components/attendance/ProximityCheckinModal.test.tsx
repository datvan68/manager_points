import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProximityCheckinModal from './ProximityCheckinModal';

describe('ProximityCheckinModal', () => {
  const getCurrentPosition = vi.fn();
  const onCheckin = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
  });

  it('requests location once and submits automatically', async () => {
    getCurrentPosition.mockImplementation((success: PositionCallback) => success({ coords: { latitude: 10, longitude: 20 } } as GeolocationPosition));
    render(<ProximityCheckinModal open onClose={onClose} onCheckin={onCheckin} />);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onCheckin).toHaveBeenCalledWith(10, 20));
    expect(await screen.findByText('Điểm danh thành công!')).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('shows a recoverable location error and retries once', async () => {
    getCurrentPosition.mockImplementationOnce((_success: PositionCallback, error: PositionErrorCallback) => error({ message: 'GPS denied' } as GeolocationPositionError));
    render(<ProximityCheckinModal open onClose={onClose} onCheckin={onCheckin} />);

    expect(await screen.findByText('GPS denied')).toBeInTheDocument();
    getCurrentPosition.mockImplementationOnce((success: PositionCallback) => success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(onCheckin).toHaveBeenCalledWith(1, 2));
  });

  it('localizes a denied geolocation error', async () => {
    getCurrentPosition.mockImplementationOnce((_success: PositionCallback, error: PositionErrorCallback) => error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError));
    render(<ProximityCheckinModal open onClose={onClose} onCheckin={onCheckin} />);

    expect(await screen.findByText('Quyền truy cập vị trí bị từ chối. Vui lòng bật GPS trong cài đặt.')).toBeInTheDocument();
    expect(screen.queryByText('User denied Geolocation')).not.toBeInTheDocument();
  });

  it('does not submit again for an existing check-in', () => {
    render(<ProximityCheckinModal open onClose={onClose} onCheckin={onCheckin} alreadyCheckedIn />);
    expect(screen.getByText('Điểm danh thành công!')).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(onCheckin).not.toHaveBeenCalled();
  });
});
