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
import Action from '@/components/ui/Action';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isCaoDangExpanded, setIsCaoDangExpanded] = useState(true);
  const [isTrungCapExpanded, setIsTrungCapExpanded] = useState(true);

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

  const currentDeptName = departments.find(d => d.id === selectedDept)?.name || 'Công nghệ thông tin - Kỹ thuật điện';

  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const caoDangClasses = filteredClasses.filter(cls => 
    cls.name.toLowerCase().includes('k45') || cls.id.toLowerCase().includes('k45')
  );

  const trungCapClasses = filteredClasses.filter(cls => 
    !cls.name.toLowerCase().includes('k45') && !cls.id.toLowerCase().includes('k45')
  );

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
                        {/* <button className="flex items-center gap-1.5 bg-white border border-slate-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.1)] rounded-md px-2 py-1.5 text-[14px] text-slate-700 hover:bg-slate-50 transition-colors">
                            Trụ sở chính
                            <ChevronDown size={14} className="text-slate-400" />
                        </button> */}
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
                                    <Action 
                                        onEdit={() => {
                                            setEditingDept({ name: dept.name, code: dept.code });
                                            setIsDeptPopupOpen(true);
                                        }}
                                        onDelete={() => toast.success('Đã xóa khoa ' + dept.name)}
                                    />
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
                <div className="flex-1 bg-white rounded-3xl border border-slate-200/80 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex flex-col min-w-0 overflow-hidden relative">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-[#f3f4f6] shrink-0">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-[24px] font-bold text-[#1f2937] leading-[32px] tracking-tight">Danh sách lớp</h2>
                                    <span className="text-[12px] font-bold text-[#4f46e5] bg-[#eef2ff] px-[12px] py-[4px] rounded-full">
                                        {filteredClasses.length} lớp
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[14px]">
                                    <span className="text-[#6b7280] font-medium">Thuộc khoa:</span>
                                    <span className="font-bold text-[#1f2937] flex items-center gap-1.5">
                                        <School size={16} className="text-[#6b7280]" />
                                        {currentDeptName}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <Research 
                                    placeholder="Tìm tên lớp..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Button 
                                    onClick={() => { setEditingClass(null); setIsClassPopupOpen(true); }}
                                >
                                    <span className="text-[20px] font-bold leading-none -mt-0.5">+</span>
                                    Thêm lớp
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Class cards container */}
                    <div className="flex-1 overflow-y-auto px-8 py-4 bg-slate-50/20 scrollbar-hover">
                        <div className="flex flex-col gap-4 w-full">
                            {isLoading || isDataLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col h-[180px]">
                                            <Skeleton className="w-16 h-5 mb-3" />
                                            <Skeleton className="w-3/4 h-6 mb-2" />
                                            <Skeleton className="w-1/2 h-4 mb-4" />
                                            <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                                                <Skeleton className="w-20 h-4" />
                                                <div className="flex -space-x-1.5 pl-2">
                                                    <Skeleton className="w-6 h-6 rounded-full" />
                                                    <Skeleton className="w-6 h-6 rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {/* Cao đẳng Section */}
                                    <div className="flex flex-col gap-4 w-full">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex flex-1 items-center">
                                                <span className="text-[14px] font-medium text-[#6b7280] tracking-wide">Hệ Cao đẳng</span>
                                                <div className="flex-1 h-px bg-[#f3f4f6] ml-4" />
                                            </div>
                                            <button 
                                                onClick={() => setIsCaoDangExpanded(!isCaoDangExpanded)}
                                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                                            >
                                                <ChevronDown size={18} className={`transition-transform duration-250 ${isCaoDangExpanded ? '' : 'rotate-180'}`} />
                                            </button>
                                        </div>

                                        {isCaoDangExpanded && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {caoDangClasses.map(cls => (
                                                    <div 
                                                        key={cls.id} 
                                                        onClick={() => handleClassClick(cls.id)} 
                                                        className="group bg-white border border-[#f3f4f6] rounded-[16px] p-[21px] flex flex-col gap-[8px] h-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300 relative cursor-pointer"
                                                    >
                                                        {/* Action Hover overlay */}
                                                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl  shadow-md">
                                                            <Action 
                                                                onEdit={() => {
                                                                    setEditingClass({ name: cls.name, code: cls.id, year: cls.year, departmentId: selectedDept });
                                                                    setIsClassPopupOpen(true);
                                                                }}
                                                                onDelete={() => toast.success('Đã yêu cầu xóa lớp: ' + cls.name)}
                                                            />
                                                        </div>
                                                        
                                                        <div className="flex items-start justify-between">
                                                            <div className={`px-[10px] py-[4px] rounded-[8px] text-[10px] font-bold uppercase tracking-wider ${
                                                                cls.status === 'Đang học' 
                                                                    ? 'bg-[#f0fdf4] text-[#16a34a]' 
                                                                    : cls.status === 'Sắp tốt nghiệp'
                                                                        ? 'bg-[#fff7ed] text-[#ea580c]'
                                                                        : 'bg-[#f9fafb] border border-[#e5e7eb] text-[#6b7280]'
                                                            }`}>
                                                                {cls.status}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex-1 mt-2">
                                                            <h4 className="text-[18px] font-bold text-[#1f2937] leading-[28px] line-clamp-1 group-hover:text-[#5519f0] transition-colors" title={cls.name}>
                                                                {cls.name}
                                                            </h4>
                                                            <div className="flex items-center gap-[6px] text-[12px] text-[#9ca3af] mt-1 font-normal">
                                                                <CalendarIcon size={14} className="text-[#9ca3af]" />
                                                                <span>{cls.year}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-4">
                                                            <div className="bg-[#eef2ff] px-[8px] py-[6px] rounded-[8px] flex items-center gap-[8px] text-[12px] font-bold text-[#4f46e5]">
                                                                <Users size={14} className="text-[#4f46e5]" />
                                                                <span>
                                                                    {cls.students}{' '}
                                                                    <span className="text-[#9ca3af] text-[10px] font-normal">học viên</span>
                                                                </span>
                                                            </div>
                                                            
                                                            {cls.avatars.length > 0 && (
                                                                <div className="flex -space-x-2 pl-2">
                                                                    {cls.avatars.map((avatar, idx) => (
                                                                        <img key={idx} src={avatar} alt="" className="w-[28px] h-[28px] rounded-full border-2 border-white shadow-sm shrink-0 object-cover" />
                                                                    ))}
                                                                    {cls.extraStudents > 0 && (
                                                                        <div className="w-[28px] h-[28px] rounded-full border-2 border-white bg-[#f9fafb] flex items-center justify-center text-[8px] font-bold text-[#6b7280] shadow-sm shrink-0">
                                                                            +{cls.extraStudents}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Add new Class card inside Cao đẳng */}
                                                <div 
                                                    onClick={() => { setEditingClass(null); setIsClassPopupOpen(true); }}
                                                    className="border-2 border-dashed border-[#e5e7eb] hover:border-[#5519f0]/40 rounded-[16px] flex flex-col items-center justify-center p-[22px] py-[50px] cursor-pointer hover:bg-[#5519f0]/5 transition-all group min-h-[190px]"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-white border border-[#f3f4f6] group-hover:border-[#5519f0]/20 flex items-center justify-center text-gray-400 group-hover:text-[#5519f0] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-all group-hover:scale-110">
                                                        <Plus size={20} strokeWidth={2.5} />
                                                    </div>
                                                    <span className="text-[14px] font-bold text-[#6b7280] group-hover:text-[#5519f0] transition-colors mt-3">Thêm lớp học mới</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Trung cấp Section */}
                                    <div className="flex flex-col gap-4 w-full">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex flex-1 items-center">
                                                <span className="text-[14px] font-medium text-[#6b7280] tracking-wide">Hệ Trung cấp</span>
                                                <div className="flex-1 h-px bg-[#f3f4f6] ml-4" />
                                            </div>
                                            <button 
                                                onClick={() => setIsTrungCapExpanded(!isTrungCapExpanded)}
                                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                                            >
                                                <ChevronDown size={18} className={`transition-transform duration-250 ${isTrungCapExpanded ? '' : 'rotate-180'}`} />
                                            </button>
                                        </div>

                                        {isTrungCapExpanded && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {trungCapClasses.map(cls => (
                                                    <div 
                                                        key={cls.id} 
                                                        onClick={() => handleClassClick(cls.id)} 
                                                        className="group bg-white border border-[#f3f4f6] rounded-[16px] p-[21px] flex flex-col gap-[8px] h-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300 relative cursor-pointer"
                                                    >
                                                        {/* Action Hover overlay */}
                                                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl  shadow-md">
                                                            <Action 
                                                                onEdit={() => {
                                                                    setEditingClass({ name: cls.name, code: cls.id, year: cls.year, departmentId: selectedDept });
                                                                    setIsClassPopupOpen(true);
                                                                }}
                                                                onDelete={() => toast.success('Đã yêu cầu xóa lớp: ' + cls.name)}
                                                            />
                                                        </div>
                                                        
                                                        <div className="flex items-start justify-between">
                                                            <div className={`px-[10px] py-[4px] rounded-[8px] text-[10px] font-bold uppercase tracking-wider ${
                                                                cls.status === 'Đang học' 
                                                                    ? 'bg-[#f0fdf4] text-[#16a34a]' 
                                                                    : cls.status === 'Sắp tốt nghiệp'
                                                                        ? 'bg-[#fff7ed] text-[#ea580c]'
                                                                        : 'bg-[#f9fafb] border border-[#e5e7eb] text-[#6b7280]'
                                                            }`}>
                                                                {cls.status}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex-1 mt-2">
                                                            <h4 className="text-[18px] font-bold text-[#1f2937] leading-[28px] line-clamp-1 group-hover:text-[#5519f0] transition-colors" title={cls.name}>
                                                                {cls.name}
                                                            </h4>
                                                            <div className="flex items-center gap-[6px] text-[12px] text-[#9ca3af] mt-1 font-normal">
                                                                <CalendarIcon size={14} className="text-[#9ca3af]" />
                                                                <span>{cls.year}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-4">
                                                            <div className="bg-[#eef2ff] px-[8px] py-[6px] rounded-[8px] flex items-center gap-[8px] text-[12px] font-bold text-[#4f46e5]">
                                                                <Users size={14} className="text-[#4f46e5]" />
                                                                <span>
                                                                    {cls.students}{' '}
                                                                    <span className="text-[#9ca3af] text-[10px] font-normal">học viên</span>
                                                                </span>
                                                            </div>
                                                            
                                                            {cls.avatars.length > 0 && (
                                                                <div className="flex -space-x-2 pl-2">
                                                                    {cls.avatars.map((avatar, idx) => (
                                                                        <img key={idx} src={avatar} alt="" className="w-[28px] h-[28px] rounded-full border-2 border-white shadow-sm shrink-0 object-cover" />
                                                                    ))}
                                                                    {cls.extraStudents > 0 && (
                                                                        <div className="w-[28px] h-[28px] rounded-full border-2 border-white bg-[#f9fafb] flex items-center justify-center text-[8px] font-bold text-[#6b7280] shadow-sm shrink-0">
                                                                            +{cls.extraStudents}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
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
