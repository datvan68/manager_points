'use client';

import React from 'react';
import { Users, Award, Calendar, ShieldAlert, CheckSquare } from 'lucide-react';
import { ReportKpi } from './report-types';

interface ReportKpiGridProps {
  kpis: ReportKpi[];
  isLoading: boolean;
}

const IconMapper: Record<string, React.ComponentType<any>> = {
  'users': Users,
  'award': Award,
  'calendar': Calendar,
  'shield-alert': ShieldAlert,
  'check-square': CheckSquare
};

export default function ReportKpiGrid({ kpis, isLoading }: ReportKpiGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mx-6 mt-6">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 h-28 animate-pulse flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-slate-200 rounded-md w-2/3" />
              <div className="w-8 h-8 rounded-xl bg-slate-200" />
            </div>
            <div className="h-6 bg-slate-200 rounded-md w-1/2" />
            <div className="h-3 bg-slate-200 rounded-md w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mx-6 mt-6">
      {kpis.map((kpi, index) => {
        const IconComponent = IconMapper[kpi.iconName] || Users;
        return (
          <div
            key={index}
            className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-150 flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider truncate">{kpi.title}</span>
              <div className="w-8 h-8 rounded-xl bg-white/40 border border-white/70 flex items-center justify-center text-[#1A73E8] group-hover:bg-[#1A73E8] group-hover:text-white transition-all duration-150 shrink-0">
                <IconComponent size={16} />
              </div>
            </div>

            <div className="mt-2.5">
              <span className="text-2xl font-black text-[#1E293B] tracking-tight">{kpi.value}</span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/50 flex items-center justify-between text-[11px]">
              <span className="text-[#64748B] font-semibold truncate">{kpi.description}</span>
              {kpi.trend && (
                <span className={`font-bold ${kpi.trend.isPositive ? 'text-emerald-600' : 'text-rose-600'} shrink-0 ml-1`}>
                  {kpi.trend.value}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
