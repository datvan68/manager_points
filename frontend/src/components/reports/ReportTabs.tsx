'use client';

import React from 'react';
import { 
  LayoutDashboard, Users, Award, FileText, Calendar, CheckSquare, Settings 
} from 'lucide-react';

export type ReportTabType = 'overview' | 'student' | 'score' | 'record' | 'attendance' | 'task' | 'system';

interface ReportTabsProps {
  activeTab: ReportTabType;
  onChange: (tab: ReportTabType) => void;
  onTabMouseEnter?: (tab: ReportTabType) => void;
  counts?: Record<string, number>;
  showSystemTab?: boolean;
}

interface TabItem {
  id: ReportTabType;
  label: string;
  icon: React.ComponentType<any>;
}

export default function ReportTabs({
  activeTab,
  onChange,
  onTabMouseEnter,
  counts = {},
  showSystemTab = true
}: ReportTabsProps) {
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'student', label: 'Sinh viên', icon: Users },
    { id: 'score', label: 'Điểm rèn luyện', icon: Award },
    { id: 'record', label: 'Ghi nhận rèn luyện', icon: FileText },
    { id: 'attendance', label: 'Chuyên cần', icon: Calendar },
    { id: 'task', label: 'Nhiệm vụ', icon: CheckSquare }
  ];

  if (showSystemTab) {
    tabs.push({ id: 'system', label: 'Hệ thống & Logs', icon: Settings });
  }

  return (
    <div className="mx-6 mt-6 pb-2 border-b border-white/50">
      <div className="flex flex-wrap gap-2 overflow-x-auto custom-scrollbar pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              onMouseEnter={() => onTabMouseEnter && onTabMouseEnter(tab.id)}
              onFocus={() => onTabMouseEnter && onTabMouseEnter(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-xl transition-all duration-150 cursor-pointer whitespace-nowrap outline-none ${
                isActive
                  ? 'bg-white/60 border border-white/75 shadow-sm text-[#1A73E8] scale-[1.01]'
                  : 'border border-transparent text-[#64748B] hover:text-[#1E293B] hover:bg-white/30 hover:border-white/40'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`px-2 py-0.5 rounded-xl text-[10px] font-extrabold transition-all duration-150 ${
                  isActive ? 'bg-[#1A73E8]/10 text-[#1A73E8]' : 'bg-white/50 text-[#64748B]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
