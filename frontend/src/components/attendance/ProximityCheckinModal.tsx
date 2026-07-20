'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, X, XCircle } from 'lucide-react';

interface ProximityCheckinModalProps {
  open: boolean;
  onClose: () => void;
  onCheckin: (latitude: number, longitude: number) => Promise<void>;
  alreadyCheckedIn?: boolean;
}

type ModalState = 'locating' | 'submitting' | 'success' | 'error' | 'completed';

export default function ProximityCheckinModal({
  open,
  onClose,
  onCheckin,
  alreadyCheckedIn = false,
}: ProximityCheckinModalProps) {
  const [state, setState] = useState<ModalState>('locating');
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const onCheckinRef = useRef(onCheckin);
  onCheckinRef.current = onCheckin;

  const requestLocation = useCallback(() => {
    const attempt = ++attemptRef.current;
    setError(null);
    if (alreadyCheckedIn) {
      setState('completed');
      return;
    }
    if (!navigator.geolocation) {
      setState('error');
      setError('Trình duyệt không hỗ trợ định vị.');
      return;
    }

    setState('locating');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (attempt !== attemptRef.current) return;
        setState('submitting');
        try {
          await onCheckinRef.current(position.coords.latitude, position.coords.longitude);
          if (attempt === attemptRef.current) setState('success');
        } catch (checkinError: any) {
          if (attempt !== attemptRef.current) return;
          setState('error');
          setError(checkinError?.message || 'Điểm danh thất bại.');
        }
      },
      (locationError) => {
        if (attempt !== attemptRef.current) return;
        setState('error');
        const message = locationError.code === 1
          ? 'Quyền truy cập vị trí bị từ chối. Vui lòng bật GPS trong cài đặt.'
          : locationError.code === 2
            ? 'Không thể xác định vị trí. Vui lòng kiểm tra GPS.'
            : locationError.code === 3
              ? 'Yêu cầu vị trí hết thời gian. Vui lòng thử lại.'
              : locationError.message || 'Không thể xác định vị trí.';
        setError(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [alreadyCheckedIn]);

  useEffect(() => {
    if (!open) return;
    requestLocation();
    return () => { attemptRef.current += 1; };
  }, [open, requestLocation]);

  if (!open) return null;

  const close = () => {
    attemptRef.current += 1;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Điểm danh định vị">
      <div className="w-full max-w-md mx-4 overflow-hidden bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">Điểm danh định vị</h3>
          </div>
          <button type="button" aria-label="Đóng" onClick={close} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          {state === 'locating' && <><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /><p className="text-sm text-gray-600">Đang xác định vị trí...</p></>}
          {state === 'submitting' && <><Loader2 className="w-12 h-12 text-blue-500 animate-spin" /><p className="text-sm text-gray-600">Đang xác thực điểm danh...</p></>}
          {(state === 'success' || state === 'completed') && <><CheckCircle2 className="w-16 h-16 text-emerald-600" /><p className="font-semibold text-emerald-700">Điểm danh thành công!</p><p className="text-sm text-gray-500">Bạn đã được ghi nhận điểm danh.</p></>}
          {state === 'error' && <><XCircle className="w-16 h-16 text-red-500" /><p className="font-semibold text-red-600">Điểm danh thất bại</p><p className="text-sm text-gray-500">{error}</p><button type="button" onClick={requestLocation} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Thử lại</button></>}
          {(state === 'success' || state === 'completed') && <button type="button" onClick={close} className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">Đã điểm danh</button>}
        </div>
      </div>
    </div>
  );
}
