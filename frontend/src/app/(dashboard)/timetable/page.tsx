'use client';
import { useState } from 'react';
import { RouteGuard } from '@/components/guards/RouteGuard';
import TimetableLookup from '@/components/timetable/TimetableLookup';
import TimetableSyncPanel from '@/components/timetable/TimetableSyncPanel';

export default function TimetablePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <RouteGuard><main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="w-full min-w-0 space-y-4">
      <div><h1 className="text-2xl font-black text-[#1E293B]">Thời khóa biểu</h1><p className="mt-1 text-sm text-[#64748B]">Tra cứu lịch học theo dữ liệu nhà trường.</p></div>
      <TimetableLookup refreshKey={refreshKey} />
      <TimetableSyncPanel onSynced={() => setRefreshKey((current) => current + 1)} />
    </div>
  </main></RouteGuard>;
}
