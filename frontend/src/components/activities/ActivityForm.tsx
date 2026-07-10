'use client';

import React, { useState, useEffect } from 'react';
import { Activity } from '@/api/activity-api';
import { authApi, tokenStorage } from '@/api/auth-api';
import { studentApi, Student } from '@/api/student-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { criteriaApi, Criterion } from '@/api/criteria-api';
import { toast } from 'sonner';
import { Save, X, Settings2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';

interface ActivityFormProps {
  initialData?: Partial<Activity>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function ActivityForm({ initialData, onSubmit, onCancel, saving = false }: ActivityFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    activity_type: initialData?.activity_type || 'club',
    participation_status: initialData?.participation_status || 'published',
    classroom: initialData?.classroom || '',
    description: initialData?.description || '',
    category: initialData?.category || 'other',
    advisor_id: typeof initialData?.advisor_id === 'object' ? initialData.advisor_id?._id : initialData?.advisor_id || '',
    president_id: typeof initialData?.president_id === 'object' ? initialData.president_id?._id : initialData?.president_id || '',
    max_members: initialData?.max_members || '',
    founded_date: initialData?.founded_date ? new Date(initialData.founded_date).toISOString().split('T')[0] : '',
    activity_start_date: initialData?.activity_start_date ? new Date(initialData.activity_start_date).toISOString().split('T')[0] : '',
    activity_end_date: initialData?.activity_end_date ? new Date(initialData.activity_end_date).toISOString().split('T')[0] : '',
    semester_id: typeof initialData?.semester_id === 'object' ? initialData.semester_id?._id : initialData?.semester_id || '',
    logo_url: initialData?.logo_url || '',
    cover_url: initialData?.cover_url || '',
    settings: {
      allow_self_registration: initialData?.settings?.allow_self_registration ?? true,
      require_approval: initialData?.settings?.require_approval ?? true,
      attendance_point_enabled: initialData?.settings?.attendance_point_enabled ?? false,
      point_per_attendance: initialData?.settings?.point_per_attendance || 0,
      criterion_id: initialData?.settings?.criterion_id || '',
    }
  });

  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const token = tokenStorage.getAccessToken() || '';
        const [usersData, studentsData, semestersData, criteriaData] = await Promise.all([
          authApi.getUsers(token).catch(() => []),
          studentApi.getStudents({ limit: 200 }).catch(() => []),
          semesterApi.getSemesters().catch(() => []),
          criteriaApi.getCriteria().catch(() => []),
        ]);

        const filteredTeachers = usersData.filter((u: any) => u.role?.role_code === 'TEACHER' || u.role_code === 'TEACHER');
        setTeachers(filteredTeachers.length > 0 ? filteredTeachers : usersData);
        
        const studentsList = Array.isArray(studentsData) ? studentsData : (studentsData as any).data || [];
        setStudents(studentsList);
        setSemesters(semestersData);
        setCriteria(criteriaData);
      } catch (err) {
        console.error('Failed to load form options:', err);
        toast.error('Lỗi khi tải danh sách tùy chọn');
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('settings.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name.startsWith('settings.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          [field]: checked
        }
      }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code || !formData.classroom || !formData.advisor_id) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    // Prepare payload
    const payload = {
      ...formData,
      max_members: formData.max_members ? Number(formData.max_members) : undefined,
      founded_date: formData.founded_date ? new Date(formData.founded_date) : undefined,
      activity_start_date: formData.activity_start_date ? new Date(formData.activity_start_date) : undefined,
      activity_end_date: formData.activity_end_date ? new Date(formData.activity_end_date) : undefined,
      president_id: formData.president_id || undefined,
      semester_id: formData.semester_id || undefined,
      settings: {
        ...formData.settings,
        point_per_attendance: Number(formData.settings.point_per_attendance),
        criterion_id: formData.settings.criterion_id || undefined,
      }
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 max-h-[85vh] overflow-y-auto px-1 pr-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left column: Basic Information */}
        <div className="space-y-4 bg-white/40 backdrop-blur-sm border border-white/60 p-5 rounded-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <Sparkles className="text-blue-500" size={18} />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Thông tin chung</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Tên hoạt động <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ví dụ: Câu lạc bộ IT, Festival Công Nghệ..."
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Mã hoạt động <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="Ví dụ: CLB_IT"
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
                  required
                />
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Thể loại hoạt động
                </label>
                <select
                  name="activity_type"
                  value={formData.activity_type}
                  onChange={handleChange}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="club">Câu lạc bộ (Club)</option>
                  <option value="event">Sự kiện (Event)</option>
                  <option value="activity">Hoạt động (Activity)</option>
                  <option value="festival">Lễ hội (Festival)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Phân loại
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="academic">Học thuật</option>
                  <option value="sports">Thể thao</option>
                  <option value="art">Nghệ thuật</option>
                  <option value="volunteer">Tình nguyện</option>
                  <option value="technology">Công nghệ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Trạng thái
                </label>
                <select
                  name="participation_status"
                  value={formData.participation_status}
                  onChange={handleChange}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="draft">Bản nháp (Draft)</option>
                  <option value="published">Đang hoạt động (Published)</option>
                  <option value="completed">Đã kết thúc (Completed)</option>
                  <option value="cancelled">Đã hủy (Cancelled)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Phòng sinh hoạt <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="classroom"
                  value={formData.classroom}
                  onChange={handleChange}
                  placeholder="Ví dụ: Phòng A.102"
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Thành viên tối đa
                </label>
                <input
                  type="number"
                  name="max_members"
                  value={formData.max_members}
                  onChange={handleChange}
                  placeholder="Không giới hạn"
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Mô tả chi tiết
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Mô tả về mục tiêu và nội dung hoạt động..."
                className="w-full p-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right column: Advisors & Operations */}
        <div className="space-y-4 bg-white/40 backdrop-blur-sm border border-white/60 p-5 rounded-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
            <Settings2 className="text-indigo-500" size={18} />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Vận hành & Thời gian</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Giáo viên phụ trách (Cố vấn) <span className="text-red-500">*</span>
              </label>
              <select
                name="advisor_id"
                value={formData.advisor_id}
                onChange={handleChange}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              >
                <option value="">-- Chọn cố vấn --</option>
                {teachers.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.full_name || t.user_name || t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Chủ nhiệm sinh viên (President)
              </label>
              <select
                name="president_id"
                value={formData.president_id}
                onChange={handleChange}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">-- Chọn sinh viên đại diện --</option>
                {students.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.full_name} ({s.student_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[13px] font-bold text-slate-700 block mb-1">
                Học kỳ áp dụng
              </label>
              <select
                name="semester_id"
                value={formData.semester_id}
                onChange={handleChange}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">-- Chọn học kỳ --</option>
                {semesters.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.semester_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  name="activity_start_date"
                  value={formData.activity_start_date}
                  onChange={handleChange}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Ngày kết thúc
                </label>
                <input
                  type="date"
                  name="activity_end_date"
                  value={formData.activity_end_date}
                  onChange={handleChange}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Logo URL
                </label>
                <input
                  type="text"
                  name="logo_url"
                  value={formData.logo_url}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-700 block mb-1">
                  Cover URL
                </label>
                <input
                  type="text"
                  name="cover_url"
                  value={formData.cover_url}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings Section */}
      <div className="bg-white/40 backdrop-blur-sm border border-white/60 p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
          <Settings2 className="text-purple-500" size={18} />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Cấu hình nâng cao</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <div>
                <label className="text-xs font-bold text-slate-700 block">
                  Cho phép tự đăng ký
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Sinh viên được tự đăng ký tham gia</span>
              </div>
              <input
                type="checkbox"
                name="settings.allow_self_registration"
                checked={formData.settings.allow_self_registration}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <div>
                <label className="text-xs font-bold text-slate-700 block">
                  Yêu cầu phê duyệt
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Cố vấn/President phải duyệt đơn đăng ký</span>
              </div>
              <input
                type="checkbox"
                name="settings.require_approval"
                checked={formData.settings.require_approval}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <div>
                <label className="text-xs font-bold text-slate-700 block">
                  Tính điểm rèn luyện khi điểm danh
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">Điểm danh thành công sẽ được cộng điểm trực tiếp</span>
              </div>
              <input
                type="checkbox"
                name="settings.attendance_point_enabled"
                checked={formData.settings.attendance_point_enabled}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
            </div>

            {formData.settings.attendance_point_enabled && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                <div>
                  <label className="text-[12px] font-bold text-slate-700 block mb-1">
                    Điểm cộng mỗi buổi
                  </label>
                  <input
                    type="number"
                    name="settings.point_per_attendance"
                    value={formData.settings.point_per_attendance}
                    onChange={handleChange}
                    min="0"
                    step="0.5"
                    className="w-full h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-700 block mb-1">
                    Tiêu chí áp dụng
                  </label>
                  <select
                    name="settings.criterion_id"
                    value={formData.settings.criterion_id}
                    onChange={handleChange}
                    className="w-full h-9 px-3 text-sm rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
                  >
                    <option value="">-- Chọn tiêu chí --</option>
                    {criteria.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.criterion_name} (+{c.max_score}đ max)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="rounded-xl px-4 py-2 border-slate-200 hover:bg-slate-50 cursor-pointer"
          disabled={saving}
        >
          <X size={16} className="mr-1.5" />
          Hủy bỏ
        </Button>
        <Button
          type="submit"
          className="rounded-xl px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 text-white shadow-md cursor-pointer"
          disabled={saving}
        >
          <Save size={16} className="mr-1.5" />
          {saving ? 'Đang lưu...' : 'Lưu hoạt động'}
        </Button>
      </div>
    </form>
  );
}
