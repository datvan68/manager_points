'use client';

import React from 'react';
import { MapPin, Users, Settings2 } from 'lucide-react';
import type { AttendanceCheckinData } from '@/api/club-api';

interface ProximityPanelProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  checkinCount: number;
  checkins: AttendanceCheckinData[];
  onClose?: () => void;
  onRadiusChange?: (radius: number) => void;
  sessionTitle?: string;
}

const RADIUS_OPTIONS = [50, 100, 200, 500];

export default function ProximityPanel({
  latitude,
  longitude,
  radiusMeters,
  checkinCount,
  checkins,
  onClose,
  onRadiusChange,
  sessionTitle,
}: ProximityPanelProps) {
  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-blue-600">
            Điểm danh phạm vi đang mở
          </span>
        </div>
        {sessionTitle && (
          <h3 className="text-lg font-semibold text-gray-800">{sessionTitle}</h3>
        )}
      </div>

      {/* Map placeholder with radius visualization */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <div className="flex flex-col items-center gap-4">
          {/* Radius circle visualization */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Outer pulse */}
            <div
              className="absolute inset-0 rounded-full border-2 border-blue-300/40 animate-ping"
              style={{ animationDuration: '2s' }}
            />
            {/* Radius circle */}
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-blue-400/60 bg-blue-100/30" />
            {/* Center dot */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-600 shadow-lg shadow-blue-200 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold text-blue-700">{radiusMeters}m</span>
            </div>
          </div>

          {/* Coordinates */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Lat: {latitude.toFixed(6)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>Lng: {longitude.toFixed(6)}</span>
          </div>
        </div>
      </div>

      {/* Radius adjustment */}
      {onRadiusChange && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Phạm vi</span>
          </div>
          <div className="flex gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => onRadiusChange(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  r === radiusMeters
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r}m
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live checkin count */}
      <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Đã điểm danh</span>
        </div>
        <span className="text-xl font-bold text-emerald-600">{checkinCount}</span>
      </div>

      {/* Recent checkins */}
      {checkins.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
            Gần đây
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {checkins.slice(0, 10).map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                    {(c.student_id?.full_name || '?')[0]}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {c.student_id?.full_name || 'N/A'}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {c.student_id?.student_code || ''}
                    </span>
                  </div>
                </div>
                {c.distance_meters != null && (
                  <span className="text-xs text-gray-400">{c.distance_meters}m</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="mt-1 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium
                     hover:bg-red-100 transition-colors border border-red-100 w-full"
        >
          Đóng phiên điểm danh
        </button>
      )}
    </div>
  );
}
