import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useParams: () => ({ qrId: 'qr-1' }) }));
vi.mock('@/components/dormitory/PublicDormitoryRegistrationModal', () => ({
  PublicDormitoryRegistrationModal: ({ qrRoomId, open, onOpenChange }: any) => <div data-testid="public-form" data-qr-room-id={qrRoomId} data-open={String(open)}><button onClick={() => onOpenChange(false)}>Close registration</button></div>,
}));

import PublicRoomPage from './page';

describe('public room registration flow', () => {
  it('opens the canonical public form with the room QR id and closes back to the room', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ room: { room_code: 'A101', room_type: 'Thường', max_students: 2, available_bed_count: 1, room_price: 0, amenities: [], status: 'Trống' }, beds: [{ bed_code: 'A101-1', status: 'Trống' }] }) }));
    render(<PublicRoomPage />);
    await waitFor(() => expect(screen.getByText('Đăng ký ở phòng này')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Đăng ký ở phòng này'));
    expect(screen.getByTestId('public-form')).toHaveAttribute('data-qr-room-id', 'qr-1');
    expect(screen.getByTestId('public-form')).toHaveAttribute('data-open', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close registration' }));
    expect(screen.getByTestId('public-form')).toHaveAttribute('data-open', 'false');
  });
});
