'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Check, 
  Pen, 
  ChevronDown, 
  ShieldCheck, 
  Star, 
  MinusCircle,
  Settings,
  Calendar
} from 'lucide-react';
import { 
  mockStudents, 
  classes, 
  mockRecords, 
  mockCategories 
} from '@/lib/mock-data/students';
import { toast } from 'sonner';
import { classApi, Class } from '@/api/class-api';

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const classId = params.classId as string;
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'category' | 'history'>('category');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  const handleTabChange = (tab: 'category' | 'history') => {
    setActiveTab(tab);
    setIsTabLoading(true);
    setTimeout(() => setIsTabLoading(false), 300);
  };

  const [targetClass, setTargetClass] = useState<Class | null>(null);

  useEffect(() => {
    classApi.getClass(classId)
      .then(setTargetClass)
      .catch(err => console.error('Lỗi khi tải thông tin lớp học:', err));
  }, [classId]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const student = mockStudents.find(s => s.id === studentId);

  const handleSave = () => {
    toast.success('Thông tin đã được lưu thành công!');
  };

  // --- Personal info data rows (Figma: label left, value right, horizontal justified) ---
  const personalInfoRows = [
    { label: 'Họ và Tên', value: student?.name || '' },
    { label: 'Ngày sinh', value: student?.dob || '15/05/2003' },
    { label: 'Giới tính', value: student?.gender || 'Nam' },
    { label: 'Email', value: student?.email || 'an.nv2024@university.edu.vn' },
    { label: 'Số điện thoại', value: '0987 654 321' },
  ];

  const academicInfoRows = [
    { label: 'Mã số sinh viên (MSSV)', value: student?.id || '20240102' },
    { label: 'Khoa', value: 'Kinh tế & Quản trị kinh doanh' },
    { label: 'Lớp', value: targetClass ? targetClass.class_name : (student?.classId || 'N/A') },
  ];

  // --- LOADING STATE ---
  if (isLoading) {
    return (
      <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <Header customMappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: student ? student.name : studentId }} />
          <main className="flex-1 overflow-y-auto bg-white flex flex-col items-center pb-[40px]">
            <div className="w-full px-[24px] pt-[24px] pb-[17px] flex items-center justify-between">
              <div className="flex gap-[16px] items-center">
                <Skeleton className="w-[40px] h-[40px] rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="w-[160px] h-[28px] rounded-md" />
                  <Skeleton className="w-[120px] h-[20px] rounded-md" />
                </div>
              </div>
              <Skeleton className="w-[183px] h-[44px] rounded-[12px]" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-[32px] w-full max-w-7xl px-4 sm:px-6 mt-[40px]">
              <div className="flex flex-col gap-[32px]">
                <Skeleton className="w-full h-[144px] rounded-[24px]" />
                <Skeleton className="w-full h-[271px] rounded-[24px]" />
                <Skeleton className="w-full h-[198px] rounded-[24px]" />
              </div>
              <div className="flex flex-col gap-[24px]">
                {/* Stats row skeleton */}
                <Skeleton className="w-full h-[80px] rounded-[16px]" />
                
                {/* Tabs Container Skeleton */}
                <div className="bg-[#f9fafb] flex flex-col rounded-[24px] shadow-sm overflow-hidden w-full h-[722px]">
                  {/* Tab header skeleton */}
                  <div className="border-b border-gray-100 px-[32px] pt-[32px] flex gap-[24px]">
                    <Skeleton className="w-[80px] h-[20px] mb-[16px]" />
                    <Skeleton className="w-[120px] h-[20px] mb-[16px]" />
                  </div>
                  {/* Content skeleton - list of cards */}
                  <div className="flex flex-col gap-[16px] p-[24px]">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="w-full h-[100px] rounded-[12px]" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // --- NOT FOUND ---
  if (!student) {
    return (
      <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <Header customMappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: student ? student.name : studentId }} />
          <main className="flex-1 overflow-y-auto bg-white flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <p className="text-[20px] font-bold text-slate-800">Không tìm thấy sinh viên</p>
              <p className="text-[14px] text-slate-500">Mã sinh viên <strong>{studentId}</strong> không tồn tại trong hệ thống.</p>
              <button 
                onClick={() => router.push(`/students/${classId}`)}
                className="mt-4 px-6 py-3 bg-[#135bec] text-white rounded-[12px] font-semibold hover:bg-blue-700 transition-colors"
              >
                Quay lại danh sách lớp
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header customMappings={{ [classId]: targetClass ? targetClass.class_name : classId, [studentId]: student ? student.name : studentId }} />
        
        <motion.main 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto bg-white flex flex-col items-center pb-[73px]"
        >
          {/* ═══ MainHeader ═══ Figma: 1280x81, HORIZONTAL, SPACE_BETWEEN, pad 16 24 */}
          <div className="sticky top-0 z-10 backdrop-blur-[6px] bg-[rgba(255,255,255,0.92)] border-b border-[#f3f4f6] flex items-center justify-between py-[16px] px-[24px] w-full">
            <div className="flex gap-[16px] items-center">
              <button 
                onClick={() => router.push(`/students/${classId}`)}
                className="w-[40px] h-[40px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-[24px] h-[24px] text-slate-800" />
              </button>
              <div className="flex flex-col">
                <h1 className="font-sans font-bold text-[#111827] text-[20px] leading-[28px]">
                  {student.name}
                </h1>
                <p className="font-sans font-normal text-[#6b7280] text-[14px] leading-[20px]">
                  MSSV: {student.id}
                </p>
              </div>
            </div>
            
            {/* Figma: 183x44, bg #135bec, radius 12, pad 10 24, gap 8 */}
            <button 
              onClick={handleSave}
              className="relative bg-[#135bec] rounded-[12px] flex gap-[8px] items-center px-[24px] py-[10px] hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <div className="absolute inset-0 rounded-[12px] shadow-[0px_10px_15px_-3px_#bfdbfe,0px_4px_6px_-4px_#bfdbfe] pointer-events-none" />
              <Check className="w-[20px] h-[20px] text-white" />
              <span className="font-sans font-bold text-[16px] text-white leading-[24px]">
                Lưu Thay Đổi
              </span>
            </button>
          </div>

          {/* ═══ Main Content ═══ Figma: 1200x830, CSS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-[24px] w-full max-w-7xl px-4 sm:px-6 mt-[12px]">
            
            {/* ═══ LEFT COLUMN ═══ Figma: 481px, VERTICAL, gap 32 */}
            <div className="flex flex-col gap-[32px] pb-[40px]">
              
              {/* ── Profile Picture Upload Area ── Figma: 481x144, HORIZONTAL, gap 24, pad 24, radius 24 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-[#f9fafb] flex items-center gap-[24px] p-[24px] rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full"
              >
                {/* Avatar Container — Figma: 96x96 */}
                <div className="relative shrink-0">
                  <div className="bg-[#e5e7eb] rounded-[16px] shadow-[0px_0px_0px_4px_white,0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] w-[96px] h-[96px] overflow-hidden group cursor-pointer">
                    <img 
                      alt="Avatar" 
                      className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" 
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${student.id}&backgroundColor=b6e3f4`} 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-[16px]">
                      <Pen className="w-[24px] h-[24px] text-white" />
                    </div>
                  </div>
                  {/* Small edit button — Figma: 26x26, pad 6, radius 8 */}
                  <button className="absolute bottom-[-4px] right-[-4px] bg-[#135bec] p-[6px] rounded-[8px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] hover:bg-blue-700 transition-colors cursor-pointer">
                    <Pen className="w-[14px] h-[14px] text-white" strokeWidth={1.17} />
                  </button>
                </div>

                {/* Name + MSSV + Change Photo link — Figma: VERTICAL */}
                <div className="flex flex-col">
                  <h3 className="font-sans font-bold text-[#111827] text-[20px] leading-[28px]">
                    {student.name}
                  </h3>
                  <p className="font-sans font-medium text-[#6b7280] text-[14px] leading-[20px]">
                    MSSV: {student.id}
                  </p>
                  {/* Change photo button — Figma: font Roboto 600 12px, color #135bec */}
                  <button className="mt-[7.5px] text-left cursor-pointer hover:underline">
                    <span className="font-sans font-semibold text-[#135bec] text-[12px] leading-[18px]">
                      Thay đổi ảnh chân dung
                    </span>
                  </button>
                </div>
              </motion.div>

              {/* ── Personal Information Section ── Figma: 481x271, VERTICAL, gap 24, pad 24, radius 24 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-[#f9fafb] flex flex-col gap-[24px] p-[24px] rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full"
              >
                {/* Section Header — Figma: HORIZONTAL, SPACE_BETWEEN */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-[8px]">
                    <div className="bg-[#135bec] h-[24px] w-[6px] rounded-[9999px]" />
                    <h2 className="font-sans font-bold text-[#1f2937] text-[18px] tracking-[-0.45px] leading-[28px]">
                      Thông tin cá nhân
                    </h2>
                  </div>
                  {/* Edit button icon — Figma: 31x31, pad 8, radius 9999 */}
                  <button className="w-[31px] h-[31px] flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors cursor-pointer">
                    <Settings className="w-[15px] h-[15px] text-[#9ca3af]" />
                  </button>
                </div>
                
                {/* Info rows — Figma: VERTICAL, gap 15.8 */}
                <div className="flex flex-col gap-[16px] w-full">
                  {personalInfoRows.map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between w-full">
                      <span className="font-sans font-medium text-[#6b7280] text-[13px] leading-[20px]">
                        {row.label}
                      </span>
                      <span className="font-sans font-bold text-[#1f2937] text-[14px] leading-[21px]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Academic Information Section ── Figma: 481x198, VERTICAL, gap 24, pad 24, radius 24 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-[#f9fafb] flex flex-col gap-[24px] p-[24px] rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-full"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-[8px]">
                    <div className="bg-[#135bec] h-[24px] w-[6px] rounded-[9999px]" />
                    <h2 className="font-sans font-bold text-[#1f2937] text-[18px] tracking-[-0.45px] leading-[28px]">
                      Thông tin học tập
                    </h2>
                  </div>
                  <button className="w-[31px] h-[31px] flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors cursor-pointer">
                    <Settings className="w-[15px] h-[15px] text-[#9ca3af]" />
                  </button>
                </div>
                
                {/* Info rows — Figma: VERTICAL, gap 15.8 */}
                <div className="flex flex-col gap-[16px] w-full">
                  {academicInfoRows.map((row, idx) => (
                    <div key={idx} className="flex items-center justify-between w-full">
                      <span className="font-sans font-medium text-[#6b7280] text-[13px] leading-[20px]">
                        {row.label}
                      </span>
                      <span className="font-sans font-bold text-[#1f2937] text-[14px] leading-[21px]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>

            {/* ═══ RIGHT COLUMN ═══ Figma: 687px, VERTICAL, gap 24 */}
            <div className="flex flex-col gap-[24px]">
              
              {/* ── Summary Stats Cards ── Figma: 687x80, CSS GRID 3 cols, each 218x80 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3, delay: 0.15 }}
                className="grid grid-cols-3 gap-[16px] w-full"
              >
                {/* Card 1 — Điểm rèn luyện */}
                <div className="bg-[#eff6ff] flex gap-[12px] items-center p-[20px] rounded-[16px] h-[80px]">
                  <div className="bg-white flex items-center justify-center rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-[40px] h-[40px] shrink-0">
                    <ShieldCheck className="w-[20px] h-[20px] text-blue-500" strokeWidth={1.67} />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-sans font-bold text-[#2563eb] text-[10px] tracking-[0.5px] uppercase leading-[15px]">Điểm rèn luyện</p>
                    <p className="font-sans font-bold text-[#1e3a8a] text-[20px] leading-[25px]">85/100</p>
                  </div>
                </div>

                {/* Card 2 — Điểm thưởng */}
                <div className="bg-[#f0fdf4] flex gap-[12px] items-center p-[20px] rounded-[16px] h-[80px]">
                  <div className="bg-white flex items-center justify-center rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-[40px] h-[40px] shrink-0">
                    <Star className="w-[20px] h-[20px] text-green-500" strokeWidth={1.67} />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-sans font-bold text-[#16a34a] text-[10px] tracking-[0.5px] uppercase leading-[15px]">Điểm thưởng</p>
                    <p className="font-sans font-bold text-[#14532d] text-[20px] leading-[25px]">+10</p>
                  </div>
                </div>

                {/* Card 3 — Vi phạm */}
                <div className="bg-[#fef2f2] flex gap-[12px] items-center p-[20px] rounded-[16px] h-[80px]">
                  <div className="bg-white flex items-center justify-center rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] w-[40px] h-[40px] shrink-0">
                    <MinusCircle className="w-[20px] h-[20px] text-red-500" strokeWidth={1.67} />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-sans font-bold text-[#dc2626] text-[10px] tracking-[0.5px] uppercase leading-[15px]">Vi phạm</p>
                    <p className="font-sans font-bold text-[#7f1d1d] text-[20px] leading-[25px]">-10</p>
                  </div>
                </div>
              </motion.div>

              {/* ── Records History Container ── Figma: 687x722, VERTICAL, bg #f9fafb, radius 24 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3, delay: 0.25 }}
                className="bg-[#f9fafb] flex flex-col rounded-[24px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden w-full h-[722px]"
              >
                {/* ─ Tabs & Actions Header ─ Figma: 687x71, pad 32 32 0 32, border-bottom */}
                <div className="border-b border-[#f3f4f6] px-[32px] pt-[32px] w-full shrink-0">
                  <div className="flex items-center gap-[24px]">
                    {/* Tab 1: Danh mục — Figma: Lexend 500 14px active #135bec, border-bottom 1px when active */}
                    <button 
                      onClick={() => handleTabChange('category')}
                      className={`pb-[16px] border-b transition-colors cursor-pointer ${
                        activeTab === 'category' 
                          ? 'border-[#135bec]' 
                          : 'border-transparent'
                      }`}
                    >
                      <span className={`font-sans text-[14px] leading-[20px] font-bold ${
                        activeTab === 'category'
                          ? 'text-[#135bec]'
                          : 'text-[#595959]'
                      }`}>
                        Danh mục
                      </span>
                    </button>
                    {/* Tab 2: Lịch sử ghi nhận — Figma: Lexend 700 14px inactive #595959 */}
                    <button 
                      onClick={() => handleTabChange('history')}
                      className={`pb-[16px] border-b transition-colors cursor-pointer ${
                        activeTab === 'history' 
                          ? 'border-[#135bec]' 
                          : 'border-transparent'
                      }`}
                    >
                      <span className={`font-sans text-[14px] leading-[20px] font-bold ${
                        activeTab === 'history'
                          ? 'text-[#135bec]'
                          : 'text-[#595959]'
                      }`}>
                        Lịch sử ghi nhận
                      </span>
                    </button>
                  </div>
                </div>

                {/* ─ Content Area ─ */}
                <div 
                  className="flex flex-col gap-[16px] px-[24px] pt-[24px] pb-[24px] w-full flex-1 min-h-0 overflow-y-auto"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#d1d5db transparent',
                  }}
                >
                  {isTabLoading ? (
                    <div className="flex flex-col gap-[16px] w-full">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="w-full h-[100px] rounded-[16px]" />
                      ))}
                    </div>
                  ) : activeTab === 'category' ? (
                    /* ─── Category List ─── Figma: VERTICAL, gap 16, pad 24 */
                    mockCategories.map((cat, idx) => (
                      <motion.div 
                        key={cat.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.3 + idx * 0.08 }}
                        className="bg-white border border-[#f1f5f9] rounded-[12px] w-full  shadow-[0px_1px_2px_0px_rgba(0,0,0,0.02)]"
                      >
                        {/* Card Header — Figma: HORIZONTAL, SPACE_BETWEEN, pad 20 */}
                        <div 
                          className="flex items-center justify-between px-[20px] pt-[20px] pb-[20px] cursor-pointer hover:bg-slate-50/50 transition-colors"
                          onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                        >
                          <div className="flex items-center gap-[8px]">
                            {/* Title — Figma: Lexend 700 16px #111827 */}
                            <h4 className="font-sans font-bold text-[#111827] text-[16px] leading-[24px]">
                              {cat.title}
                            </h4>
                            {/* Chevron — Figma: 10x6, color #9ca3af */}
                            <ChevronDown className={`w-[10px] h-[6px] text-[#9ca3af] transition-transform duration-300 ${expandedCategory === cat.id ? 'rotate-180' : ''}`} />
                          </div>
                          {/* Badge — Figma: bg #eff6ff, radius 9999, border 1px, pad 4 10, Lexend 700 11px #1d4ed8 */}
                          <div className="bg-[#eff6ff] border border-[#bfdbfe] px-[10px] py-[4px] rounded-[9999px] shrink-0">
                            <span className="font-sans font-bold text-[#1d4ed8] text-[11px] tracking-[0.275px]">
                              Tối đa: {cat.maxPoints}đ
                            </span>
                          </div>
                        </div>
                        {/* Description — ALWAYS VISIBLE (Figma: gap 7.375 from header, Lexend 400 14px #6b7280) */}
                        <div className="px-[20px] pb-[20px]">
                          <p className="font-sans font-normal text-[#6b7280] text-[14px] leading-[23px]">
                            {cat.description}
                          </p>
                        </div>
                        {/* Accordion Details → List — TOGGLE (Figma: VERTICAL, gap 8, padTop 20.6, border-top 1px) */}
                        <motion.div 
                          initial={false}
                          animate={{ 
                            height: expandedCategory === cat.id ? 'auto' : 0, 
                            opacity: expandedCategory === cat.id ? 1 : 0 
                          }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-[8px] px-[20px] pb-[20px] pt-[20px] border-t border-[#f1f5f9]">
                            {cat.items.map((item, itemIdx) => (
                              <div 
                                key={itemIdx}
                                className="flex items-center justify-between px-[16px] py-[12px] bg-[#f9fafb] rounded-[8px] border border-[#f1f5f9]"
                              >
                                <span className="font-sans font-medium text-[#4b5563] text-[14px] leading-[20px]">
                                  {item.label}
                                </span>
                                <span className="font-sans font-bold text-[#2563eb] text-[14px] leading-[20px]">
                                  {item.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </motion.div>
                    ))
                  ) : (
                    /* ─── History List ─── Figma: Node 316:1314 */
                    mockRecords.map((record, idx) => (
                      <motion.div 
                        key={record.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.3 + idx * 0.08 }}
                        className="bg-white border border-[#f1f5f9] flex items-center justify-between p-[20px] rounded-[16px] w-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.02)]"
                      >
                        <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                          {/* Row 1: Title + Badge — Figma: HORIZONTAL, gap 12 */}
                          <div className="flex items-center gap-[12px]">
                            <h4 className="font-sans font-bold text-[#111827] text-[16px] leading-[24px] truncate">
                              {record.title}
                            </h4>
                            <div className={`px-[10px] py-[2px] rounded-full border shrink-0 ${
                              record.type === 'reward' 
                                ? 'bg-[#f0fdf4] border-[#dcfce7]' 
                                : 'bg-[#fef2f2] border-[#fee2e2]'
                            }`}>
                              <span className={`font-sans font-bold text-[10px] ${
                                record.type === 'reward' ? 'text-[#15803d]' : 'text-[#b91c1c]'
                              }`}>
                                {record.label}
                              </span>
                            </div>
                          </div>
                          
                          {/* Row 2: Metadata — Figma: HORIZONTAL, gap 24, Lexend 500 12px */}
                          <div className="flex items-center gap-[24px]">
                            <div className="flex items-center gap-[6px]">
                              <Calendar className="w-[12px] h-[12px] text-[#6b7280]" />
                              <span className="font-sans font-medium text-[#6b7280] text-[12px]">
                                {record.date}
                              </span>
                            </div>
                            <span className="font-sans font-medium text-[#6b7280] text-[12px]">
                              Số lần: {record.count}
                            </span>
                            <span className="font-sans font-medium text-[#6b7280] text-[12px]">
                              Buổi: {record.session}
                            </span>
                          </div>
                        </div>

                        {/* Points Display — Figma: VERTICAL, gap 2, text-right */}
                        <div className="flex flex-col items-end gap-[2px] shrink-0 ml-4">
                          <span className="font-sans font-bold text-[#9ca3af] text-[10px] leading-[15px] uppercase">
                            Điểm
                          </span>
                          <span className={`font-sans font-bold text-[14px] leading-[20px] ${
                            record.type === 'reward' ? 'text-[#16a34a]' : 'text-[#dc2626]'
                          }`}>
                            {record.points}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* ─ Footer Note ─ Figma: 687x65, pad 24, bg #f9fafb, border-top, Lexend 500 12px #9ca3af */}
                <div className="bg-[#f9fafb] border-t border-[#f3f4f6] px-[24px] py-[24px] w-full shrink-0">
                  <div className="flex justify-center">
                    <span className="font-['Lexend',sans-serif] font-medium text-[#9ca3af] text-[12px]">
                      {activeTab === 'category' 
                        ? 'Danh sách các danh mục đánh giá điểm rèn luyện năm học 2024-2025.' 
                        : 'Hiển thị 3 bản ghi khen thưởng gần nhất. Xem toàn bộ lịch sử trong báo cáo chi tiết.'}
                    </span>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
