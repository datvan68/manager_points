'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { attendanceSessionApi } from '@/api/activity-api';
import QrScannerModal from './QrScannerModal';

type CheckinStatus = 'idle' | 'checking' | 'success' | 'error';

export default function StudentQrAttendance({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CheckinStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const pending = useRef(false);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    pending.current = false;
  }, []);

  const close = useCallback(() => {
    requestVersion.current += 1;
    pending.current = false;
    setOpen(false);
    reset();
  }, [reset]);

  useEffect(() => () => { requestVersion.current += 1; }, []);

  const submit = useCallback(async (token: string) => {
    const normalized = token.trim();
    if (!normalized || pending.current) return;
    pending.current = true;
    const version = requestVersion.current;
    setStatus('checking');
    setError(null);
    try {
      await attendanceSessionApi.checkinQr({ token: normalized });
      if (version !== requestVersion.current || !open) return;
      setStatus('success');
    } catch (cause: any) {
      if (version !== requestVersion.current || !open) return;
      setStatus('error');
      setError(cause?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      if (version === requestVersion.current) pending.current = false;
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Quét QR điểm danh"
        title="Quét QR điểm danh"
        onClick={() => { requestVersion.current += 1; reset(); setOpen(true); }}
        className={`${className || 'min-w-11 min-h-11 w-11 h-11 rounded-xl'} flex items-center justify-center text-[#64748B] border border-transparent hover:border-white/60 hover:bg-white/70 hover:text-[#1E293B] hover:scale-[1.01] transition-[border-color,background-color,color,transform] duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8]/40`}
      >
        <QrCode size={18} aria-hidden="true" />
      </button>
      <QrScannerModal
        open={open}
        onClose={close}
        onScanned={submit}
        checkinStatus={status}
        checkinError={error}
        onReset={reset}
      />
    </>
  );
}
