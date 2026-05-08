'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Building2, 
  GraduationCap, 
  BarChart3, 
  Shield, 
  ChevronLeft, 
  Settings 
} from 'lucide-react';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Calendar, label: 'Công việc & sự kiện', href: '/tasks' },
    { icon: Users, label: 'Quản lý sinh viên', href: '/students' },
    { icon: Building2, label: 'Quản lý KTX', href: '/dormitory' },
    { icon: GraduationCap, label: 'Hệ thống chấm điểm', href: '/grading' },
    { icon: BarChart3, label: 'Thống kê báo cáo', href: '/reports' },
    { icon: Shield, label: 'Phân quyền', href: '/permissions' },
  ];

  return (
    <div className={`flex flex-col h-screen ${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 justify-between transition-all duration-300`}>
      {/* Header */}
      <div className={`p-4 ${isCollapsed ? 'flex justify-center' : 'block'}`}>
        <div className={`flex items-center gap-2 mb-2 ${isCollapsed ? 'justify-center' : ''}`}>
           {/* Placeholder for EduManager Logo Vector */}
           <div className="w-8 h-8 min-w-[32px] bg-primary rounded-lg flex items-center justify-center text-white font-bold">E</div>
           {!isCollapsed && <span className="text-xl font-bold text-gray-800 animate-in fade-in duration-200">EduManager</span>}
        </div>
        {!isCollapsed && <div className="text-sm text-gray-500 px-1 animate-in fade-in duration-200">Quản lý sinh viên</div>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-hidden">
        {menuItems.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={index}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-primary' 
                  : 'text-text-secondary hover:bg-gray-50 hover:text-text-main'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              <item.icon size={20} className="min-w-[20px]" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 space-y-1">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 ${isCollapsed ? 'justify-center' : ''}`}
          data-id="btn/Compact"
        >
          <ChevronLeft size={20} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
          {!isCollapsed && <span>Thu gọn</span>}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Settings size={20} />
          Cài đặt
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
