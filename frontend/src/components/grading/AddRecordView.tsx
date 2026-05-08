'use client';
import React, { useState } from 'react';
import { 
  Camera, Plus, Settings, Calendar as CalendarIcon, Search, ArrowLeft, Image as ImageIcon, Loader2, UserPlus, Trash2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { 
  MOCK_OCR_STUDENTS, MOCK_RECORD_CATEGORIES, MOCK_LOCATIONS, 
  MOCK_VIOLATION_TYPES, MOCK_CRITERIA, OCRStudent 
} from '../../lib/mock-data/add-record';

export default function AddRecordView({ onBack }: { onBack: () => void }) {
  const [students, setStudents] = useState<OCRStudent[]>(MOCK_OCR_STUDENTS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [studentInput, setStudentInput] = useState('');
  const [manualStudents, setManualStudents] = useState<string[]>([]);
  const [manualNote, setManualNote] = useState('');

  // Form states
  const [recordType, setRecordType] = useState('violation');
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [shift, setShift] = useState<'Sáng' | 'Chiều'>('Sáng');
  const [isCulturalClass, setIsCulturalClass] = useState(false);
  const [violationCategory, setViolationCategory] = useState('');
  const [selectedCriteria, setSelectedCriteria] = useState<string>('');
  
  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Đã ghi nhận tất cả thành công!");
      onBack();
    }, 1500);
  };

  const simulateProcessing = () => {
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full bg-[#f8fafc] font-sans w-full overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-4 max-w-[1400px] mx-auto">
          {/* LEFT COLUMN: Upload & Config */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            
            {/* Upload Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button 
                  onClick={onBack}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại
                </button>
                <h2 className="text-[18px] font-bold text-slate-900">Tải lên hình ảnh</h2>
              </div>

              <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl h-[130px] flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={simulateProcessing}>
                <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-[12px] text-slate-500 text-center max-w-[200px]">
                  Kéo thả hoặc nhấp để tải lên nhiều ảnh minh chứng (JPG, PNG)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50/50 border border-blue-100 rounded-lg text-blue-600 text-[12px] font-bold hover:bg-blue-100 transition-colors">
                  <Camera className="w-4 h-4" />
                  Máy ảnh
                </button>
                <button className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 rounded-lg text-white text-[12px] font-bold shadow-sm hover:bg-blue-700 transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  Thư viện
                </button>
              </div>
            </div>

            {/* Config Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-6 flex flex-col gap-5">
              <h2 className="text-[18px] font-bold text-slate-900 leading-none">Cấu hình ghi nhận</h2>

              {/* Loại */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Loại ghi nhận</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setRecordType('violation')}
                    className={`h-9 text-[12px] font-medium rounded-lg flex items-center justify-center transition-colors ${recordType === 'violation' ? 'bg-rose-50 border border-rose-200 text-rose-600' : 'border border-slate-200 text-slate-900 hover:bg-slate-50'}`}
                  >
                    Vi phạm
                  </button>
                  <button 
                    onClick={() => setRecordType('reward')}
                    className={`h-9 text-[12px] font-medium rounded-lg flex items-center justify-center transition-colors ${recordType === 'reward' ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'border border-slate-200 text-slate-900 hover:bg-slate-50'}`}
                  >
                    Khen thưởng
                  </button>
                </div>
              </div>

              {/* Ngày */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ngày ghi nhận</label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button className="h-11 border border-slate-100 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center px-4 justify-between transition-colors">
                      <span className="text-[14px] text-slate-900">{format(recordDate, 'dd/MM/yyyy')}</span>
                      <CalendarIcon className="w-[18px] h-[18px] text-slate-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100] bg-transparent border-none shadow-none" align="start">
                    <CustomCalendar 
                      startDate={recordDate}
                      endDate={null}
                      onRangeSelect={(start) => { if(start) setRecordDate(start); }}
                      onCancel={() => setIsCalendarOpen(false)}
                      onConfirm={() => setIsCalendarOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Buổi */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Buổi</label>
                <Select value={shift} onValueChange={(v: any) => setShift(v)}>
                  <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl text-[14px] text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-lg border-slate-100">
                    <SelectItem value="Sáng">Sáng</SelectItem>
                    <SelectItem value="Chiều">Chiều</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Danh mục */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Danh mục</label>
                <Select value={violationCategory} onValueChange={setViolationCategory}>
                  <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl text-[14px] text-slate-900">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-lg border-slate-100">
                    <SelectItem value="uniform">Đồng phục</SelectItem>
                    <SelectItem value="behavior">Tác phong</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tiêu chí */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tiêu chí cụ thể</label>
                <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
                  <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl text-[14px] text-slate-900">
                    <SelectValue placeholder="Chọn tiêu chí cụ thể..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-xl shadow-lg border-slate-100">
                    {MOCK_CRITERIA.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Lớp văn hoá */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">Lớp văn hoá</span>
                  <button 
                    onClick={() => setIsCulturalClass(!isCulturalClass)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none shadow-sm ${isCulturalClass ? 'bg-blue-600 border border-blue-600' : 'bg-slate-200 border border-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-300 ${isCulturalClass ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT COLUMN: Results */}
          <div className="col-span-12 lg:col-span-8 flex flex-col max-h-[calc(100vh-64px)] overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="p-3 pb-2 border-b border-slate-50 flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] font-bold text-slate-900">Kết quả nhận diện AI</h2>
                <p className="text-[14px] text-slate-500">Tự động nhận diện thông tin từ ảnh tải lên</p>
              </div>
              
              {isProcessing && (
                <div className="bg-emerald-50 rounded-full px-4 py-1.5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span className="text-[12px] font-semibold text-emerald-500 tracking-wide uppercase">Đang xử lý dữ liệu...</span>
                </div>
              )}
            </div>

            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <AnimatePresence mode="wait">
                {!showManualAdd ? (
                  <motion.button 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowManualAdd(true)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl h-[60px] text-slate-500 text-[14px] font-bold hover:bg-slate-50 hover:text-slate-600 transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Thêm sinh viên thủ công
                  </motion.button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-white border-2 border-slate-200 border-dashed rounded-xl p-5 flex flex-col gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden shrink-0"
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-[14px] mb-1">
                      <UserPlus className="w-4 h-4 text-blue-600" /> Thêm sinh viên thủ công
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Khoa</label>
                        <Select>
                          <SelectTrigger className="h-[36px] bg-[#f8fafc] border-transparent rounded-lg text-[12px] text-slate-900 shadow-none">
                            <SelectValue placeholder="Chọn Khoa..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white rounded-lg shadow-lg border-slate-100 text-[12px]">
                            <SelectItem value="cntt">Công nghệ TT</SelectItem>
                            <SelectItem value="dt">Điện tử VT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Lớp</label>
                        <Select>
                          <SelectTrigger className="h-[36px] bg-[#f8fafc] border-transparent rounded-lg text-[12px] text-slate-900 shadow-none">
                            <SelectValue placeholder="Chọn Lớp..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white rounded-lg shadow-lg border-slate-100 text-[12px]">
                            <SelectItem value="d20">D20_TH01</SelectItem>
                            <SelectItem value="d21">D21_QT02</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sinh viên (nhấn enter để thêm)</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input 
                          type="text"
                          value={studentInput}
                          onChange={e => setStudentInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && studentInput.trim()) {
                              if (!manualStudents.includes(studentInput.trim())) {
                                setManualStudents([...manualStudents, studentInput.trim()]);
                              }
                              setStudentInput('');
                            }
                          }}
                          placeholder="Tìm theo tên hoặc MSSV..."
                          className="w-full h-[36px] bg-[#f8fafc] border border-transparent focus:border-blue-400 focus:bg-white rounded-lg pl-8 pr-3 text-[12px] text-slate-900 placeholder:text-slate-500 outline-none transition-colors"
                        />
                      </div>
                      {manualStudents.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          <AnimatePresence>
                            {manualStudents.map(student => (
                              <motion.div
                                key={student}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-100 text-[11.5px] font-semibold"
                              >
                                {student}
                                <button 
                                  onClick={() => setManualStudents(prev => prev.filter(s => s !== student))}
                                  className="text-blue-400 hover:text-rose-500 transition-colors ml-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ghi chú</label>
                      <textarea 
                        value={manualNote}
                        onChange={e => setManualNote(e.target.value)}
                        placeholder="Nhập ghi chú chi tiết cho sinh viên này..."
                        className="w-full min-h-[60px] bg-[#f8fafc] border border-transparent focus:border-blue-400 focus:bg-white rounded-lg p-3 text-[12px] text-slate-900 placeholder:text-slate-500 outline-none transition-colors resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <button 
                        onClick={() => {
                          if (manualStudents.length === 0) {
                             toast.error("Vui lòng thêm ít nhất 1 sinh viên!");
                             return;
                          }
                          toast.success(`Đã thêm ${manualStudents.length} sinh viên vào danh sách!`);
                          setShowManualAdd(false);
                          setStudentInput('');
                          setManualStudents([]);
                          setManualNote('');
                        }}
                        className="h-[36px] px-6 bg-[#135bec] text-white text-[12px] font-bold rounded-lg shadow-[0_2px_4px_-2px_rgba(37,99,235,0.2)] hover:bg-blue-700 transition-colors"
                      >
                        Thêm vào danh sách
                      </button>
                      <button 
                        onClick={() => {
                          setShowManualAdd(false);
                          setStudentInput('');
                          setManualStudents([]);
                          setManualNote('');
                        }}
                        className="w-[36px] h-[36px] flex items-center justify-center text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                <AnimatePresence>
                  {isProcessing ? (
                    Array.from({length: 4}).map((_, i) => (
                      <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-5 w-10" />
                        </div>
                        <Skeleton className="h-[60px] w-full mt-2" />
                      </div>
                    ))
                  ) : (
                    students.map(student => (
                      <motion.div 
                        key={student.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-1">
                            <span className="text-[16px] font-bold text-slate-900">Họ tên: {student.fullName}</span>
                            <span className="text-[12px] text-slate-500">MSSV: {student.studentId} • Lớp: {student.className}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            </span>
                            <span className="text-[14px] font-bold text-emerald-500 text-right">98%</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-50">
                          <textarea 
                            placeholder="Ghi chú cho học sinh..."
                            className="w-full min-h-[60px] bg-slate-50 rounded-lg p-3 text-[12px] text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white resize-none border border-transparent transition-colors"
                          />
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 shrink-0 flex justify-center bg-white relative z-10">
               <button 
                 onClick={handleSave}
                 disabled={isSaving || isProcessing}
                 className="flex items-center justify-center gap-3 w-[448px] max-w-full py-4 bg-blue-600 rounded-xl text-white font-bold text-[16px] shadow-[0_8px_10px_-6px_rgba(19,127,236,0.3)] hover:bg-blue-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
               >
                 {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />}
                 Xác nhận và Ghi nhận tất cả
               </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
