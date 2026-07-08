'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

// ── QR Display Panel (Standard QR Code) ──

interface QrDisplayPanelProps {
  token: string;
  expiresAt: string;
  refreshInterval: number;
  checkinCount: number;
  onClose?: () => void;
  sessionTitle?: string;
}

export default function QrDisplayPanel({
  token,
  expiresAt,
  refreshInterval,
  checkinCount,
  onClose,
  sessionTitle,
}: QrDisplayPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState(0);

  // Draw QR code using standard library
  useEffect(() => {
    if (!canvasRef.current || !token) return;
    const qrData = `attendance:${token}`;
    QRCode.toCanvas(canvasRef.current, qrData, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    }).catch((err) => {
      console.error('QR render error:', err);
    });
  }, [token]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setCountdown(remaining);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const progressPercent = refreshInterval > 0
    ? Math.max(0, (countdown / refreshInterval) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-emerald-600">
            Phiên điểm danh đang mở
          </span>
        </div>
        {sessionTitle && (
          <h3 className="text-lg font-semibold text-gray-800">{sessionTitle}</h3>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Yêu cầu sinh viên quét mã QR bên dưới để điểm danh
        </p>
      </div>

      {/* QR Code */}
      <div className="relative">
        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
          <canvas ref={canvasRef} className="w-64 h-64" />
        </div>

        {/* Countdown ring */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          <div className="bg-white rounded-full px-4 py-1.5 shadow-md border border-gray-100 flex items-center gap-2">
            {/* Mini progress bar */}
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: countdown > 5 ? '#10b981' : '#ef4444',
                }}
              />
            </div>
            <span className={`text-xs font-mono font-bold ${countdown <= 5 ? 'text-red-500' : 'text-gray-600'}`}>
              {countdown}s
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{checkinCount}</div>
          <div className="text-xs text-gray-500">Đã điểm danh</div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-400">{refreshInterval}s</div>
          <div className="text-xs text-gray-500">Làm mới</div>
        </div>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="mt-2 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium
                     hover:bg-red-100 transition-colors border border-red-100"
        >
          Đóng phiên điểm danh
        </button>
      )}
    </div>
  );
}
