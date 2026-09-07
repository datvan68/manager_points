import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import QrScannerModal from './QrScannerModal';

describe('QrScannerModal', () => {
  let mobile: boolean;
  let change: (() => void) | undefined;
  beforeEach(() => {
    mobile = true;
    change = undefined;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return mobile; },
      addEventListener: (_event: string, listener: () => void) => { change = listener; },
      removeEventListener: () => { change = undefined; },
    })));
    delete (window as any).BarcodeDetector;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  });

  it('offers normalized manual entry when decoding is unsupported', async () => {
    const onScanned = vi.fn(() => Promise.resolve());
    render(<QrScannerModal open onClose={vi.fn()} onScanned={onScanned} checkinStatus="idle" />);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(screen.getByText(/chưa hỗ trợ quét QR/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Nhập mã điểm danh...'), { target: { value: ' attendance: abc ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(onScanned).toHaveBeenCalledWith('abc');
  });

  it('exposes a labelled close control', () => {
    render(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    expect(screen.getByRole('button', { name: 'Đóng quét QR' })).toBeInTheDocument();
  });
  it('does not open camera or manual entry on desktop', () => {
    mobile = false;
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScanned={vi.fn()} checkinStatus="idle" />);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Nhập mã điểm danh...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đóng quét QR' })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('stops a camera that resolves after resizing to desktop', async () => {
    (window as any).BarcodeDetector = vi.fn();
    let resolve!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(r => { resolve = r; }));
    const stop = vi.fn();
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScanned={vi.fn()} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1));
    act(() => { mobile = false; change?.(); });
    await act(async () => { resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
    expect(stop).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đóng quét QR' })).not.toBeInTheDocument();
  });

  it('releases active camera tracks when resizing to desktop', async () => {
    (window as any).BarcodeDetector = vi.fn();
    const stop = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    const { unmount } = render(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    act(() => { mobile = false; change?.(); });
    expect(stop).toHaveBeenCalled();
    unmount();
    vi.restoreAllMocks();
  });

  it('does not duplicate a pending camera request and resets on reopen', async () => {
    (window as any).BarcodeDetector = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    fireEvent.click(screen.getByRole('status'));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    rerender(<QrScannerModal open={false} onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    rerender(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    expect(screen.getByRole('button', { name: 'Cho phép camera' })).toBeInTheDocument();
  });

  it('shows denial guidance and allows an explicit retry', async () => {
    (window as any).BarcodeDetector = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(screen.getByText(/bị từ chối/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại camera' }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2));
  });

});
