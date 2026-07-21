'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ActivityMember } from '@/api/activity-api';
import { Check, X, ShieldAlert, Trash2, Edit2, User, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ConfirmModal from '@/components/modals/ConfirmModal';
import FloatingActionBar from '@/components/ui/FloatingActionBar';

interface ActivityMemberTableProps {
  members: ActivityMember[];
  onApprove: (memberId: string) => Promise<void>;
  onReject: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, newRole: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onRemoveMany?: (memberIds: string[]) => Promise<{ failedIds?: string[] }>;
  loading?: boolean;
  isAdminOrAdvisor?: boolean;
  onResetProgress?: (memberId: string) => Promise<void>;
}

const roleLabels: Record<string, string> = {
  president: 'Chủ nhiệm',
  vice_president: 'Phó chủ nhiệm',
  leader: 'Trưởng nhóm',
  member: 'Thành viên',
  advisor: 'Cố vấn',
};

const roleColors: Record<string, string> = {
  president: 'bg-rose-500/10 text-rose-600 border-rose-200',
  vice_president: 'bg-orange-500/10 text-orange-600 border-orange-200',
  leader: 'bg-purple-500/10 text-purple-600 border-purple-200',
  member: 'bg-blue-500/10 text-blue-600 border-blue-200',
  advisor: 'bg-amber-500/10 text-amber-600 border-amber-200',
};

export default function ActivityMemberTable({
  members,
  onApprove,
  onReject,
  onUpdateRole,
  onRemove,
  onRemoveMany,
  loading = false,
  isAdminOrAdvisor = false,
  onResetProgress,
}: ActivityMemberTableProps) {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingRemovalMemberId, setPendingRemovalMemberId] = useState<string | null>(null);
  const [pendingRejectMemberId, setPendingRejectMemberId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const isRemovingRef = useRef(false);

  useEffect(() => setSelectedIds((ids) => ids.filter((id) => members.some((member) => member._id === id))), [members]);
  const selectableIds = members.filter((member) => member.status !== 'pending').map((member) => member._id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const toggleSelected = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleAll = () => setSelectedIds(allSelected ? [] : selectableIds);

  const handleEditRoleClick = (member: ActivityMember) => {
    setEditingMemberId(member._id);
    setSelectedRole(member.role);
  };

  const handleSaveRole = async (memberId: string) => {
    setUpdatingId(memberId);
    try {
      await onUpdateRole(memberId, selectedRole);
      setEditingMemberId(null);
      toast.success('Cập nhật vai trò thành công');
    } catch {
      toast.error('Lỗi khi cập nhật vai trò');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApproveClick = async (memberId: string) => {
    setUpdatingId(memberId);
    try {
      await onApprove(memberId);
      toast.success('Đã duyệt thành viên');
    } catch {
      toast.error('Lỗi khi duyệt thành viên');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectClick = (memberId: string) => {
    setPendingRejectMemberId(memberId);
  };

  const handleConfirmReject = async () => {
    if (!pendingRejectMemberId) return;
    const memberId = pendingRejectMemberId;
    setUpdatingId(memberId);
    try {
      await onReject(memberId);
      toast.success('Đã từ chối yêu cầu tham gia');
    } catch {
      toast.error('Lỗi khi từ chối yêu cầu');
    } finally {
      setUpdatingId(null);
      setPendingRejectMemberId(null);
    }
  };

  const handleRemoveClick = (memberId: string) => {
    setPendingRemovalMemberId(memberId);
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemovalMemberId) return;
    if (isRemovingRef.current) return;
    const memberId = pendingRemovalMemberId;
    isRemovingRef.current = true;
    setUpdatingId(memberId);
    try {
      await onRemove(memberId);
      toast.success('Đã xóa thành viên');
    } catch {
      toast.error('Lỗi khi xóa thành viên');
    } finally {
      isRemovingRef.current = false;
      setUpdatingId(null);
      setPendingRemovalMemberId(null);
    }
  };

  const handleCloseModal = () => {
    if (updatingId !== null) return;
    setPendingRemovalMemberId(null);
  };

  const handleConfirmBulk = async () => {
    if (!onRemoveMany || !selectedIds.length || bulkUpdating) return;
    setBulkUpdating(true);
    try {
      const result = await onRemoveMany(selectedIds);
      const failed = result?.failedIds || [];
      setSelectedIds(failed);
      if (failed.length) toast.error(`${failed.length} thành viên chưa được xóa`);
      else toast.success(`Đã xóa ${selectedIds.length} thành viên`);
    } finally {
      setBulkUpdating(false);
      setBulkConfirmOpen(false);
    }
  };

  const handleResetClick = async (memberId: string) => {
    if (!onResetProgress || resettingId) return;
    setResettingId(memberId);
    try {
      await onResetProgress(memberId);
    } catch {
      toast.error('Lỗi khi reset số lượt rời hoạt động');
    } finally {
      setResettingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 py-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100/60 rounded-xl animate-pulse w-full border border-slate-100" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="py-12 text-center bg-white/40 border border-slate-100 rounded-2xl">
        <User size={36} className="text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-500">Chưa có thành viên nào tham gia</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="px-5 py-3"><input aria-label="Chọn tất cả thành viên" type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = selectedIds.length > 0 && !allSelected; }} onChange={toggleAll} /></th>
              <th className="px-5 py-3">Sinh viên</th>
              <th className="px-5 py-3">Vai trò</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Ngày tham gia</th>
              <th className="px-5 py-3">Lượt rời còn lại</th>
              {isAdminOrAdvisor && <th className="px-5 py-3 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member) => {
              const student = member.student_id;
              const isPending = member.status === 'pending';
              const isUpdating = updatingId === member._id;

              return (
                <tr
                  key={member._id}
                  className={`hover:bg-white/40 transition-colors text-xs ${
                    isPending ? 'bg-amber-50/20' : ''
                  }`}
                >
                  <td className="px-5 py-4"><input aria-label={`Chọn ${student?.full_name || member.user_id?.user_name || member._id}`} type="checkbox" checked={selectedIds.includes(member._id)} disabled={isPending} onChange={() => toggleSelected(member._id)} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <User size={14} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">
                          {student?.full_name || member.user_id?.display_name || member.user_id?.user_name || 'Không xác định'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {student?.student_code || '—'} · {student?.email || member.user_id?.email || 'Chưa có email'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {editingMemberId === member._id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="h-8 text-xs rounded-lg border border-slate-200 px-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          disabled={isUpdating}
                        >
                          <option value="member">Thành viên</option>
                          <option value="leader">Trưởng nhóm</option>
                          <option value="vice_president">Phó chủ nhiệm</option>
                          <option value="president">Chủ nhiệm</option>
                          <option value="advisor">Cố vấn</option>
                        </select>
                        <Button
                          onClick={() => handleSaveRole(member._id)}
                          className="h-8 w-8 p-0 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shrink-0"
                          disabled={isUpdating}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setEditingMemberId(null)}
                          className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-50 rounded-lg shrink-0"
                          disabled={isUpdating}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            roleColors[member.role] || roleColors.member
                          }`}
                        >
                          {roleLabels[member.role] || member.role}
                        </span>
                        {isAdminOrAdvisor && !isPending && (
                          <button
                            onClick={() => handleEditRoleClick(member)}
                            className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors"
                            title="Sửa vai trò"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        isPending
                          ? 'bg-amber-100/60 text-amber-600 border-amber-200'
                          : member.status === 'rejected'
                          ? 'bg-red-100/60 text-red-600 border-red-200'
                          : 'bg-emerald-100/60 text-emerald-600 border-emerald-200'
                      }`}
                    >
                      {isPending ? 'Chờ duyệt' : member.status === 'active' ? 'Đang hoạt động' : member.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 font-medium">
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString('vi-VN')
                      : member.createdAt
                      ? new Date(member.createdAt).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{member.participation_count ?? 0}</td>
                  {isAdminOrAdvisor && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 min-w-[150px]">
                        {isPending ? (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => handleApproveClick(member._id)}
                              className="h-8 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 rounded-xl hover:scale-[1.01] transition-all duration-150 ease-out flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm shadow-emerald-500/5"
                              disabled={isUpdating}
                            >
                              <Check size={14} />
                              Duyệt
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleRejectClick(member._id)}
                              className="h-8 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-700 rounded-xl hover:scale-[1.01] transition-all duration-150 ease-out flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm shadow-rose-500/5"
                              disabled={isUpdating}
                            >
                              <X size={14} />
                              Từ chối
                            </Button>
                          </>
                        ) : (
                          <>
                            {onResetProgress && (
                              <Button
                                variant="ghost"
                                onClick={() => handleResetClick(member._id)}
                                className="h-8 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg"
                                disabled={isUpdating || resettingId === member._id}
                              >
                                {resettingId === member._id ? 'Đang reset...' : 'Reset'}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => handleRemoveClick(member._id)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-lg cursor-pointer"
                              disabled={isUpdating || resettingId === member._id}
                              title="Xóa thành viên"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmModal
        isOpen={pendingRemovalMemberId !== null}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRemove}
        title="Xóa thành viên"
        message="Bạn có chắc chắn muốn xóa thành viên này khỏi hoạt động không? Hành động này không thể hoàn tác."
        confirmLabel="Xác nhận xóa"
        cancelLabel="Hủy bỏ"
        variant="danger"
      />
      <ConfirmModal
        isOpen={pendingRejectMemberId !== null}
        onClose={() => setPendingRejectMemberId(null)}
        onConfirm={handleConfirmReject}
        title="Từ chối yêu cầu"
        message="Bạn có chắc chắn muốn từ chối yêu cầu tham gia hoạt động này của thành viên không?"
        confirmLabel="Từ chối"
        cancelLabel="Hủy bỏ"
        variant="danger"
      />
      <ConfirmModal isOpen={bulkConfirmOpen} onClose={() => !bulkUpdating && setBulkConfirmOpen(false)} onConfirm={handleConfirmBulk} title="Xóa nhiều thành viên" message={`Bạn có chắc chắn muốn xóa ${selectedIds.length} thành viên khỏi hoạt động không?`} confirmLabel="Xác nhận xóa" cancelLabel="Hủy bỏ" variant="danger" />
      <FloatingActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} itemLabel="thành viên" actions={<Button onClick={() => setBulkConfirmOpen(true)} disabled={!onRemoveMany || bulkUpdating} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-[1.01]">Xóa</Button>} />
    </div>
  );
}
