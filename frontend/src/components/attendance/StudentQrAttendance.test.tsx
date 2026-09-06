import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentQrAttendance from './StudentQrAttendance';
import { attendanceSessionApi } from '@/api/activity-api';

vi.mock('@/api/activity-api', () => ({
  attendanceSessionApi: { checkinQr: vi.fn() },
}));

vi.mock('./QrScannerModal', () => ({
  default: ({ open, onClose, onScanned, checkinStatus, checkinError }: any) => open ? (
    <div role="dialog">
      <span>{checkinStatus}</span>
      {checkinError && <span>{checkinError}</span>}
      <button onClick={() => onScanned(' attendance: token-1 ')}>scan</button>
      <button onClick={onClose}>close</button>
    </div>
  ) : null,
}));

describe('StudentQrAttendance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits a normalized token once and reports success only after the API resolves', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(attendanceSessionApi.checkinQr).mockReturnValue(new Promise((r) => { resolve = r; }) as any);
    render(<StudentQrAttendance />);
    fireEvent.click(screen.getByRole('button', { name: 'Quét QR điểm danh' }));
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));
    expect(attendanceSessionApi.checkinQr).toHaveBeenCalledTimes(1);
    expect(attendanceSessionApi.checkinQr).toHaveBeenCalledWith({ token: 'attendance: token-1' });
    expect(screen.getByText('checking')).toBeInTheDocument();
    resolve({ _id: 'checkin-1' });
    await waitFor(() => expect(screen.getByText('success')).toBeInTheDocument());
  });

  it('does not surface a late rejection after closing', async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(attendanceSessionApi.checkinQr).mockReturnValue(new Promise((_, r) => { reject = r; }) as any);
    render(<StudentQrAttendance />);
    fireEvent.click(screen.getByRole('button', { name: 'Quét QR điểm danh' }));
    fireEvent.click(screen.getByRole('button', { name: 'scan' }));
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    reject(new Error('expired'));
    await Promise.resolve();
    expect(screen.queryByText('expired')).not.toBeInTheDocument();
  });
});
