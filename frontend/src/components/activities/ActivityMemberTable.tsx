'use client';

import React, { useState, useRef } from 'react';
import { ActivityMember } from '@/api/activity-api';
import { Check, X, ShieldAlert, Trash2, Edit2, User, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface ActivityMemberTableProps {
  members: ActivityMember[];
  onApprove: (memberId: string) => Promise<void>;
  onReject: (memberId: string) => Promise<void>;
  onUpdateRole: (memberId: string, newRole: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  loading?: boolean;
  isAdminOrAdvisor?: boolean;
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
  loading = false,
  isAdminOrAdvisor = false,
}: ActivityMemberTableProps) {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingRemovalMemberId, setPendingRemovalMemberId] = useState<string | null>(null);
  const isRemovingRef = useRef(false);

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

  const handleRejectClick = async (memberId: string) => {
    if (!confirm('Bạn có chắc chắn muốn từ chối yêu cầu tham gia này không?')) return;
    setUpdatingId(memberId);
    try {
      await onReject(memberId);
      toast.success('Đã từ chối yêu cầu tham gia');
    } catch {
      toast.error('Lỗi khi từ chối yêu cầu');
    } finally {
      setUpdatingId(null);
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
              <th className="px-5 py-3">Sinh viên</th>
              <th className="px-5 py-3">Vai trò</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Ngày tham gia</th>
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
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <User size={14} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">
                          {student?.full_name || 'Không xác định'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {student?.student_code || '—'} · {student?.email || 'Chưa có email'}
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
                  {isAdminOrAdvisor && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isPending ? (
                          <>
                            <Button
                              onClick={() => handleApproveClick(member._id)}
                              className="h-8 px-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-1 cursor-pointer"
                              disabled={isUpdating}
                            >
                              <Check size={14} />
                              Duyệt
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleRejectClick(member._id)}
                              className="h-8 px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg flex items-center gap-1 cursor-pointer"
                              disabled={isUpdating}
                            >
                              <X size={14} />
                              Từ chối
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => handleRemoveClick(member._id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-lg cursor-pointer"
                            disabled={isUpdating}
                            title="Xóa thành viên"
                          >
                            <Trash2 size={14} />
                          </Button>
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
    </div>
  );
}
