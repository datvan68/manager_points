'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanned: (token: string) => Promise<void>;
  checkinStatus: 'idle' | 'checking' | 'success' | 'error';
  checkinError?: string | null;
  onReset?: () => void;
}

export default function QrScannerModal({
  open,
  onClose,
  onScanned,
  checkinStatus,
  checkinError,
  onReset,
}: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        scanningRef.current = true;
        scanFrame();
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Quyền truy cập camera bị từ chối. Vui lòng bật trong cài đặt trình duyệt.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('Không tìm thấy camera. Vui lòng kiểm tra thiết bị.');
      } else {
        setCameraError('Không thể mở camera. Vui lòng thử lại.');
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Scan frame for QR code
  const scanFrame = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Try BarcodeDetector API (Chrome/Edge)
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({
        formats: ['qr_code'],
      });
      detector
        .detect(canvas)
        .then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            handleQrDetected(rawValue);
            return;
          }
          if (scanningRef.current) {
            requestAnimationFrame(scanFrame);
          }
        })
        .catch(() => {
          if (scanningRef.current) {
            requestAnimationFrame(scanFrame);
          }
        });
    } else {
      // Fallback: manual token input for browsers without BarcodeDetector
      if (scanningRef.current) {
        requestAnimationFrame(scanFrame);
      }
    }
  }, []);

  // Handle detected QR
  const handleQrDetected = useCallback(
    (rawValue: string) => {
      scanningRef.current = false;
      setScanning(false);

      // Extract token from QR data (format: "attendance:{token}")
      let token = rawValue;
      if (rawValue.startsWith('attendance:')) {
        token = rawValue.substring('attendance:'.length);
      }

      onScanned(token);
    },
    [onScanned],
  );

  // Manual token input (fallback)
  const [manualToken, setManualToken] = useState('');
  const handleManualSubmit = () => {
    if (manualToken.trim()) {
      onScanned(manualToken.trim());
    }
  };

  // Lifecycle
  useEffect(() => {
    if (open && checkinStatus === 'idle') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  // Auto-close on success after delay
  useEffect(() => {
    if (checkinStatus === 'success') {
      stopCamera();
      const timer = setTimeout(() => {
        onClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [checkinStatus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">Quét mã QR điểm danh</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Success State */}
          {checkinStatus === 'success' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-bold text-emerald-700">Điểm danh thành công!</h4>
                <p className="text-sm text-gray-500 mt-1">Bạn đã được ghi nhận điểm danh.</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {checkinStatus === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-bold text-red-600">Điểm danh thất bại</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {checkinError || 'Đã xảy ra lỗi. Vui lòng thử lại.'}
                </p>
              </div>
              <button
                onClick={() => {
                  onReset?.();
                  startCamera();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl
                           text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Thử lại
              </button>
            </div>
          )}

          {/* Checking State */}
          {checkinStatus === 'checking' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Đang xử lý điểm danh...</p>
            </div>
          )}

          {/* Scanning State */}
          {checkinStatus === 'idle' && (
            <>
              {cameraError ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-amber-600" />
                  </div>
                  <p className="text-sm text-center text-gray-600">{cameraError}</p>

                  {/* Manual input fallback */}
                  <div className="w-full mt-4">
                    <p className="text-xs text-gray-400 mb-2 text-center">Hoặc nhập mã thủ công:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="Nhập mã điểm danh..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <button
                        onClick={handleManualSubmit}
                        disabled={!manualToken.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Camera viewport */}
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {/* Corner markers */}
                      <div className="relative w-48 h-48">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" />

                        {/* Scanning line animation */}
                        {scanning && (
                          <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce" />
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-center text-gray-400 mt-3">
                    Hướng camera vào mã QR để quét tự động
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
