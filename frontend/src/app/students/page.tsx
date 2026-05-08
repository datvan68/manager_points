'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import GhiNhanTab from '@/components/grading/GhiNhanTab';
import { 
  Search, 
  Plus, 
  Users, 
  School,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  ChevronDown
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import ClassPopup from '@/components/popups/ClassPopup';
import DepartmentPopup from '@/components/popups/DepartmentPopup';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Research } from '@/components/ui/Research';
import { motion, AnimatePresence } from 'framer-motion';
import TabNavigation from '@/components/ui/TabNavigation';
import {
  departments,
  classes
} from '@/lib/mock-data/students';

function StudentsPageContent() {
  const router = useRouter();
  const [selectedDept, setSelectedDept] = useState('CNTT');
  const [activeMainTab, setActiveMainTab] = useState<'Danh sách' | 'Ghi nhận'>('Danh sách');
  const [isClassPopupOpen, setIsClassPopupOpen] = useState(false);
  const [isDeptPopupOpen, setIsDeptPopupOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [editingDept, setEditingDept] = useState<any>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setIsDataLoading(true);
      const t = setTimeout(() => setIsDataLoading(false), 300);
    }
  }, [activeMainTab, selectedDept]);

  const handleClassClick = (classId: string) => {
    router.push(`/students/${classId}`);
  };

  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
            <TabNavigation 
              tabs={[
                { id: 'Ghi nhận', label: 'Ghi nhận' },
                { id: 'Danh sách', label: 'Danh sách' }
              ]}
              activeTab={activeMainTab}
              onTabChange={(id) => setActiveMainTab(id as 'Danh sách' | 'Ghi nhận')}
            />
        <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col bg-gray-50 relative">
          <AnimatePresence mode="wait">
            {activeMainTab === 'Ghi nhận' ? (
              <motion.div 
                key="ghi-nhan" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="flex-1 w-full relative flex flex-col min-h-0"
              >
                <GhiNhanTab />
              </motion.div>
            ) : (
              <motion.div 
                key="danh-sach" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0 w-full overflow-y-auto xl:overflow-hidden"
              >
                  {/* Left Column: Departments */}
                <div className="w-full xl:w-80 flex flex-col gap-4 shrink-0 overflow-hidden xl:max-h-full">
                    <div className="flex items-center justify-between shrink-0 mb-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-bold text-slate-900 tracking-tight uppercase">Khoa</h3>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold w-4 h-4 flex items-center justify-center">8</span>
                        </div>
                        <button className="flex items-center gap-1.5 bg-white border border-slate-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.1)] rounded-md px-2 py-1.5 text-[14px] text-slate-700 hover:bg-slate-50 transition-colors">
                            Trụ sở chính
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                    </div>

                    <Research 
                        placeholder="Tìm kiếm khoa..."
                        containerClassName="w-full max-w-none"
                    />

                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-hover pb-4">
                        {departments.map(dept => (
                            <div 
                                key={dept.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedDept(dept.id)}
                                className={`w-full p-3 rounded-xl border text-left transition-all shrink-0 group flex flex-col cursor-pointer ${
                                    selectedDept === dept.id 
                                        ? 'bg-white border-primary shadow-md ring-1 ring-primary/10' 
                                        : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'
                                }`}
                            >
                                <div className="flex items-start gap-3 w-full">
                                    <div className={`p-2.5 rounded-lg shrink-0 ${selectedDept === dept.id ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-gray-50 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600'} transition-colors`}>
                                        <School size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-semibold text-sm truncate ${selectedDept === dept.id ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {dept.name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                                {dept.code}
                                            </span>
                                            <span className="text-xs text-gray-400">•</span>
                                            <span className="text-xs text-gray-500">{dept.classCount} Lớp</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`w-full flex items-center justify-end border-t overflow-hidden transition-all duration-300 ease-in-out ${
                                    selectedDept === dept.id 
                                        ? 'max-h-14 opacity-100 mt-3 pt-3 border-blue-100' 
                                        : 'max-h-0 opacity-0 mt-0 pt-0 border-transparent group-hover:max-h-14 group-hover:opacity-100 group-hover:mt-3 group-hover:pt-3 group-hover:border-gray-100'
                                }`}>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            className="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingDept({ name: dept.name, code: dept.code });
                                                setIsDeptPopupOpen(true);
                                            }}
                                            title="Sửa"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <button 
                                            className="p-1.5 rounded-md text-red-600 hover:bg-red-100 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toast.success('Đã xóa khoa ' + dept.name);
                                            }}
                                            title="Xóa"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <button 
                            onClick={() => { setEditingDept(null); setIsDeptPopupOpen(true); }}
                            className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2 shrink-0"
                        >
                            <Plus size={18} />
                            Thêm khoa
                        </button>
                    </div>
                </div>

                {/* Right Column: Class List */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-w-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-gray-900">Danh sách lớp</h2>
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">12 lớp</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                                    <span>Thuộc khoa:</span>
                                    <span className="font-medium text-gray-900 flex items-center gap-1">
                                        <School size={14} className="text-gray-400" />
                                        Công nghệ thông tin - Kỹ thuật điện
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <Research 
                                    placeholder="Tìm tên lớp..."
                                    containerClassName="w-full sm:w-64"
                                />
                                <Button 
                                    onClick={() => { setEditingClass(null); setIsClassPopupOpen(true); }}
                                >
                                    <Plus size={18} />
                                    Thêm lớp
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 scrollbar-hover">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {isLoading || isDataLoading ? (
                                Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col h-[160px]">
                                        <Skeleton className="w-16 h-5 mb-3" />
                                        <Skeleton className="w-3/4 h-6 mb-2" />
                                        <Skeleton className="w-1/2 h-4 mb-4" />
                                        <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                                            <Skeleton className="w-20 h-4" />
                                            <div className="flex -space-x-1.5 pl-2">
                                                <Skeleton className="w-5 h-5 rounded-full" />
                                                <Skeleton className="w-5 h-5 rounded-full" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                              <>
                            {classes.map(cls => (
                                <div key={cls.id} onClick={() => handleClassClick(cls.id)} className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-4 flex flex-col cursor-pointer h-full relative overflow-hidden">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-gray-200 shadow-sm">
                                        <button 
                                            className="text-gray-400 hover:text-primary transition-colors p-1.5 rounded hover:bg-blue-50" 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setEditingClass({ name: cls.name, code: cls.id, year: cls.year, departmentId: selectedDept });
                                                setIsClassPopupOpen(true);
                                            }}
                                            title="Sửa lớp"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        <div className="w-[1px] h-3.5 bg-gray-200 mx-0.5"></div>
                                        <button 
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50" 
                                            onClick={(e) => { e.stopPropagation(); toast.success('Đã yêu cầu xóa lớp: ' + cls.name); }}
                                            title="Xóa lớp"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-opacity-20 border-current ${cls.statusColor}`}>
                                            {cls.status}
                                        </div>
                                    </div>
                                    
                                    <div className="mb-3 flex-1">
                                        <h4 className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors cursor-pointer line-clamp-1 mb-1" title={cls.name}>
                                            {cls.name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <CalendarIcon size={12} className="text-gray-400" />
                                            <span className="font-medium">{cls.year}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                                            <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                                <Users size={10} />
                                            </div>
                                            <span className="text-gray-900 font-bold">{cls.students}</span> <span className="text-gray-400 font-normal">học viên</span>
                                        </div>
                                        
                                        {cls.avatars.length > 0 && (
                                            <div className="flex -space-x-1.5 pl-2">
                                                {cls.avatars.map((avatar, idx) => (
                                                    <img key={idx} src={avatar} alt="" className="w-5 h-5 rounded-full border-2 border-white shadow-sm" />
                                                ))}
                                                {cls.extraStudents > 0 && (
                                                    <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-600 shadow-sm">
                                                        +{cls.extraStudents}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button 
                                onClick={() => { setEditingClass(null); setIsClassPopupOpen(true); }}
                                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary/50 hover:bg-blue-50/30 transition-all p-4 h-full min-h-[150px] group"
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-50 group-hover:bg-white border border-gray-200 group-hover:border-primary/20 flex items-center justify-center text-gray-400 group-hover:text-primary shadow-sm transition-all group-hover:scale-110">
                                    <Plus size={20} strokeWidth={2.5} />
                                </div>
                                <span className="text-sm font-semibold text-gray-500 group-hover:text-primary transition-colors">Thêm lớp học mới</span>
                            </button>
                              </>
                            )}
                        </div>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <ClassPopup isOpen={isClassPopupOpen} onClose={() => setIsClassPopupOpen(false)} initialData={editingClass} />
      <DepartmentPopup isOpen={isDeptPopupOpen} onClose={() => setIsDeptPopupOpen(false)} initialData={editingDept} />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">Loading student management...</div>}>
      <StudentsPageContent />
    </Suspense>
  );
}
