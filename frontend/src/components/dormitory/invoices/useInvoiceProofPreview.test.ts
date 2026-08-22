import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInvoiceProofPreview } from './useInvoiceProofPreview';

describe('useInvoiceProofPreview hook', () => {
  let mockCreateObjectURL: any;
  let mockRevokeObjectURL: any;

  beforeEach(() => {
    let objectUrlId = 0;
    mockCreateObjectURL = vi.fn((_blob: Blob) => `blob:http://localhost/mock-blob-${++objectUrlId}`);
    mockRevokeObjectURL = vi.fn();

    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when modal is closed or invoice has no proof', async () => {
    const fetchProofBlob = vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/png' }));

    const { result, rerender } = renderHook(
      (props) => useInvoiceProofPreview(props),
      {
        initialProps: {
          invoiceId: 'inv-1',
          hasProof: false,
          isOpen: true,
          fetchProofBlob,
        },
      },
    );

    expect(fetchProofBlob).not.toHaveBeenCalled();
    expect(result.current.blobUrl).toBeNull();
    expect(result.current.loading).toBe(false);

    // Closed modal
    rerender({
      invoiceId: 'inv-1',
      hasProof: true,
      isOpen: false,
      fetchProofBlob,
    });

    expect(fetchProofBlob).not.toHaveBeenCalled();
    expect(result.current.blobUrl).toBeNull();
  });

  it('fetches blob and creates blob URL when modal is open with existing proof', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const fetchProofBlob = vi.fn().mockResolvedValue(mockBlob);

    const { result } = renderHook(() =>
      useInvoiceProofPreview({
        invoiceId: 'inv-123',
        hasProof: true,
        isOpen: true,
        fetchProofBlob,
      }),
    );

    expect(fetchProofBlob).toHaveBeenCalledWith('inv-123');

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-1');
      expect(result.current.error).toBeNull();
    });

    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
  });

  it('revokes blob URL when modal closes or unmounts (AC-04)', async () => {
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const fetchProofBlob = vi.fn().mockResolvedValue(mockBlob);

    const { result, rerender, unmount } = renderHook(
      (props) => useInvoiceProofPreview(props),
      {
        initialProps: {
          invoiceId: 'inv-123',
          hasProof: true,
          isOpen: true,
          fetchProofBlob,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-1');
    });

    // Close modal
    rerender({
      invoiceId: 'inv-123',
      hasProof: true,
      isOpen: false,
      fetchProofBlob,
    });

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-blob-1');
    expect(result.current.blobUrl).toBeNull();

    // Reopen modal to get a new URL
    rerender({
      invoiceId: 'inv-123',
      hasProof: true,
      isOpen: true,
      fetchProofBlob,
    });

    await waitFor(() => {
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-2');
    });

    // Unmount
    unmount();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-blob-2');
  });

  it('revokes previous blob URL and loads new one when invoiceId changes', async () => {
    const blob1 = new Blob(['img1'], { type: 'image/png' });
    const blob2 = new Blob(['img2'], { type: 'image/png' });
    const fetchProofBlob = vi.fn().mockImplementation((id: string) => {
      if (id === 'inv-1') return Promise.resolve(blob1);
      if (id === 'inv-2') return Promise.resolve(blob2);
      return Promise.reject(new Error('not found'));
    });

    const { result, rerender } = renderHook(
      (props) => useInvoiceProofPreview(props),
      {
        initialProps: {
          invoiceId: 'inv-1',
          hasProof: true,
          isOpen: true,
          fetchProofBlob,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-1');
    });

    // Switch to inv-2
    rerender({
      invoiceId: 'inv-2',
      hasProof: true,
      isOpen: true,
      fetchProofBlob,
    });

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-blob-1');

    await waitFor(() => {
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-2');
    });
  });

  it('handles errors, sets Vietnamese error message, and supports retry (AC-03)', async () => {
    let callCount = 0;
    const fetchProofBlob = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('404 Not Found'));
      }
      return Promise.resolve(new Blob(['retried image'], { type: 'image/png' }));
    });

    const { result } = renderHook(() =>
      useInvoiceProofPreview({
        invoiceId: 'inv-err',
        hasProof: true,
        isOpen: true,
        fetchProofBlob,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Không tìm thấy ảnh chứng từ thanh toán.');
      expect(result.current.blobUrl).toBeNull();
    });

    // Call retry
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-1');
    });
  });

  it('prevents stale async completions from overwriting current invoice state (AC-04)', async () => {
    let resolveFirst: (b: Blob) => void;
    const firstPromise = new Promise<Blob>((resolve) => {
      resolveFirst = resolve;
    });

    const secondBlob = new Blob(['img2'], { type: 'image/png' });
    const fetchProofBlob = vi.fn().mockImplementation((id: string) => {
      if (id === 'inv-slow') return firstPromise;
      if (id === 'inv-fast') return Promise.resolve(secondBlob);
      return Promise.reject(new Error('unknown'));
    });

    const { result, rerender } = renderHook(
      (props) => useInvoiceProofPreview(props),
      {
        initialProps: {
          invoiceId: 'inv-slow',
          hasProof: true,
          isOpen: true,
          fetchProofBlob,
        },
      },
    );

    // Immediately switch to fast invoice before slow finishes
    rerender({
      invoiceId: 'inv-fast',
      hasProof: true,
      isOpen: true,
      fetchProofBlob,
    });

    await waitFor(() => {
      expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-1');
    });

    // Now slow promise resolves
    act(() => {
      resolveFirst!(new Blob(['img1-slow'], { type: 'image/png' }));
    });

    // It should remain the second blob URL, not overridden by slow request
    expect(result.current.blobUrl).toBe('blob:http://localhost/mock-blob-1');
  });
});
