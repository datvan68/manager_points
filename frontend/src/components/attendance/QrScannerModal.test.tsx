import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import QrScannerModal from './QrScannerModal';

const scanners: Array<{ emit: (result: unknown) => void; stop: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }> = [];
vi.mock('qr-scanner', () => ({
  default: class MockQrScanner {
    private readonly onDecode: (result: unknown) => void;
    private readonly video: HTMLVideoElement;
    private readonly streamPromise: Promise<MediaStream>;
    stop = vi.fn();
    destroy = vi.fn();
    constructor(video: HTMLVideoElement, onDecode: (result: unknown) => void) {
      this.onDecode = onDecode;
      this.video = video;
      scanners.push({ emit: (result) => this.onDecode(result), stop: this.stop, destroy: this.destroy });
      this.streamPromise = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    }
    start = vi.fn(async () => { this.video.srcObject = await this.streamPromise; });
  },
}));

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
    scanners.length = 0;
    delete (window as any).BarcodeDetector;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  });

  it('starts scanning without BarcodeDetector and submits the first normalized QR once', async () => {
    const onScanned = vi.fn(() => Promise.resolve());
    render(<QrScannerModal open onClose={vi.fn()} onScanned={onScanned} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(screen.getByText(/Hướng camera/i)).toBeInTheDocument());
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    act(() => {
      scanners[0].emit({ data: ' attendance: abc ' });
      scanners[0].emit({ data: 'second' });
    });
    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith('abc');
    expect(scanners[0].stop).toHaveBeenCalled();
    expect(scanners[0].destroy).toHaveBeenCalled();
  });

  it('renders a compact camera preview that fills its QR frame', async () => {
    render(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));

    const frame = await screen.findByRole('region', { name: 'Khung quét mã QR' });
    const video = frame.querySelector('video');

    expect(frame).toHaveClass('max-w-72', 'aspect-square');
    expect(video).toHaveClass('absolute', 'inset-0', 'h-full', 'w-full', 'object-cover', 'object-center');
    expect(video).toHaveStyle({ objectFit: 'cover', objectPosition: 'center' });
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
    let resolve!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(r => { resolve = r; }));
    const stop = vi.fn();
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScanned={vi.fn()} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1));
    act(() => { mobile = false; change?.(); });
    await act(async () => { resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
    expect(scanners[0].destroy).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đóng quét QR' })).not.toBeInTheDocument();
  });

  it('releases active camera tracks when resizing to desktop', async () => {
    const stop = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    const { unmount } = render(<QrScannerModal open onClose={vi.fn()} onScanned={vi.fn()} checkinStatus="idle" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép camera' }));
    await waitFor(() => expect(screen.getByText(/Hướng camera/i)).toBeInTheDocument());
    act(() => { mobile = false; change?.(); });
    expect(stop).toHaveBeenCalled();
    unmount();
    vi.restoreAllMocks();
  });

  it('does not duplicate a pending camera request and resets on reopen', async () => {
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
