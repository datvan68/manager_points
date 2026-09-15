'use client';
import { useState } from 'react';
import { RouteGuard } from '@/components/guards/RouteGuard';
import TimetableLookup from '@/components/timetable/TimetableLookup';
import TimetableSyncPanel from '@/components/timetable/TimetableSyncPanel';
import { useAuth } from '@/providers/auth-provider';
import TabNavigation from '@/components/ui/TabNavigation';
import StudentSectionTabs from '@/components/students/StudentSectionTabs';

const timetableTabs = [
  { id: 'lookup', label: 'Tra cứu', panelId: 'timetable-lookup-panel' },
  { id: 'settings', label: 'Cấu hình', panelId: 'timetable-settings-panel' },
];

export default function TimetablePage() {
  const { user, hasPermission } = useAuth();
  const allows = (code: string) => typeof hasPermission === 'function' ? hasPermission(code) : String(user?.roleCode || '').toUpperCase() === 'ADMIN';
  const canRead = allows('TIMETABLE_READ');
  const canConfigure = allows('TIMETABLE_SETTINGS_READ') || allows('TIMETABLE_SYNC');
  const [activeTab, setActiveTab] = useState<'lookup' | 'settings'>('lookup');
  const [refreshKey, setRefreshKey] = useState(0);
  return <RouteGuard requiredPermission="TIMETABLE_PAGE"><div className="flex min-h-0 flex-1 flex-col">
    <StudentSectionTabs activeTab="Thời khóa biểu" />
    {canConfigure && (
      <TabNavigation tabs={timetableTabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as typeof activeTab)} responsiveScrollable />
    )}
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col w-full min-w-0">
        {canRead ? <div id="timetable-lookup-panel" role="tabpanel" aria-labelledby="timetable-lookup-tab" className="h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" hidden={canConfigure && activeTab !== 'lookup'}><TimetableLookup refreshKey={refreshKey} /></div> : <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Bạn đã được cấp quyền mở trang thời khóa biểu nhưng chưa có quyền xem dữ liệu.</div>}
        {canConfigure && <div id="timetable-settings-panel" role="tabpanel" aria-labelledby="timetable-settings-tab" className="flex min-h-0 flex-1 flex-col overflow-hidden" hidden={activeTab !== 'settings'}><TimetableSyncPanel active={activeTab === 'settings'} onSynced={() => setRefreshKey((current) => current + 1)} /></div>}
      </div>
    </main>
  </div></RouteGuard>;
}
