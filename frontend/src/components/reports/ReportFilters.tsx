'use client';

import React, { useState } from 'react';
import { Search, Calendar, RefreshCcw } from 'lucide-react';
import { Semester } from '@/api/semester-api';
import { Department } from '@/api/department-api';
import { Class } from '@/api/class-api';
import { ReportFilterState } from './report-types';
import { format } from 'date-fns';

// UI components from project library
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';

interface ReportFiltersProps {
  semesters: Semester[];
  departments: Department[];
  classes: Class[];
  filters: ReportFilterState;
  onChange: (filters: ReportFilterState) => void;
}

export default function ReportFilters({
  semesters,
  departments,
  classes,
  filters,
  onChange
}: ReportFiltersProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Filter classes based on selected department
  const filteredClasses = classes.filter(c => {
    if (!filters.departmentId) return true;
    const deptId = typeof c.dept_id === 'object' ? (c.dept_id as any)?._id : c.dept_id;
    return deptId === filters.departmentId;
  });

  const handleSelectChange = (field: keyof ReportFilterState, value: string) => {
    const nextFilters = { ...filters, [field]: value };
    // Reset class filter if department changes
    if (field === 'departmentId') {
      nextFilters.classId = '';
    }
    onChange(nextFilters);
  };

  const handleResetFilters = () => {
    onChange({
      semesterId: semesters.find(s => s.status === 'active')?._id || '',
      evaluationPeriodId: '',
      departmentId: '',
      classId: '',
      startDate: '',
      endDate: '',
      searchQuery: '',
      status: ''
    });
  };

  // Date label formatting helper
  const getDateLabel = () => {
    if (!filters.startDate) return 'Tất cả khoảng ngày';
    try {
      const start = new Date(filters.startDate);
      const startStr = format(start, 'dd/MM/yyyy');
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        return `${startStr} - ${format(end, 'dd/MM/yyyy')}`;
      }
      return `Từ ${startStr}`;
    } catch {
      return 'Chọn khoảng ngày';
    }
  };

  return (
    <div className="mx-6 mt-6 p-5 bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[#1E293B] uppercase tracking-wider">Bộ lọc dữ liệu</h3>
        <button
          onClick={handleResetFilters}
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#1A73E8] hover:text-[#1A73E8]/80 cursor-pointer"
        >
          <RefreshCcw size={12} />
          <span>Đặt lại</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Semester */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#64748B]">Học kỳ</label>
          <Select 
            value={filters.semesterId} 
            onValueChange={(val: string) => handleSelectChange('semesterId', val === 'all' ? '' : val)}
          >
            <SelectTrigger className="h-9 text-[13px] font-semibold text-[#1E293B] bg-white/50 border-white/70 rounded-xl">
              <SelectValue placeholder="Tất cả học kỳ" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100] min-w-full">
              <SelectItem value="all">Tất cả học kỳ</SelectItem>
              {semesters.map((sem) => (
                <SelectItem key={sem._id} value={sem._id}>
                  {sem.semester_name} {sem.status === 'active' ? '(Hiện tại)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#64748B]">Khoa / Ban</label>
          <Select 
            value={filters.departmentId} 
            onValueChange={(val: string) => handleSelectChange('departmentId', val === 'all' ? '' : val)}
          >
            <SelectTrigger className="h-9 text-[13px] font-semibold text-[#1E293B] bg-white/50 border-white/70 rounded-xl">
              <SelectValue placeholder="Tất cả khoa" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100] min-w-full">
              <SelectItem value="all">Tất cả khoa</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept._id} value={dept._id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Class */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#64748B]">Lớp học</label>
          <Select 
            value={filters.classId} 
            onValueChange={(val: string) => handleSelectChange('classId', val === 'all' ? '' : val)}
          >
            <SelectTrigger className="h-9 text-[13px] font-semibold text-[#1E293B] bg-white/50 border-white/70 rounded-xl">
              <SelectValue placeholder="Tất cả lớp" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100] min-w-full">
              <SelectItem value="all">Tất cả lớp</SelectItem>
              {filteredClasses.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.class_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#64748B]">Trạng thái sinh viên</label>
          <Select 
            value={filters.status} 
            onValueChange={(val: string) => handleSelectChange('status', val === 'all' ? '' : val)}
          >
            <SelectTrigger className="h-9 text-[13px] font-semibold text-[#1E293B] bg-white/50 border-white/70 rounded-xl">
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100] min-w-full">
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="Studying">Đang học</SelectItem>
              <SelectItem value="Reserved">Bảo lưu</SelectItem>
              <SelectItem value="Dropped">Thôi học</SelectItem>
              <SelectItem value="Graduated">Tốt nghiệp</SelectItem>
              <SelectItem value="Suspended">Đình chỉ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Picker (CustomCalendar + Popover) */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-[#64748B]">Khoảng ngày</label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button 
                type="button" 
                className="flex items-center justify-between w-full h-9 bg-white/50 border border-white/70 rounded-xl px-3 text-[13px] font-semibold text-[#1E293B] cursor-pointer outline-none hover:bg-white/70 transition-all"
              >
                <span className="truncate mr-1">{getDateLabel()}</span>
                <Calendar size={14} className="text-[#64748B] shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 border-none bg-transparent shadow-none z-[100] overflow-hidden" align="start">
              <CustomCalendar
                startDate={filters.startDate ? new Date(filters.startDate) : null}
                endDate={filters.endDate ? new Date(filters.endDate) : null}
                onRangeSelect={(start, end) => {
                  onChange({
                    ...filters,
                    startDate: start ? start.toISOString().split('T')[0] : '',
                    endDate: end ? end.toISOString().split('T')[0] : ''
                  });
                }}
                onCancel={() => setIsCalendarOpen(false)}
                onConfirm={() => setIsCalendarOpen(false)}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="relative mt-2">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]">
          <Search size={15} />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm theo tên sinh viên, mã số, email, tiêu đề ghi nhận..."
          value={filters.searchQuery}
          onChange={(e) => handleSelectChange('searchQuery', e.target.value)}
          className="w-full bg-white/50 backdrop-blur-sm border border-white/70 focus:border-[#1A73E8]/50 focus:ring-4 focus:ring-[#1A73E8]/10 rounded-xl pl-9 pr-4 py-2 text-[13px] font-semibold text-[#1E293B] outline-none transition-all placeholder-[#64748B]"
        />
      </div>
    </div>
  );
}
