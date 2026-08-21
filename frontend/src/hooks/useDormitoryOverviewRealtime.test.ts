import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDormitoryOverviewRealtime } from './useDormitoryOverviewRealtime';
import { tokenStorage } from '../api/auth-api';

vi.mock('../api/auth-api', () => ({
  tokenStorage: {
    getAccessToken: vi.fn(),
  },
}));

describe('useDormitoryOverviewRealtime', () => {
  let mockFetch: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('mock-auth-token');

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
      useDormitoryOverviewRealtime({
        enabled: false,
        onInvalidate,
      }),
    );

    expect(result.current.status).toBe('disconnected');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it('connects to realtime endpoint and streams events with burst debounce coalescing', async () => {
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
      useDormitoryOverviewRealtime({
        enabled: true,
        onInvalidate,
        debounceMs: 200,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('connected');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/reports/realtime'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mock-auth-token',
          Accept: 'text/event-stream',
        },
      }),
    );

    // Push connected and ping events -> should not trigger invalidation
    act(() => {
      streamController.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
      streamController.enqueue(encoder.encode('data: {"type":"ping"}\n\n'));
    });

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(300);
    });

    expect(onInvalidate).not.toHaveBeenCalled();

    // Push multiple burst events over time
    act(() => {
      streamController.enqueue(
        encoder.encode('data: {"type":"dormitory_overview.invalidated","domain":"rooms","event_id":"e1"}\n\n'),
      );
    });
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(50);
    });

    act(() => {
      streamController.enqueue(
        encoder.encode('data: {"type":"dormitory_overview.invalidated","domain":"beds","event_id":"e2"}\n\n'),
      );
    });
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(50);
    });

    act(() => {
      streamController.enqueue(
        encoder.encode('data: {"type":"dormitory_overview.invalidated","domain":"contracts","event_id":"e3"}\n\n'),
      );
    });
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(250);
    });

    // Should be coalesced to 1 call
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    expect(onInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dormitory_overview.invalidated',
        domain: 'contracts',
      }),
    );
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
      useDormitoryOverviewRealtime({
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
