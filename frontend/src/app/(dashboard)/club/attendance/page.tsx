'use client';

import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Search, Users, Check, X, Clock, Filter } from 'lucide-react';
import { clubApi, clubAttendanceApi, clubScheduleApi, Club, ClubAttendance, ClubSchedule } from '@/api/club-api';
import { toast } from 'sonner';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  present: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Có mặt' },
  absent: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Vắng' },
  late: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Muộn' },
  excused: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Có phép' },
};

export default function AttendancePage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [schedules, setSchedules] = useState<ClubSchedule[]>([]);
  const [attendances, setAttendances] = useState<ClubAttendance[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Batch attendance form
  const [batchEntries, setBatchEntries] = useState<Record<string, { status: string; note: string }>>({});

  useEffect(() => { loadClubs(); }, []);

  useEffect(() => {
    if (selectedClub) {
      loadClubData();
    }
  }, [selectedClub]);

  useEffect(() => {
    if (selectedSchedule) {
      loadAttendance();
    }
  }, [selectedSchedule]);

  const loadClubs = async () => {
    try {
      const data = await clubApi.getAll();
      setClubs(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  const loadClubData = async () => {
    try {
      const [membersData, schedulesData] = await Promise.all([
        clubApi.getMembers(selectedClub, { status: 'active' }),
        clubScheduleApi.getAll({ club_id: selectedClub, limit: 50 }).then(r => r?.items || []),
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setSchedules(Array.isArray(schedulesData) ? schedulesData : []);

      // Init batch entries
      const entries: Record<string, { status: string; note: string }> = {};
      (Array.isArray(membersData) ? membersData : []).forEach((m: any) => {
        const sid = m.student_id?._id || m.student_id;
        entries[sid] = { status: 'present', note: '' };
      });
      setBatchEntries(entries);
    } catch { toast.error('Lỗi khi tải dữ liệu CLB'); }
  };

  const loadAttendance = async () => {
    try {
      const data = await clubAttendanceApi.getAll({ schedule_id: selectedSchedule });
      setAttendances(data?.items || []);

      // Update batch entries with existing attendance
      const entries = { ...batchEntries };
      (data?.items || []).forEach((a: ClubAttendance) => {
        const sid = (a.student_id as any)?._id || a.student_id;
        if (entries[sid]) {
          entries[sid] = { status: a.status, note: a.note || '' };
        }
      });
      setBatchEntries(entries);
    } catch {}
  };

  const handleBatchSubmit = async () => {
    if (!selectedClub || !selectedSchedule) {
      toast.error('Vui lòng chọn CLB và buổi sinh hoạt');
      return;
    }
    try {
      setSaving(true);
      const club = clubs.find(c => c._id === selectedClub);
      const entries = Object.entries(batchEntries).map(([student_id, data]) => ({
        student_id,
        status: data.status,
        note: data.note || undefined,
      }));

      const result = await clubAttendanceApi.batchCreate({
        club_id: selectedClub,
        schedule_id: selectedSchedule,
        semester_id: club?.semester_id?._id || club?.semester_id || '',
        entries,
      });

      toast.success(`Đã điểm danh ${result?.created || entries.length} sinh viên`);
      loadAttendance();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi điểm danh');
    } finally { setSaving(false); }
  };

  const updateEntry = (studentId: string, field: 'status' | 'note', value: string) => {
    setBatchEntries(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const setAllStatus = (status: string) => {
    setBatchEntries(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => { updated[k] = { ...updated[k], status }; });
      return updated;
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-blue-500" /> Điểm danh CLB
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Ghi nhận điểm danh theo buổi sinh hoạt</p>
      </div>

      {/* Selection */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Câu lạc bộ</label>
          <select value={selectedClub} onChange={e => { setSelectedClub(e.target.value); setSelectedSchedule(''); }}
            className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer">
            <option value="">-- Chọn CLB --</option>
            {clubs.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Buổi sinh hoạt</label>
          <select value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)}
            disabled={!selectedClub}
            className="w-full px-3 py-2.5 bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer disabled:opacity-50">
            <option value="">-- Chọn buổi --</option>
            {schedules.map(s => (
              <option key={s._id} value={s._id}>
                {s.title} - {new Date(s.start_time).toLocaleDateString('vi-VN')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Sheet */}
      {selectedClub && selectedSchedule && members.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">
              Bảng điểm danh ({members.length} SV)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Tất cả:</span>
              {Object.entries(statusColors).map(([key, val]) => (
                <button key={key} onClick={() => setAllStatus(key)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${val.bg} ${val.text} cursor-pointer hover:opacity-80`}>
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/40">
            {members.map((m, i) => {
              const sid = m.student_id?._id || m.student_id;
              const entry = batchEntries[sid] || { status: 'present', note: '' };
              const student = m.student_id || {};

              return (
                <div key={sid} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/40 transition-colors">
                  <span className="text-xs font-mono text-slate-400 w-6 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{student.full_name || '—'}</p>
                    <p className="text-xs text-slate-400">{student.student_code || ''}</p>
                  </div>

                  {/* Status buttons */}
                  <div className="flex gap-1">
                    {Object.entries(statusColors).map(([key, val]) => (
                      <button key={key} onClick={() => updateEntry(sid, 'status', key)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-all ${
                          entry.status === key
                            ? `${val.bg} ${val.text} ring-1 ring-current/20`
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                        }`}>
                        {val.label}
                      </button>
                    ))}
                  </div>

                  {/* Note */}
                  <input
                    type="text"
                    placeholder="Ghi chú"
                    value={entry.note}
                    onChange={e => updateEntry(sid, 'note', e.target.value)}
                    className="w-28 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t border-white/50 flex justify-between items-center">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {Object.entries(statusColors).map(([key, val]) => {
                const count = Object.values(batchEntries).filter(e => e.status === key).length;
                return count > 0 ? (
                  <span key={key} className={`${val.text} font-semibold`}>{val.label}: {count}</span>
                ) : null;
              })}
            </div>
            <button onClick={handleBatchSubmit} disabled={saving}
              className="px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 cursor-pointer">
              {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
            </button>
          </div>
        </div>
      )}

      {selectedClub && !selectedSchedule && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock size={32} className="text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Chọn buổi sinh hoạt để bắt đầu điểm danh</p>
        </div>
      )}
    </div>
  );
}
