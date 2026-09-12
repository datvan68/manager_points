'use client';
import { useState } from 'react';
import { RouteGuard } from '@/components/guards/RouteGuard';
import TimetableLookup from '@/components/timetable/TimetableLookup';
import TimetableSyncPanel from '@/components/timetable/TimetableSyncPanel';
import { useAuth } from '@/providers/auth-provider';

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = String(user?.roleCode || '').toUpperCase() === 'ADMIN';
  const [activeTab, setActiveTab] = useState<'lookup' | 'settings'>('lookup');
  const [refreshKey, setRefreshKey] = useState(0);
  return <RouteGuard><main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="w-full min-w-0 space-y-4">
      <div><h1 className="text-2xl font-black text-[#1E293B]">Thời khóa biểu</h1><p className="mt-1 text-sm text-[#64748B]">Tra cứu lịch học theo dữ liệu nhà trường.</p></div>
      {isAdmin && <div role="tablist" aria-label="Thời khóa biểu" className="flex w-full gap-2 overflow-x-auto border-b border-slate-200">
        <button type="button" role="tab" aria-selected={activeTab === 'lookup'} aria-controls="timetable-lookup-panel" id="timetable-lookup-tab" onClick={() => setActiveTab('lookup')} className="whitespace-nowrap px-3 py-2 text-sm font-bold text-slate-700">Tra tkb</button>
        <button type="button" role="tab" aria-selected={activeTab === 'settings'} aria-controls="timetable-settings-panel" id="timetable-settings-tab" onClick={() => setActiveTab('settings')} className="whitespace-nowrap px-3 py-2 text-sm font-bold text-slate-700">Cấu hình tkb</button>
      </div>}
      <div id="timetable-lookup-panel" role="tabpanel" aria-labelledby="timetable-lookup-tab" hidden={isAdmin && activeTab !== 'lookup'}><TimetableLookup refreshKey={refreshKey} /></div>
      {isAdmin && <div id="timetable-settings-panel" role="tabpanel" aria-labelledby="timetable-settings-tab" hidden={activeTab !== 'settings'}><TimetableSyncPanel onSynced={() => setRefreshKey((current) => current + 1)} /></div>}
    </div>
  </main></RouteGuard>;
}
