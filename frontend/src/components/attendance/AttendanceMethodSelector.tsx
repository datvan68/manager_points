'use client';

import React, { useState } from 'react';
import { QrCode, MapPin, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface AttendanceMethodSelectorProps {
  onSelect: (params: {
    method: 'qr' | 'proximity';
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    qr_refresh_interval?: number;
  }) => Promise<void>;
  loading?: boolean;
  allowedMethods?: Array<'qr' | 'proximity'>;
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
  allowedMethods = ['qr', 'proximity'],
}: AttendanceMethodSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<'qr' | 'proximity' | null>(null);
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

  return (
    <div className="flex flex-col gap-5 p-1">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800">
          Chọn hình thức điểm danh
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Chọn phương thức phù hợp với buổi sinh hoạt
        </p>
      </div>

      {/* Method cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* QR Code */}
        {allowedMethods.includes('qr') && <div
          role="button"
          tabIndex={0}
          onClick={handleQrSelect}
          className={`
            group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
            ${loading && selectedMethod === 'qr'
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 active:scale-[0.98]'
            }
            ${loading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 group-hover:shadow-xl transition-shadow">
            {loading && selectedMethod === 'qr' ? (
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            ) : (
              <QrCode className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-gray-800">QR Code</h4>
            <p className="text-xs text-gray-500 mt-1">
              Tạo mã QR — sinh viên quét để điểm danh
            </p>
          </div>
          {/* QR interval selector */}
          <div className="flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
            {QR_INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  setQrInterval(opt.value);
                }}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  qrInterval === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>}

        {/* Proximity */}
        {allowedMethods.includes('proximity') && <div
          role="button"
          tabIndex={0}
          onClick={handleProximitySelect}
          className={`
            group relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
            ${loading && selectedMethod === 'proximity'
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-[0.98]'
            }
            ${loading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:shadow-xl transition-shadow">
            {(loading && selectedMethod === 'proximity') || gettingLocation ? (
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            ) : (
              <MapPin className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="text-center">
            <h4 className="font-semibold text-gray-800">Phạm vi GPS</h4>
            <p className="text-xs text-gray-500 mt-1">
              Mở điểm danh — SV trong phạm vi tự điểm danh
            </p>
          </div>
          {/* Radius selector */}
          <div className="flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  setRadius(opt.value);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  radius === opt.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>}
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
