'use client';

import React, { useState } from 'react';
import { QrCode, MapPin, Users, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface AttendanceMethodSelectorProps {
  onSelect: (params: {
    method: 'qr' | 'proximity' | 'manual_class';
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    qr_refresh_interval?: number;
  }) => Promise<void>;
  loading?: boolean;
  allowedMethods?: Array<'qr' | 'proximity' | 'manual_class'>;
}

const RADIUS_OPTIONS = [
  { value: 50, label: '50m' },
  { value: 100, label: '100m' },
  { value: 200, label: '200m' },
  { value: 500, label: '500m' },
];

const QR_INTERVAL_OPTIONS = [
  { value: 15, label: '15 giây' },
  { value: 30, label: '30 giây' },
  { value: 60, label: '1 phút' },
];

export default function AttendanceMethodSelector({
  onSelect,
  loading = false,
  allowedMethods = ['qr', 'proximity', 'manual_class'],
}: AttendanceMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<'qr' | 'proximity' | 'manual_class' | null>(null);
  const [radius, setRadius] = useState(100);
  const [qrInterval, setQrInterval] = useState(30);
  const [gettingLocation, setGettingLocation] = useState(false);
  const geo = useGeolocation();

  const handleQrSelect = async () => {
    setSelectedMethod('qr');
    await onSelect({
      method: 'qr',
      qr_refresh_interval: qrInterval,
    });
  };

  const handleProximitySelect = async () => {
    setSelectedMethod('proximity');
    setGettingLocation(true);

    // Get current position
    if (!geo.latitude || !geo.longitude) {
      geo.getCurrentPosition();
      // Wait for position
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (geo.latitude && geo.longitude) {
            clearInterval(check);
            resolve();
          }
        }, 500);
        // Timeout after 15s
        setTimeout(() => {
          clearInterval(check);
          resolve();
        }, 15000);
      });
    }

    setGettingLocation(false);

    if (geo.latitude && geo.longitude) {
      await onSelect({
        method: 'proximity',
        latitude: geo.latitude,
        longitude: geo.longitude,
        radius_meters: radius,
      });
    }
  };

  const handleManualClassSelect = async () => {
    setSelectedMethod('manual_class');
    await onSelect({
      method: 'manual_class',
    });
  };

  const visibleMethodsCount = allowedMethods.length;
  const gridLayoutClass =
    visibleMethodsCount >= 3
      ? 'grid-cols-1 md:grid-cols-3'
      : visibleMethodsCount === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1';

  return (
    <div className="flex flex-col gap-5 p-1">
      <div className="text-center mb-2">
        <h3 className="text-lg font-bold text-slate-800">
          Chọn hình thức điểm danh
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Chọn phương thức điểm danh phù hợp cho buổi sinh hoạt
        </p>
      </div>

      {/* Method cards */}
      <div className={`grid ${gridLayoutClass} gap-4`}>
        {/* QR Code */}
        {allowedMethods.includes('qr') && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleQrSelect}
            className={`
              group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
              ${loading && selectedMethod === 'qr'
                ? 'border-blue-500 bg-blue-50/80 shadow-md shadow-blue-100'
                : 'border-slate-200/80 bg-white/70 hover:border-blue-500 hover:bg-blue-50/40 active:scale-[0.98]'
              }
              ${loading ? 'pointer-events-none opacity-70' : ''}
            `}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              {loading && selectedMethod === 'qr' ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : (
                <QrCode className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="text-center">
              <h4 className="font-bold text-slate-800 text-sm">QR Code</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Tạo mã QR tự động — sinh viên quét mã bằng thiết bị
              </p>
            </div>
            {/* QR interval selector */}
            <div className="flex gap-1.5 mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
              {QR_INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setQrInterval(opt.value);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    qrInterval === opt.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Proximity */}
        {allowedMethods.includes('proximity') && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleProximitySelect}
            className={`
              group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
              ${loading && selectedMethod === 'proximity'
                ? 'border-emerald-500 bg-emerald-50/80 shadow-md shadow-emerald-100'
                : 'border-slate-200/80 bg-white/70 hover:border-emerald-500 hover:bg-emerald-50/40 active:scale-[0.98]'
              }
              ${loading ? 'pointer-events-none opacity-70' : ''}
            `}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              {(loading && selectedMethod === 'proximity') || gettingLocation ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : (
                <MapPin className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="text-center">
              <h4 className="font-bold text-slate-800 text-sm">Phạm vi GPS</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Xác thực vị trí — SV ở trong bán kính tự xác nhận
              </p>
            </div>
            {/* Radius selector */}
            <div className="flex gap-1.5 mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRadius(opt.value);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    radius === opt.value
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Class / Theo lớp */}
        {allowedMethods.includes('manual_class') && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleManualClassSelect}
            className={`
              group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
              ${loading && selectedMethod === 'manual_class'
                ? 'border-purple-500 bg-purple-50/80 shadow-md shadow-purple-100'
                : 'border-slate-200/80 bg-white/70 hover:border-purple-500 hover:bg-purple-50/40 active:scale-[0.98]'
              }
              ${loading ? 'pointer-events-none opacity-70' : ''}
            `}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform">
              {loading && selectedMethod === 'manual_class' ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : (
                <Users className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="text-center">
              <h4 className="font-bold text-slate-800 text-sm">Theo lớp</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Điểm danh danh sách — Thực hiện theo từng lớp được phân công
              </p>
            </div>
            <div className="mt-auto pt-2">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-700">
                Thủ công / Lớp phụ trách
              </span>
            </div>
          </div>
        )}
      </div>

      {/* GPS notice */}
      {geo.error && (
        <div className="text-xs text-amber-600 text-center bg-amber-50 rounded-lg px-3 py-2">
          {geo.error}
        </div>
      )}
    </div>
  );
}
