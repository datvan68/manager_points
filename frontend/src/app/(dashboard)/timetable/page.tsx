'use client';
import { useState } from 'react';
import { RouteGuard } from '@/components/guards/RouteGuard';
import TimetableLookup from '@/components/timetable/TimetableLookup';
import TimetableSyncPanel from '@/components/timetable/TimetableSyncPanel';
import TimetableSnapshotsPanel from '@/components/timetable/TimetableSnapshotsPanel';
import { useAuth } from '@/providers/auth-provider';
import TabNavigation from '@/components/ui/TabNavigation';

const timetableTabs = [
  { id: 'lookup', label: 'Tra tkb', panelId: 'timetable-lookup-panel' },
  { id: 'snapshots', label: 'Dữ liệu đã đồng bộ', panelId: 'timetable-snapshots-panel' },
  { id: 'settings', label: 'Cấu hình tkb', panelId: 'timetable-settings-panel' },
];

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = String(user?.roleCode || '').toUpperCase() === 'ADMIN';
  const [activeTab, setActiveTab] = useState<'lookup' | 'snapshots' | 'settings'>('lookup');
  const [refreshKey, setRefreshKey] = useState(0);
  return <RouteGuard><main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
    <div className="w-full min-w-0 space-y-4">
      {isAdmin && (
        <TabNavigation tabs={timetableTabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as typeof activeTab)} />
      )}
      <div id="timetable-lookup-panel" role="tabpanel" aria-labelledby="timetable-lookup-tab" hidden={isAdmin && activeTab !== 'lookup'}><TimetableLookup refreshKey={refreshKey} /></div>
      {isAdmin && <div id="timetable-snapshots-panel" role="tabpanel" aria-labelledby="timetable-snapshots-tab" hidden={activeTab !== 'snapshots'}><TimetableSnapshotsPanel /></div>}
      {isAdmin && <div id="timetable-settings-panel" role="tabpanel" aria-labelledby="timetable-settings-tab" hidden={activeTab !== 'settings'}><TimetableSyncPanel onSynced={() => setRefreshKey((current) => current + 1)} /></div>}
    </div>
  </main></RouteGuard>;
}
