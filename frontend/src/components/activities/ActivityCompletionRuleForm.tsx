'use client';

import React, { useState, useEffect } from 'react';
import { ActivityCompletionRule } from '@/api/activity-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { toast } from 'sonner';
import { Check, Info, Award, HelpCircle, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActivityCompletionRuleFormProps {
  initialData?: ActivityCompletionRule | null;
  activityId: string;
  semesterId: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}

export default function ActivityCompletionRuleForm({
  initialData,
  activityId,
  semesterId,
  onSubmit,
  onCancel,
  saving = false,
}: ActivityCompletionRuleFormProps) {
  const [minimumAttendance, setMinimumAttendance] = useState<number>(initialData?.minimum_attendance || 3);
  const [selectedCriterionIds, setSelectedCriterionIds] = useState<string[]>(initialData?.criterion_ids?.map(c => typeof c === 'object' ? c._id : c) || []);
  const [status, setStatus] = useState<'active' | 'inactive'>(initialData?.status || 'active');
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCriteria() {
      setLoading(true);
      try {
        const list = await criteriaApi.getCriteria();
        setCriteria(list);
      } catch {
        toast.error('Lỗi khi tải danh sách tiêu chí rèn luyện');
      } finally {
        setLoading(false);
      }
    }
    loadCriteria();
  }, []);

  const handleToggleCriterion = (id: string) => {
    setSelectedCriterionIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (minimumAttendance < 1) {
      toast.error('Số buổi điểm danh tối thiểu phải lớn hơn hoặc bằng 1');
      return;
    }
    if (selectedCriterionIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một tiêu chí rèn luyện để cộng điểm');
      return;
    }

    const payload = {
      activity_id: activityId,
      semester_id: semesterId,
      minimum_attendance: Number(minimumAttendance),
      criterion_ids: selectedCriterionIds,
      status,
    };

    try {
      await onSubmit(payload);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi lưu cấu hình quy tắc hoàn thành');
    }
  };

  const filteredCriteria = criteria.filter(c =>
    c.criterion_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.criterion_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-2xl shadow-sm space-y-4">
        
        {/* Info Box */}
        <div className="flex gap-2.5 bg-blue-500/10 border border-blue-200 text-blue-700 p-3 rounded-xl text-xs font-semibold">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p>
            Quy tắc này sẽ tự động ghi nhận kết quả hoàn thành hoạt động rèn luyện của sinh viên và cộng điểm rèn luyện tương ứng vào học bạ học kỳ của họ khi sinh viên đạt đủ số buổi điểm danh yêu cầu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Config Inputs */}
          <div className="space-y-4">
            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Số buổi tham gia tối thiểu <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={minimumAttendance}
                onChange={(e) => setMinimumAttendance(Number(e.target.value))}
                placeholder="Ví dụ: 5"
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                disabled={saving}
              />
              <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
                Sinh viên cần được điểm danh & duyệt tối thiểu số buổi này để hoàn thành hoạt động.
              </span>
            </div>

            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Trạng thái áp dụng
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                disabled={saving}
              >
                <option value="active">Đang áp dụng (Active)</option>
                <option value="inactive">Tạm ngưng (Inactive)</option>
              </select>
            </div>
          </div>

          {/* Right Column: Selected list summary */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award size={14} className="text-rose-500" />
                Tiêu chí cộng điểm đã chọn ({selectedCriterionIds.length})
              </h4>
              {selectedCriterionIds.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400 italic">Chưa có tiêu chí nào được chọn.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {criteria
                    .filter(c => selectedCriterionIds.includes(c._id))
                    .map(c => (
                      <span
                        key={c._id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold"
                      >
                        {c.criterion_name}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 font-semibold mt-4 border-t border-slate-100/60 pt-2 flex items-center gap-1">
              <HelpCircle size={12} />
              Sinh viên đạt yêu cầu sẽ được cộng 1 lượt hoàn thành vào học bạ đối với từng tiêu chí này.
            </div>
          </div>
        </div>

        {/* Criteria Selection List */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <label className="text-[13px] font-bold text-slate-700">
              Chọn tiêu chí rèn luyện cộng điểm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Tìm kiếm tiêu chí..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-60 h-8 px-2 text-xs rounded-lg border border-slate-200 bg-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="border border-slate-100 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white/30">
            {loading ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">Đang tải tiêu chí...</div>
            ) : filteredCriteria.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">Không tìm thấy tiêu chí phù hợp</div>
            ) : (
              filteredCriteria.map((c) => {
                const isSelected = selectedCriterionIds.includes(c._id);
                return (
                  <div
                    key={c._id}
                    onClick={() => handleToggleCriterion(c._id)}
                    className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 transition-colors cursor-pointer text-xs ${
                      isSelected ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-bold text-slate-700 truncate">
                        {c.criterion_name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Mã: {c.criterion_code || '—'} · Cộng tối đa: {c.max_score}đ
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 border-slate-200 hover:bg-slate-50 cursor-pointer"
            disabled={saving}
          >
            Hủy bỏ
          </Button>
        )}
        <Button
          type="submit"
          className="rounded-xl px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 text-white shadow-md cursor-pointer"
          disabled={saving || loading}
        >
          <Save size={16} className="mr-1.5" />
          {saving ? 'Đang áp dụng...' : 'Lưu cấu hình quy tắc'}
        </Button>
      </div>
    </form>
  );
}
