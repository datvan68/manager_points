'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, X, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanned: (token: string) => Promise<void>;
  checkinStatus: 'idle' | 'checking' | 'success' | 'error';
  checkinError?: string | null;
  onReset?: () => void;
}

function normalizeAttendanceToken(value: string) {
  const token = value.trim();
  return token.startsWith('attendance:') ? token.slice('attendance:'.length).trim() : token;
}

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'unsupported';

const cameraMessages: Record<Exclude<CameraState, 'idle' | 'requesting' | 'active'>, string> = {
  denied: 'Quyền truy cập camera bị từ chối. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.',
  unavailable: 'Không thể sử dụng camera trên thiết bị này. Hãy kiểm tra camera hoặc nhập mã thủ công.',
  unsupported: 'Trình duyệt chưa hỗ trợ quét QR tự động. Bạn có thể nhập mã điểm danh thủ công.',
};

export default function QrScannerModal({ open, onClose, onScanned, checkinStatus, checkinError, onReset }: QrScannerModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const onCloseRef = useRef(onClose);
  const onScannedRef = useRef(onScanned);
  onCloseRef.current = onClose;
  onScannedRef.current = onScanned;
  const canSubmitRef = useRef(false);
  canSubmitRef.current = open && isMobile && checkinStatus === 'idle';
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const cameraRequestRef = useRef(0);
  const detectorRef = useRef<any>(null);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    scanningRef.current = false;
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) { setIsMobile(false); return; }
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) { canSubmitRef.current = false; stopCamera(); onCloseRef.current(); }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [open, stopCamera]);

  const handleQrDetected = useCallback((rawValue: string) => {
    if (!canSubmitRef.current) return;
    canSubmitRef.current = false;
    stopCamera();
    void onScannedRef.current(normalizeAttendanceToken(rawValue)).catch(() => {});
  }, [stopCamera]);

  const scanFrame = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) { requestAnimationFrame(scanFrame); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const detector = detectorRef.current || new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    detectorRef.current = detector;
    const requestId = cameraRequestRef.current;
    detector.detect(canvas).then((barcodes: any[]) => {
      if (!scanningRef.current || requestId !== cameraRequestRef.current) return;
      if (barcodes.length > 0) handleQrDetected(barcodes[0].rawValue);
      else requestAnimationFrame(scanFrame);
    }).catch(() => { if (scanningRef.current) requestAnimationFrame(scanFrame); });
  }, [handleQrDetected]);

  const requestCamera = useCallback(async () => {
    if (cameraState === 'requesting' || cameraState === 'active') return;
    stopCamera();
    const requestId = ++cameraRequestRef.current;
    setCameraState('requesting');
    if (!('BarcodeDetector' in window)) { setCameraState('unsupported'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState('unavailable'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } });
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; return; }
      setCameraState('active');
      setScanning(true);
      scanningRef.current = true;
      scanFrame();
    } catch (err: any) {
      if (requestId !== cameraRequestRef.current) return;
      stopCamera();
      setCameraState(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }, [cameraState, scanFrame, stopCamera]);

  const close = useCallback(() => {
    stopCamera();
    setCameraState('idle');
    setManualToken('');
    onCloseRef.current();
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (cameraState !== 'active' || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().then(() => {
      if (scanningRef.current) scanFrame();
    }).catch(() => {});
  }, [cameraState, scanFrame]);
  useEffect(() => {
    if (!open) { stopCamera(); setCameraState('idle'); setManualToken(''); }
  }, [open, stopCamera]);
  useEffect(() => {
    if (checkinStatus === 'success') {
      stopCamera();
      const timer = setTimeout(close, 2500);
      return () => clearTimeout(timer);
    }
  }, [checkinStatus, close, stopCamera]);

  const handleManualSubmit = () => {
    if (normalizeAttendanceToken(manualToken) && canSubmitRef.current) handleQrDetected(manualToken);
  };
  if (!open || !isMobile) return null;
  const showFallback = cameraState === 'denied' || cameraState === 'unavailable' || cameraState === 'unsupported';

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}>
      <DialogContent showCloseButton={false} className="w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom)-2rem)] overflow-y-auto gap-0 rounded-2xl border border-white/75 bg-white/45 p-0 text-[#1E293B] shadow-sm shadow-slate-300/40 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/75 px-5 py-4">
          <div className="flex items-center gap-2"><Camera className="h-5 w-5 text-[#1A73E8]" aria-hidden="true" /><DialogTitle className="text-base font-semibold text-[#1E293B]">Quét mã QR điểm danh</DialogTitle></div>
          <button type="button" onClick={close} aria-label="Đóng quét QR" className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/40 text-[#64748B] transition-colors hover:bg-white/70 hover:text-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8]/30"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 p-5">
          <DialogDescription className="text-sm leading-relaxed text-[#64748B]">Camera chỉ được dùng để quét mã QR điểm danh trên màn hình này.</DialogDescription>
          {checkinStatus === 'success' && <div className="flex flex-col items-center gap-4 rounded-xl border border-purple-500/20 bg-purple-500/10 py-10 text-center"><CheckCircle2 className="h-12 w-12 text-purple-700" aria-hidden="true" /><div><h4 className="text-lg font-bold text-purple-700">Điểm danh thành công!</h4><p className="mt-1 text-sm text-[#64748B]">Bạn đã được ghi nhận điểm danh.</p></div></div>}
          {checkinStatus === 'checking' && <div className="flex flex-col items-center gap-4 rounded-xl border border-blue-500/20 bg-blue-500/10 py-10"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-[#1A73E8]" /><p className="text-sm text-[#64748B]">Đang xử lý điểm danh...</p></div>}
          {checkinStatus === 'error' && <div className="flex flex-col items-center gap-4 rounded-xl border border-rose-500/20 bg-rose-500/10 py-8 text-center"><XCircle className="h-12 w-12 text-rose-700" aria-hidden="true" /><div><h4 className="text-lg font-bold text-rose-700">Điểm danh thất bại</h4><p className="mt-1 text-sm text-[#64748B]">{checkinError || 'Đã xảy ra lỗi. Vui lòng thử lại.'}</p></div><button type="button" onClick={onReset} className="flex items-center gap-2 rounded-xl border border-white/70 bg-[#1A73E8] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8]/30"><RefreshCw className="h-4 w-4" aria-hidden="true" />Thử lại</button></div>}
          {checkinStatus === 'idle' && <>
            <canvas ref={canvasRef} className="hidden" />
            {cameraState === 'idle' && <button type="button" onClick={requestCamera} className="w-full rounded-xl border border-white/70 bg-[#1A73E8] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8]/30">Cho phép camera</button>}
            {cameraState === 'requesting' && <div role="status" className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-center text-sm text-[#1A73E8]">Đang yêu cầu quyền camera...</div>}
            {cameraState === 'active' && <><div className="relative aspect-square overflow-hidden rounded-xl border border-white/75 bg-slate-900"><video ref={videoRef} className="h-full w-full object-cover" playsInline muted /><div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="relative h-48 w-48"><div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-white" /><div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-white" /><div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-white" /><div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-white" />{scanning && <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-[#1A73E8]" />}</div></div></div><p className="text-center text-xs text-[#64748B]">Hướng camera vào mã QR để quét tự động</p></>}
            {showFallback && <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4"><div className="flex items-start gap-3"><Camera className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" /><p className="text-sm leading-relaxed text-amber-700">{cameraMessages[cameraState as Exclude<CameraState, 'idle' | 'requesting' | 'active'>]}</p></div>{cameraState !== 'unsupported' && <button type="button" onClick={requestCamera} className="w-full rounded-xl border border-white/70 bg-white/50 px-4 py-2 text-sm font-medium text-[#1A73E8] hover:bg-white/70">Thử lại camera</button>}</div>}
            {showFallback && <div className="space-y-2"><label htmlFor="manual-qr-token" className="block text-center text-xs text-[#64748B]">Hoặc nhập mã thủ công</label><div className="flex gap-2"><input id="manual-qr-token" type="text" value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="Nhập mã điểm danh..." className="min-w-0 flex-1 rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-sm text-[#1E293B] backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30" /><button type="button" onClick={handleManualSubmit} disabled={!manualToken.trim()} className="rounded-xl border border-white/70 bg-[#1A73E8] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Gửi</button></div></div>}
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
