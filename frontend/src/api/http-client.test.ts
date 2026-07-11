import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from './http-client';

describe('fetchWithRetry', () => {
  let mockFetch: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return response immediately on a successful request', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const promise = fetchWithRetry('/api/test');
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry up to 4 times on network failure and rethrow final error', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockFetch.mockRejectedValue(networkError);

    const promise = fetchWithRetry('/api/test');
    promise.catch(() => {});

    // Run attempt 1, fails. Delays 500ms.
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance 500ms -> Attempt 2, fails. Delays 1000ms.
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance 1000ms -> Attempt 3, fails. Delays 2000ms.
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Advance 2000ms -> Attempt 4, fails. Max attempts reached.
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    await expect(promise).rejects.toThrow('Failed to fetch');
  });

  it('should recover after transient network failures', async () => {
    const networkError = new TypeError('Failed to fetch');
    const successResponse = new Response('success', { status: 200 });

    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(successResponse);

    const promise = fetchWithRetry('/api/test');

    // Attempt 1 fails.
    await vi.advanceTimersByTimeAsync(0);
    // Attempt 2 fails.
    await vi.advanceTimersByTimeAsync(500);
    // Attempt 3 succeeds.
    await vi.advanceTimersByTimeAsync(1000);

    const res = await promise;
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on returned HTTP responses (including non-2xx)', async () => {
    const errorResponse = new Response('Not Found', { status: 404 });
    mockFetch.mockResolvedValueOnce(errorResponse);

    const res = await fetchWithRetry('/api/test');
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not retry for non-idempotent methods', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockFetch.mockRejectedValue(networkError);

    const promise = fetchWithRetry('/api/test', { method: 'POST' });
    await expect(promise).rejects.toThrow('Failed to fetch');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should immediately rethrow AbortError and stop delays', async () => {
    const controller = new AbortController();
    const networkError = new TypeError('Failed to fetch');
    mockFetch.mockRejectedValue(networkError);

    const promise = fetchWithRetry('/api/test', { signal: controller.signal });
    promise.catch(() => {});

    // Attempt 1 fails. Starts 500ms delay.
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Abort during the delay
    controller.abort();

    await expect(promise).rejects.toThrow();
    // Verify it didn't retry anymore
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
