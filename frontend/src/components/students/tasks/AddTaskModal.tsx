'use client';

import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Link as LinkIcon, UserCheck } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  type: 'Dự án' | 'Bài tập' | 'Hoạt động';
  subject: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Chưa bắt đầu' | 'Đang làm' | 'Đã xong';
  linkedPage: string;
  targetType: 'HSSV' | 'Giáo viên' | 'Quản sinh';
  targetScope: 'Tất cả' | 'Cụ thể';
  targetDetail?: string;
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'> & { id?: string }) => void;
  editingTask?: Task | null;
}

const PRESET_PAGES = [
  { label: 'Danh sách sinh viên', value: '/students' },
  { label: 'Ghi nhận chuyên cần & rèn luyện', value: '/students/record' },
  { label: 'Cấu hình danh mục điểm số', value: '/grading/categories' },
  { label: 'Trang chủ Dashboard', value: '/' }
];

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onSave, editingTask }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Dự án' | 'Bài tập' | 'Hoạt động'>('Bài tập');
  const [subject, setSubject] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [status, setStatus] = useState<'Chưa bắt đầu' | 'Đang làm' | 'Đã xong'>('Chưa bắt đầu');
  
  // New Fields States
  const [pageSelection, setPageSelection] = useState('/students');
  const [customPageUrl, setCustomPageUrl] = useState('');
  const [targetType, setTargetType] = useState<'HSSV' | 'Giáo viên' | 'Quản sinh'>('HSSV');
  const [targetScope, setTargetScope] = useState<'Tất cả' | 'Cụ thể'>('Tất cả');
  const [targetDetail, setTargetDetail] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setType(editingTask.type);
      setSubject(editingTask.subject);
      
      // Format deadline to yyyy-MM-dd
      const dateParts = editingTask.deadline.split('/');
      if (dateParts.length === 3) {
        setDeadline(`${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`);
      } else {
        setDeadline(editingTask.deadline);
      }
      
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      
      // Linked Page
      const isPreset = PRESET_PAGES.some(p => p.value === editingTask.linkedPage);
      if (isPreset) {
        setPageSelection(editingTask.linkedPage);
        setCustomPageUrl('');
      } else {
        setPageSelection('custom');
        setCustomPageUrl(editingTask.linkedPage || '');
      }

      // Target Audience
      setTargetType(editingTask.targetType || 'HSSV');
      setTargetScope(editingTask.targetScope || 'Tất cả');
      setTargetDetail(editingTask.targetDetail || '');
    } else {
      setTitle('');
      setType('Bài tập');
      setSubject('');
      
      const today = new Date().toISOString().split('T')[0];
      setDeadline(today);
      setPriority('Medium');
      setStatus('Chưa bắt đầu');
      
      // Defaults
      setPageSelection('/students');
      setCustomPageUrl('');
      setTargetType('HSSV');
      setTargetScope('Tất cả');
      setTargetDetail('');
    }
  }, [editingTask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !deadline) return;

    // Convert yyyy-MM-dd back to dd/MM/yyyy
    const dateParts = deadline.split('-');
    const formattedDeadline = dateParts.length === 3 
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : deadline;

    // Determine target page link
    const finalLinkedPage = pageSelection === 'custom' ? customPageUrl.trim() : pageSelection;

    onSave({
      ...(editingTask && { id: editingTask.id }),
      title: title.trim(),
      type,
      subject: subject.trim(),
      deadline: formattedDeadline,
      priority,
      status,
      linkedPage: finalLinkedPage || '/students',
      targetType,
      targetScope: targetType === 'Quản sinh' ? 'Tất cả' : targetScope,
      targetDetail: (targetType !== 'Quản sinh' && targetScope === 'Cụ thể') ? targetDetail.trim() : undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[999] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur-md border border-white/80 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white/40">
          <div className="flex items-center gap-2">
            <PlusCircle className="text-[#1A73E8] w-5 h-5" />
            <h3 className="font-bold text-base text-[#1E293B]">
              {editingTask ? 'Cập nhật cấu hình nhiệm vụ' : 'Thêm nhiệm vụ mới'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Tên nhiệm vụ */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Tên nhiệm vụ</label>
            <input 
              type="text"
              required
              placeholder="Nhập tên nhiệm vụ học tập..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white/50 px-3 py-2 text-sm text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Loại nhiệm vụ */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#64748B] block">Loại nhiệm vụ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 bg-white/50 px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
              >
                <option value="Bài tập">Bài tập</option>
                <option value="Dự án">Dự án</option>
                <option value="Hoạt động">Hoạt động</option>
              </select>
            </div>

            {/* Mức độ ưu tiên */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#64748B] block">Độ ưu tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 bg-white/50 px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
              >
                <option value="Low">Thấp (Low)</option>
                <option value="Medium">Trung bình (Medium)</option>
                <option value="High">Cao (High)</option>
              </select>
            </div>
          </div>

          {/* Môn học / Lĩnh vực */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#64748B] block">Môn học / Lĩnh vực</label>
            <input 
              type="text"
              required
              placeholder="Ví dụ: Thiết kế trải nghiệm người dùng, Toán cao cấp..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white/50 px-3 py-2 text-sm text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
            />
          </div>

          {/* Cấu hình Đối tượng áp dụng (Target Audience) */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 space-y-3.5">
            <div className="flex items-center gap-1.5 border-b border-slate-200/40 pb-2">
              <UserCheck size={16} className="text-[#1A73E8]" />
              <span className="text-xs font-bold text-[#1E293B]">Đối tượng áp dụng nhiệm vụ</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['HSSV', 'Giáo viên', 'Quản sinh'] as const).map((role) => (
                <label 
                  key={role} 
                  className={`flex items-center justify-center gap-2 p-2 rounded-xl border cursor-pointer text-xs font-semibold transition-all ${
                    targetType === role 
                      ? 'bg-blue-50/60 border-blue-300 text-[#1A73E8] shadow-xs' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="targetType" 
                    value={role} 
                    checked={targetType === role}
                    onChange={() => {
                      setTargetType(role);
                      if (role === 'Quản sinh') {
                        setTargetScope('Tất cả');
                      }
                    }}
                    className="sr-only"
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>

            {targetType !== 'Quản sinh' && (
              <div className="grid grid-cols-2 gap-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Phạm vi áp dụng */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#64748B] block">Phạm vi</label>
                  <select
                    value={targetScope}
                    onChange={(e) => setTargetScope(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
                  >
                    <option value="Tất cả">Tất cả {targetType}</option>
                    <option value="Cụ thể">{targetType} cụ thể</option>
                  </select>
                </div>

                {/* Tên đối tượng cụ thể */}
                {targetScope === 'Cụ thể' && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-left-1 duration-150">
                    <label className="text-xs font-semibold text-[#64748B] block">Tên cụ thể / Nhóm</label>
                    <input 
                      type="text"
                      required
                      placeholder={targetType === 'HSSV' ? 'Ví dụ: Nguyễn Văn A, Lớp K45A...' : 'Ví dụ: GV Nguyễn Văn B...'}
                      value={targetDetail}
                      onChange={(e) => setTargetDetail(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cấu hình Trang liên kết (Linked Route) */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 space-y-3.5">
            <div className="flex items-center gap-1.5 border-b border-slate-200/40 pb-2">
              <LinkIcon size={15} className="text-[#1A73E8]" />
              <span className="text-xs font-bold text-[#1E293B]">Trang liên kết nhiệm vụ</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#64748B] block">Chọn trang đích</label>
                <select
                  value={pageSelection}
                  onChange={(e) => setPageSelection(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
                >
                  {PRESET_PAGES.map(page => (
                    <option key={page.value} value={page.value}>{page.label} ({page.value})</option>
                  ))}
                  <option value="custom">Nhập trang tùy chỉnh (Custom URL)...</option>
                </select>
              </div>

              {pageSelection === 'custom' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <label className="text-xs font-semibold text-[#64748B] block">Nhập đường dẫn trang (Route)</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ví dụ: /students/123, /classes"
                    value={customPageUrl}
                    onChange={(e) => setCustomPageUrl(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1E293B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Hạn chót */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#64748B] block">Hạn chót (Deadline)</label>
              <input 
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white/50 px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
              />
            </div>

            {/* Trạng thái */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#64748B] block">Trạng thái ban đầu</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 bg-white/50 px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] transition-all"
              >
                <option value="Chưa bắt đầu">Chưa bắt đầu</option>
                <option value="Đang làm">Đang làm</option>
                <option value="Đã xong">Đã xong</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100 bg-white/40 -mx-5 -mb-5 p-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#1A73E8] hover:bg-[#155cb4] active:scale-[0.99] transition-all duration-150 hover:scale-[1.01] shadow-sm shadow-blue-500/10"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;
