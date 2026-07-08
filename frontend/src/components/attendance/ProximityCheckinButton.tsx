'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, CheckCircle2, XCircle, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

interface ProximityCheckinButtonProps {
  sessionLatitude: number;
  sessionLongitude: number;
  sessionRadius: number;
  onCheckin: (latitude: number, longitude: number) => Promise<void>;
  checkinStatus: 'idle' | 'checking' | 'success' | 'error';
  checkinError?: string | null;
  disabled?: boolean;
}

/**
 * Calculate Haversine distance in meters (client-side preview).
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ProximityCheckinButton({
  sessionLatitude,
  sessionLongitude,
  sessionRadius,
  onCheckin,
  checkinStatus,
  checkinError,
  disabled = false,
}: ProximityCheckinButtonProps) {
  const geo = useGeolocation({ watch: true, enableHighAccuracy: true });
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (geo.latitude != null && geo.longitude != null) {
      const d = haversineDistance(
        sessionLatitude, sessionLongitude,
        geo.latitude, geo.longitude,
      );
      setDistance(Math.round(d));
    }
  }, [geo.latitude, geo.longitude, sessionLatitude, sessionLongitude]);

  const isInRange = distance != null && distance <= sessionRadius;
  const isLoading = geo.loading;

  const handleCheckin = async () => {
    if (!geo.latitude || !geo.longitude) return;
    await onCheckin(geo.latitude, geo.longitude);
  };

  // Success state
  if (checkinStatus === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 p-5 bg-emerald-50 rounded-2xl border border-emerald-200">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-emerald-700">Điểm danh thành công!</p>
          <p className="text-xs text-emerald-600 mt-0.5">Bạn đã được ghi nhận.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (checkinStatus === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 p-5 bg-red-50 rounded-2xl border border-red-200">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <XCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-red-600">Điểm danh thất bại</p>
          <p className="text-xs text-red-500 mt-0.5">
            {checkinError || 'Vui lòng thử lại.'}
          </p>
        </div>
      </div>
    );
  }

  // GPS error
  if (geo.error) {
    return (
      <div className="flex flex-col items-center gap-3 p-5 bg-amber-50 rounded-2xl border border-amber-200">
        <Navigation className="w-8 h-8 text-amber-600" />
        <div className="text-center">
          <p className="font-medium text-amber-700 text-sm">{geo.error}</p>
          <button
            onClick={geo.getCurrentPosition}
            className="mt-2 text-xs text-blue-600 underline"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Loading GPS
  if (isLoading || distance == null) {
    return (
      <div className="flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl border border-gray-200">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-500">Đang xác định vị trí...</p>
      </div>
    );
  }

  // Main state: In range or out of range
  return (
    <div className="flex flex-col items-center gap-4 p-5">
      {/* Distance indicator */}
      <div className="flex flex-col items-center gap-2">
        <div className={`text-3xl font-bold ${isInRange ? 'text-emerald-600' : 'text-gray-400'}`}>
          {distance}m
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${isInRange ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}
          />
          <span className={`text-xs font-medium ${isInRange ? 'text-emerald-600' : 'text-gray-400'}`}>
            {isInRange
              ? 'Bạn đang trong phạm vi điểm danh'
              : `Ngoài phạm vi (cần ≤ ${sessionRadius}m)`
            }
          </span>
        </div>
        {geo.accuracy && (
          <span className="text-xs text-gray-400">
            Độ chính xác GPS: ±{Math.round(geo.accuracy)}m
          </span>
        )}
      </div>

      {/* Checkin button */}
      <button
        onClick={handleCheckin}
        disabled={!isInRange || disabled || checkinStatus === 'checking'}
        className={`
          w-full py-4 rounded-2xl text-base font-semibold transition-all duration-300
          flex items-center justify-center gap-2
          ${isInRange
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 active:scale-[0.98]'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
          ${checkinStatus === 'checking' ? 'opacity-80 cursor-wait' : ''}
        `}
      >
        {checkinStatus === 'checking' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Đang xử lý...
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            Điểm danh
          </>
        )}
      </button>
    </div>
  );
}
