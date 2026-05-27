'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, AlertTriangle, Plus, Minus, CheckSquare } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

interface Criteria {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: 'reward' | 'violation';
}

interface Category {
  id: string;
  title: string;
  maxPoints: number;
  items: Criteria[];
}

const evaluationCategories: Category[] = [
  {
    id: 'cat-1',
    title: 'Ý thức tham gia học tập',
    maxPoints: 20,
    items: [
      { id: 'cri-1-1', name: 'Điểm chuyên cần và thái độ học tập', pointsPerUnit: 10, type: 'reward' },
      { id: 'cri-1-2', name: 'Tham gia các câu lạc bộ học thuật', pointsPerUnit: 5, type: 'reward' },
      { id: 'cri-1-3', name: 'Kết quả học tập (GPA)', pointsPerUnit: 3, type: 'reward' }
    ]
  },
  {
    id: 'cat-2',
    title: 'Ý thức chấp hành nội quy',
    maxPoints: 25,
    items: [
      { id: 'cri-2-1', name: 'Chấp hành quy định về đồng phục & thẻ sinh viên', pointsPerUnit: 10, type: 'reward' },
      { id: 'cri-2-2', name: 'Chấp hành nội quy Ký túc xá/Cư trú', pointsPerUnit: -10, type: 'violation' }
    ]
  },
  {
    id: 'cat-3',
    title: 'Ý thức tham gia hoạt động chính trị, xã hội',
    maxPoints: 20,
    items: [
      { id: 'cri-3-1', name: 'Tham gia chiến dịch Mùa hè xanh', pointsPerUnit: 20, type: 'reward' }
    ]
  }
];

interface BulkGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (criteriaId: string, count: number) => void;
}

export default function BulkGradingModal({
  isOpen,
  onClose,
  selectedCount,
  onConfirm
}: BulkGradingModalProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedCriteriaId, setSelectedCriteriaId] = useState<string>('');
  const [count, setCount] = useState<number>(1);

  // Lấy danh mục đang chọn
  const activeCategory = evaluationCategories.find(c => c.id === selectedCatId);
  // Lấy tiêu chí đang chọn
  const activeCriteria = activeCategory?.items.find(i => i.id === selectedCriteriaId);

  // Tự động reset form khi modal đóng/mở
  useEffect(() => {
    if (isOpen) {
      setSelectedCatId('');
      setSelectedCriteriaId('');
      setCount(1);
    }
  }, [isOpen]);

  // Tự động reset tiêu chí khi thay đổi danh mục
  useEffect(() => {
    setSelectedCriteriaId('');
  }, [selectedCatId]);

  const handleConfirm = () => {
    if (!selectedCatId || !selectedCriteriaId) {
      toast.error('Vui lòng chọn danh mục và tiêu chí chấm điểm!');
      return;
    }
    if (count <= 0) {
      toast.error('Số lần chấm điểm phải lớn hơn 0!');
      return;
    }
    onConfirm(selectedCriteriaId, count);
  };

  const totalPointsChange = activeCriteria ? activeCriteria.pointsPerUnit * count : 0;
  const isViolation = activeCriteria?.type === 'violation';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />

          {/* Content Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-slate-100"
          >
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-[#137fec]" size={20} />
                <h3 className="font-bold text-[#0f172a] text-[16px]">Chấm điểm hàng loạt</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto">
              {/* Alert thông báo số sinh viên đang chọn */}
              <div className="bg-[#137fec]/8 border border-[#137fec]/20 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-1 bg-[#137fec]/15 rounded-lg text-[#137fec] mt-0.5">
                  <Award size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-slate-800">
                    Chấm điểm đồng thời cho {selectedCount} sinh viên
                  </span>
                  <span className="text-[11.5px] text-slate-500 font-medium mt-0.5">
                    Các thay đổi về điểm sẽ được áp dụng trực tiếp cho tất cả sinh viên được tick chọn trong danh sách.
                  </span>
                </div>
              </div>

              {/* 1. Chọn Danh mục */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                  Danh mục rèn luyện
                </label>
                <Select
                  value={selectedCatId}
                  onValueChange={(val: string) => setSelectedCatId(val)}
                >
                  <SelectTrigger className="h-[42px] bg-slate-50 border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {evaluationCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Chọn Tiêu chí */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                  Tiêu chí chấm điểm
                </label>
                <Select
                  value={selectedCriteriaId}
                  onValueChange={(val: string) => setSelectedCriteriaId(val)}
                  disabled={!selectedCatId}
                >
                  <SelectTrigger className="h-[42px] bg-slate-50 border-none rounded-xl text-[13px] font-medium text-slate-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-none disabled:opacity-50 disabled:bg-slate-100">
                    <SelectValue placeholder={selectedCatId ? "Chọn tiêu chí" : "Chọn danh mục trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategory?.items.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.pointsPerUnit > 0 ? '+' : ''}{item.pointsPerUnit}đ)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Số lần thực hiện */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
                  Số lần thực hiện
                </label>
                <div className="flex items-center gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-full p-1.5 flex gap-1.5 items-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
                    <button
                      type="button"
                      onClick={() => setCount(prev => Math.max(1, prev - 1))}
                      disabled={count <= 1 || !selectedCriteriaId}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-90 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus size={13} strokeWidth={3} />
                    </button>
                    <div className="w-10 flex items-center justify-center font-bold text-slate-800 text-[14.5px] select-none">
                      {count}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCount(prev => prev + 1)}
                      disabled={!selectedCriteriaId}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#137fec] hover:bg-blue-50 active:scale-90 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus size={13} strokeWidth={3} />
                    </button>
                  </div>

                  {/* Nhãn realtime điểm thay đổi */}
                  {activeCriteria && (
                    <div className="flex-1 flex flex-col justify-center">
                      <span className={`font-extrabold text-[15.5px] flex items-center gap-1 ${
                        isViolation ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {isViolation ? '-' : '+'}{Math.abs(totalPointsChange)}đ
                        <span className="text-[11.5px] text-slate-400 font-normal">
                          ({activeCriteria.pointsPerUnit > 0 ? '+' : ''}{activeCriteria.pointsPerUnit}đ/lần)
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Tổng kết thay đổi */}
              {activeCriteria && (
                <div className={`rounded-xl p-3.5 flex gap-3 border ${
                  isViolation 
                    ? 'bg-rose-50/50 border-rose-100/50 text-rose-800' 
                    : 'bg-emerald-50/50 border-emerald-100/50 text-emerald-800'
                }`}>
                  <div className="mt-0.5">
                    {isViolation ? <AlertTriangle size={15} /> : <Award size={15} />}
                  </div>
                  <div className="text-[12.5px] font-medium leading-relaxed">
                    Sẽ {isViolation ? 'trừ' : 'cộng'} <strong className="font-extrabold">{Math.abs(totalPointsChange)} điểm rèn luyện</strong> cho <strong className="font-extrabold">{selectedCount} sinh viên</strong> đã chọn.
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50/20">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedCriteriaId}
                className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#137fec] hover:bg-blue-600 transition-all shadow-[0_4px_12px_rgba(19,127,236,0.15)] active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận áp dụng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
