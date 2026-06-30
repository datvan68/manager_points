'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { Settings } from 'lucide-react';
import { 
  getModuleIdByPath, 
  subscribeModuleMaintenanceUpdates, 
  getMaintenanceStatesWithCache 
} from '@/utils/module-maintenance.util';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isUnderMaintenance, setIsUnderMaintenance] = useState(false);
  const [maintenanceCheckDone, setMaintenanceCheckDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    if (isLoading) {
      setMaintenanceCheckDone(false);
      return;
    }

    // Admins bypass maintenance mode
    if (!user || isAdminUser(user)) {
      setIsUnderMaintenance(false);
      setMaintenanceCheckDone(true);
      return;
    }

    const moduleId = getModuleIdByPath(pathname);
    if (!moduleId) {
      setIsUnderMaintenance(false);
      setMaintenanceCheckDone(true);
      return;
    }

    const applyStates = (states: Record<string, boolean>) => {
      if (cancelled) return;
      setIsUnderMaintenance(states[moduleId] === true);
      setMaintenanceCheckDone(true);
    };

    const checkMaintenance = async () => {
      try {
        const states = await getMaintenanceStatesWithCache();
        applyStates(states);
      } catch (error) {
        console.error('Failed to load module maintenance states in layout guard:', error);
        if (!cancelled) {
          setIsUnderMaintenance(false);
          setMaintenanceCheckDone(true);
        }
      }
    };

    setMaintenanceCheckDone(false);
    checkMaintenance();

    const unsubscribe = subscribeModuleMaintenanceUpdates(applyStates);
    const handleFocus = () => checkMaintenance();
    window.addEventListener('focus', handleFocus);
    const intervalId = window.setInterval(checkMaintenance, 30000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [pathname, user, isLoading]);

  if (isLoading || !maintenanceCheckDone) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isUnderMaintenance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center select-none animate-in fade-in duration-300">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-full bg-red-500/10 blur-xl w-20 h-20 animate-pulse"></div>
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shadow-sm relative z-10 animate-spin" style={{ animationDuration: '6s' }}>
            <Settings size={28} />
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-slate-800 leading-tight">Phân hệ đang bảo trì</h3>
        <p className="text-sm text-slate-400 font-medium mt-2 max-w-sm">
          Hệ thống đang tiến hành nâng cấp kỹ thuật cho phân hệ này. Vui lòng quay lại sau ít phút.
        </p>

        <button
          onClick={() => router.replace('/')}
          className="mt-6 px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl transition-all shadow-sm cursor-pointer"
        >
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
