'use client';
import React, { useState, useEffect } from 'react';
import { Search, Plus, Calendar as CalendarIcon, Settings, MoreHorizontal, X, Edit, Trash2, ChevronUp, ChevronDown, CheckSquare, Check } from 'lucide-react';
import { DUMMY_RECORDS, RecordItem, MOCK_HISTORY } from '../../lib/mock-data/ghinhan';
import { CustomPagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { format } from 'date-fns';
import AddRecordView from './AddRecordView';

export default function GhiNhanTab() {
  const [currentView, setCurrentView] = useState<'list' | 'add'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [filterDateRange, setFilterDateRange] = useState<{ start: Date, end: Date } | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSelectingHistory, setIsSelectingHistory] = useState(false);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<number[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'class' | 'student'>('student');
  const itemsPerPage = 20;

  const toggleExpandCard = (index: number) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredRecords = DUMMY_RECORDS.filter(record => {
    const matchesSearch = record.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.studentId.includes(searchTerm);

    let matchesDate = true;
    if (filterDateRange && filterDateRange.start && filterDateRange.end) {
      try {
        const parts = record.date.split('/');
        if (parts.length === 3) {
          const rDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          const sDate = new Date(filterDateRange.start.getFullYear(), filterDateRange.start.getMonth(), filterDateRange.start.getDate()).getTime();
          const eDate = new Date(filterDateRange.end.getFullYear(), filterDateRange.end.getMonth(), filterDateRange.end.getDate()).getTime();
          matchesDate = rDate >= sDate && rDate <= eDate;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return matchesSearch && matchesDate;
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedRecords.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDelete = () => {
    toast.success(`Đã xóa ${selectedIds.length} ghi nhận thành công.`);
    setSelectedIds([]); // Demo action specific clearing
  };

  const handleCreate = () => {
    setCurrentView('add');
  };

  const handleEdit = (recordId: string) => {
    toast.info(`Chỉnh sửa ghi nhận có mã: ${recordId}`);
  };

  if (currentView === 'add') {
    return (
      <motion.div
        key="add-record"
        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
        className="flex-1 w-full h-full relative"
      >
        <AddRecordView onBack={() => setCurrentView('list')} />
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Tab điều hướng dạng Pill Shape Glassmorphic (DESIGN.md) */}
          <div className="flex bg-gray-100/80 border border-gray-200/15 rounded-full p-1 gap-1.5 shrink-0 shadow-sm self-start sm:self-auto">
            <button
              onClick={() => setActiveSubTab('student')}
              className={`px-5 py-1.5 font-bold text-[12.5px] transition-all rounded-full cursor-pointer whitespace-nowrap ${activeSubTab === 'student'
                ? 'bg-white text-[#1A73E8] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              Tình hình HSSV
            </button>
            <button
              onClick={() => setActiveSubTab('class')}
              className={`px-5 py-1.5 font-bold text-[12.5px] transition-all rounded-full cursor-pointer whitespace-nowrap ${activeSubTab === 'class'
                ? 'bg-white text-[#1A73E8] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              Tình hình lớp học
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-400"
            />
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100 whitespace-nowrap"
            >
              Xoá ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 w-full lg:w-auto">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap ${filterDateRange ? 'border-blue-400 bg-blue-50/50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                <CalendarIcon className={`w-4 h-4 ${filterDateRange ? 'text-blue-500' : 'text-gray-500'}`} />
                <span className="hidden sm:inline">{filterDateRange ? `${format(filterDateRange.start, 'dd/MM')} - ${format(filterDateRange.end, 'dd/MM')}` : 'Chọn khoảng ngày'}</span>
                <span className="sm:hidden">{filterDateRange ? 'Đã lọc' : 'Lọc'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 z-[100] bg-transparent border-none shadow-none"
              align="end"
              side="bottom"
              sideOffset={6}
            >
              <CustomCalendar
                startDate={filterDateRange?.start || null}
                endDate={filterDateRange?.end || null}
                onRangeSelect={(start, end) => setFilterDateRange({ start, end })}
                onCancel={() => { setFilterDateRange(null); setIsCalendarOpen(false); }}
                onConfirm={() => setIsCalendarOpen(false)}
              />
            </PopoverContent>
          </Popover>
          <button className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm ghi nhận</span>
            <span className="sm:hidden">Thêm</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="bg-[#F8FAFB] sticky top-0 z-10 shadow-sm shadow-gray-100/50">
            <tr>
              <th className="px-5 py-3 w-12 text-center border-b border-gray-100">
                <input
                  type="checkbox"
                  checked={paginatedRecords.length > 0 && selectedIds.length === paginatedRecords.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Mã SV</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Họ và tên</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Lớp</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Loại ghi nhận</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Tiêu chí</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Ngày ghi nhận</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Tính điểm</th>
              <th className="px-5 py-3 w-16 text-center text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: itemsPerPage }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4 border-b border-gray-50 text-center"><Skeleton className="w-4 h-4 rounded mx-auto" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-20 h-4" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-32 h-4" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-24 h-4" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-24 h-6 rounded-full" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-40 h-4" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-24 h-4" /></td>
                  <td className="px-5 py-4 border-b border-gray-50"><Skeleton className="w-10 h-4" /></td>
                  <td className="px-5 py-4 border-b border-gray-50 text-center"><Skeleton className="w-6 h-6 rounded-md mx-auto" /></td>
                </tr>
              ))
            ) : (
              paginatedRecords.map((record, idx) => {
                const isKhenThuong = record.recordType === 'Khen thưởng';
                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1, delay: idx * 0.05 }}
                    key={record.id} className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-5 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-600">
                      {record.studentId}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-800">
                      {record.fullName}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                      {record.className}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${isKhenThuong
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                        : 'bg-rose-50 text-rose-600 border-rose-100/50'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isKhenThuong ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {record.recordType}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-700 max-w-[220px] truncate" title={record.criteria || 'Chưa có'}>
                      {record.criteria || 'Chưa có'}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-600">
                      {record.date}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-bold ${isKhenThuong ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {record.points}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Drawer
                        direction="right"
                        open={openDrawerId === record.id}
                        onOpenChange={(isOpen) => {
                          setOpenDrawerId(isOpen ? record.id : null);
                          if (!isOpen) {
                            setIsSelectingHistory(false);
                            setSelectedHistoryItems([]);
                          }
                        }}
                      >
                        <DrawerTrigger asChild>
                          <button
                            className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors shadow-sm"
                            title="Chi tiết trạng thái"
                          >
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        </DrawerTrigger>

                        <DrawerContent className="w-[450px] sm:max-w-md h-full bg-white border-l border-gray-100 flex flex-col items-stretch outline-none overflow-hidden">
                          {/* Modal Header */}
                          <div className="flex justify-between items-center py-[17px] px-6 border-b border-gray-100 bg-white shrink-0">
                            <DrawerTitle className="text-base font-bold text-slate-900">Chi tiết trạng thái</DrawerTitle>
                            <DrawerDescription className="sr-only">Lịch sử và trạng thái chi tiết của bản ghi.</DrawerDescription>
                            <DrawerClose asChild>
                              <button className="w-6 h-6 flex justify-center items-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </DrawerClose>
                          </div>

                          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                            {/* Profile overview */}
                            <div className="flex items-center gap-4">
                              <div className="w-[60px] h-[60px] rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${record.studentId}&backgroundColor=b6e3f4`} alt="Avatar" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col items-start min-w-0">
                                <h2 className="text-[18px] font-bold text-slate-900 leading-snug truncate w-full">{record.fullName}</h2>
                                <p className="text-[12px] font-medium text-slate-500 truncate w-full">Mã SV: {record.studentId} • Lớp {record.className}</p>
                              </div>
                            </div>

                            {/* Summary blocks */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Khen thưởng</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-emerald-600 leading-none">12</span>
                                  <span className="text-[11px] font-semibold text-emerald-500">lần</span>
                                </div>
                              </div>
                              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex flex-col">
                                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1.5">Kỷ luật</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-rose-600 leading-none">03</span>
                                  <span className="text-[11px] font-semibold text-rose-500">lần</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col pb-4">
                              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Ghi nhận gần đây</h4>

                              <div className="flex flex-col relative before:content-[''] before:absolute before:left-3 before:top-4 before:h-[calc(100%-1.5rem)] before:w-[1px] before:bg-slate-100 ml-1">
                                {MOCK_HISTORY.map((hist, i) => {
                                  const isKyLuat = hist.type === 'Kỷ luật';
                                  const isExpanded = expandedCards[i];

                                  return (
                                    <div key={i} className="flex gap-4 relative mb-6 last:mb-0">
                                      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 z-10">
                                        {isSelectingHistory ? (
                                          <div
                                            className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${selectedHistoryItems.includes(i) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-slate-50 hover:border-blue-400'}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedHistoryItems(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
                                            }}
                                          >
                                            {selectedHistoryItems.includes(i) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                          </div>
                                        ) : (
                                          <div className={`w-3.5 h-3.5 rounded-full ${isKyLuat ? 'bg-rose-500 shadow-rose-200' : 'bg-emerald-500 shadow-emerald-200'} shadow-sm border-2 border-white box-content`} />
                                        )}
                                      </div>

                                      <div className="flex-1 flex flex-col pt-0.5">
                                        <div
                                          className="flex justify-between items-start cursor-pointer group"
                                          onClick={() => toggleExpandCard(i)}
                                        >
                                          <div className="flex flex-col gap-1 pr-4">
                                            <span className="text-[11px] font-bold text-slate-500">{hist.date}</span>
                                            <span className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">{hist.title}</span>
                                            <div className="mt-0.5">
                                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isKyLuat ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {hist.type}
                                              </span>
                                            </div>
                                          </div>
                                          <button className="p-1 rounded text-slate-400 group-hover:text-blue-600 mt-1">
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                          </button>
                                        </div>

                                        <AnimatePresence>
                                          {isExpanded && hist.description && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                              animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                                                <div className="grid grid-cols-2 gap-4">
                                                  <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tiêu chí</span>
                                                    <span className="text-[12px] font-semibold text-slate-900">{hist.criteria}</span>
                                                  </div>
                                                  <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Danh mục</span>
                                                    <span className="text-[12px] font-semibold text-slate-900">{hist.category}</span>
                                                  </div>
                                                  <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Buổi</span>
                                                    <span className="text-[12px] font-semibold text-slate-900">{hist.shift}</span>
                                                  </div>
                                                  <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ngày ghi</span>
                                                    <span className="text-[12px] font-semibold text-slate-900">{hist.logDate}</span>
                                                  </div>
                                                </div>
                                                <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-1 mt-1">
                                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mô tả</span>
                                                  <p className="text-[12px] font-medium text-slate-600 leading-relaxed">
                                                    "{hist.description}"
                                                  </p>
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Modal Footer actions */}
                          <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.02)] shrink-0 flex items-center justify-between gap-3">
                            {isSelectingHistory ? (
                              <>
                                <button
                                  onClick={() => {
                                    setIsSelectingHistory(false);
                                    setSelectedHistoryItems([]);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedHistoryItems.length > 0) {
                                      toast.success(`Đã xóa ${selectedHistoryItems.length} ghi nhận!`);
                                      setIsSelectingHistory(false);
                                      setSelectedHistoryItems([]);
                                    }
                                  }}
                                  disabled={selectedHistoryItems.length === 0}
                                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-rose-50 border border-rose-100 text-[13px] font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-500" />
                                  Xóa ({selectedHistoryItems.length})
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm">
                                  <Edit className="w-4 h-4 text-slate-600" />
                                  Sửa ghi nhận
                                </button>
                                <button
                                  onClick={() => setIsSelectingHistory(true)}
                                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
                                >
                                  <CheckSquare className="w-4 h-4 text-slate-600" />
                                  Chọn
                                </button>
                              </>
                            )}
                          </div>
                        </DrawerContent>
                      </Drawer>
                    </td>
                  </motion.tr>
                );
              })
            )}

            {paginatedRecords.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-sm text-gray-500 bg-gray-50/50">
                  Không tìm thấy ghi nhận nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {filteredRecords.length > 0 && (
        <CustomPagination
          currentPage={currentPage}
          pageSize={itemsPerPage}
          totalItems={filteredRecords.length}
          onPageChange={(page) => {
            setIsLoading(true);
            setCurrentPage(page);
            setTimeout(() => setIsLoading(false), 400);
          }}
          label="ghi nhận"
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
