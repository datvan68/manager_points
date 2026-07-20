import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NotificationDestination from './NotificationDestination';
import NotificationDetailModal from '../modals/NotificationDetailModal';

describe('notification interaction primitives', () => {
  it('identifies linked and unlinked destinations', () => {
    const { rerender } = render(<NotificationDestination routeUrl="/activities/123?tab=schedule" />);
    expect(screen.getByText('Mở ngay')).toBeInTheDocument();
    rerender(<NotificationDestination />);
    expect(screen.queryByText('Mở ngay')).not.toBeInTheDocument();
  });

  it('shows details and only offers navigation for linked notifications', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <NotificationDetailModal
        isOpen
        notification={{ title: 'T', description: 'D', routeUrl: '/target' }}
        onClose={onClose}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /đi tới trang liên kết/i }));
    expect(onNavigate).toHaveBeenCalledWith('/target');

    rerender(
      <NotificationDetailModal
        isOpen
        notification={{ title: 'T', description: 'D' }}
        onClose={onClose}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.queryByRole('button', { name: /đi tới trang liên kết/i })).not.toBeInTheDocument();
  });
});
