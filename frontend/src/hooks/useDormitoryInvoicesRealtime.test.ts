import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDormitoryInvoicesRealtime } from './useDormitoryInvoicesRealtime';
import { tokenStorage } from '../api/auth-api';

vi.mock('../api/auth-api', () => ({
  tokenStorage: {
    getAccessToken: vi.fn(),
  },
}));

describe('useDormitoryInvoicesRealtime', () => {
  let mockFetch: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('mock-token');

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not connect when enabled is false', () => {
    const onInvalidate = vi.fn();
    const { result } = renderHook(() =>
      useDormitoryInvoicesRealtime({
        kind: 'utility',
        enabled: false,
        onInvalidate,
      }),
    );

    expect(result.current.status).toBe('disconnected');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it('connects and receives streamed events, debounce coalescing bursts', async () => {
    const onInvalidate = vi.fn();
    const encoder = new TextEncoder();

    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() =>
      useDormitoryInvoicesRealtime({
        kind: 'utility',
        enabled: true,
        onInvalidate,
        debounceMs: 200,
      }),
    );

    await act(async () => {
      // Allow connect promise to run
      await Promise.resolve();
    });

    expect(result.current.status).toBe('connected');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/invoices/realtime?kind=utility'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-token',
          Accept: 'text/event-stream',
        },
      }),
    );

    // Push events into stream
    act(() => {
      streamController.enqueue(
        encoder.encode('data: {"type":"connected"}\n\n'),
      );
      streamController.enqueue(
        encoder.encode('data: {"type":"ping"}\n\n'),
      );
    });

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });

    expect(onInvalidate).not.toHaveBeenCalled();

    // Push 3 mutation events in rapid succession (burst)
    act(() => {
      streamController.enqueue(
        encoder.encode('data: {"kind":"utility","action":"created","id":"1"}\n\n'),
      );
      streamController.enqueue(
        encoder.encode('data: {"kind":"utility","action":"updated","id":"2"}\n\n'),
      );
      streamController.enqueue(
        encoder.encode('data: {"kind":"utility","action":"deleted","ids":["3"]}\n\n'),
      );
    });

    // Flush stream reading microtasks and advance timer
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(250);
    });

    // Should only be called once due to burst coalescing
    expect(onInvalidate).toHaveBeenCalledTimes(1);
  });

  it('aborts fetch on unmount', async () => {
    const onInvalidate = vi.fn();

    let aborted = false;
    mockFetch.mockImplementation((_url: any, opts: any) => {
      opts.signal?.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise(() => {}); // hang
    });

    const { unmount } = renderHook(() =>
      useDormitoryInvoicesRealtime({
        kind: 'room_fee',
        enabled: true,
        onInvalidate,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalled();
    unmount();
    expect(aborted).toBe(true);
  });
});
