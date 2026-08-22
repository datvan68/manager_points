import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseInvoiceProofPreviewOptions {
  invoiceId?: string;
  hasProof?: boolean;
  isOpen: boolean;
  fetchProofBlob: (invoiceId: string) => Promise<Blob>;
}

export interface UseInvoiceProofPreviewResult {
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function safeRevokeObjectURL(url: string | null | undefined) {
  if (!url) return;
  try {
    if (typeof window !== 'undefined' && window.URL && typeof window.URL.revokeObjectURL === 'function') {
      window.URL.revokeObjectURL(url);
    } else if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    // Ignore in non-standard test / SSR environments
  }
}

function safeCreateObjectURL(blob: Blob): string {
  if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
    return window.URL.createObjectURL(blob);
  }
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return '';
}

export function useInvoiceProofPreview({
  invoiceId,
  hasProof = false,
  isOpen,
  fetchProofBlob,
}: UseInvoiceProofPreviewOptions): UseInvoiceProofPreviewResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const activeBlobUrlRef = useRef<string | null>(null);
  const fetchProofBlobRef = useRef(fetchProofBlob);
  fetchProofBlobRef.current = fetchProofBlob;

  const retry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isOpen || !invoiceId || !hasProof) {
      if (activeBlobUrlRef.current) {
        safeRevokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isCurrent = true;
    setLoading(true);
    setError(null);

    if (activeBlobUrlRef.current) {
      safeRevokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
      setBlobUrl(null);
    }

    fetchProofBlobRef.current(invoiceId)
      .then((blob) => {
        if (!isCurrent) return;
        const newUrl = safeCreateObjectURL(blob);
        activeBlobUrlRef.current = newUrl;
        setBlobUrl(newUrl);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (!isCurrent) return;
        if (activeBlobUrlRef.current) {
          safeRevokeObjectURL(activeBlobUrlRef.current);
          activeBlobUrlRef.current = null;
        }
        setBlobUrl(null);
        setLoading(false);
        const rawMessage = String(err?.message || '');
        const errMsg =
          rawMessage.includes('404') || rawMessage.toLowerCase().includes('not found')
            ? 'Không tìm thấy ảnh chứng từ thanh toán.'
            : rawMessage.includes('401') || rawMessage.includes('403') || rawMessage.toLowerCase().includes('permission')
            ? 'Bạn không có quyền xem ảnh chứng từ này.'
            : 'Không thể tải ảnh chứng từ thanh toán. Vui lòng thử lại.';
        setError(errMsg);
      });

    return () => {
      isCurrent = false;
      if (activeBlobUrlRef.current) {
        safeRevokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, [invoiceId, hasProof, isOpen, retryTrigger]);

  return {
    blobUrl,
    loading,
    error,
    retry,
  };
}
