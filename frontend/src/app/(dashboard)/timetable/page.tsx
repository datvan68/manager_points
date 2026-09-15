'use client';
import { useState } from 'react';
import { RouteGuard } from '@/components/guards/RouteGuard';
import TimetableLookup from '@/components/timetable/TimetableLookup';
import TimetableSyncPanel from '@/components/timetable/TimetableSyncPanel';
import { useAuth } from '@/providers/auth-provider';
import TabNavigation from '@/components/ui/TabNavigation';

const timetableTabs = [
  { id: 'lookup', label: 'Tra cứu', panelId: 'timetable-lookup-panel' },
  { id: 'settings', label: 'Cấu hình', panelId: 'timetable-settings-panel' },
];

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = String(user?.roleCode || '').toUpperCase() === 'ADMIN';
  const [activeTab, setActiveTab] = useState<'lookup' | 'settings'>('lookup');
  const [refreshKey, setRefreshKey] = useState(0);
  return <RouteGuard><div className="flex min-h-0 flex-1 flex-col">
    {isAdmin && (
      <TabNavigation tabs={timetableTabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as typeof activeTab)} responsiveScrollable />
    )}
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col w-full min-w-0">
        <div id="timetable-lookup-panel" role="tabpanel" aria-labelledby="timetable-lookup-tab" className="h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" hidden={isAdmin && activeTab !== 'lookup'}><TimetableLookup refreshKey={refreshKey} /></div>
        {isAdmin && <div id="timetable-settings-panel" role="tabpanel" aria-labelledby="timetable-settings-tab" className="flex min-h-0 flex-1 flex-col overflow-hidden" hidden={activeTab !== 'settings'}><TimetableSyncPanel active={activeTab === 'settings'} onSynced={() => setRefreshKey((current) => current + 1)} /></div>}
      </div>
    </main>
  </div></RouteGuard>;
}
