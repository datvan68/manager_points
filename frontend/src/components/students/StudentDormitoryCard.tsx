'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  ChevronRight,
  Pencil,
  Check,
  X,
  AlertCircle,
  Loader2,
  FileText,
  Calendar,
  Home,
  User,
  Phone,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/providers/auth-provider';
import {
  dormitoryApi,
  SelfDormitoryRegistration,
  DormRegistration,
} from '@/api/dormitory-api';
import { ApplicantProfileFields, compactApplicantProfile, emptyApplicantProfile } from '@/components/dormitory/PublicDormitoryRegistrationModal';
import { Student } from '@/api/student-api';

interface StudentDormitoryCardProps {
  registrationData: SelfDormitoryRegistration | null;
  student?: Student | null;
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

export function formatVndPrice(price: number | null | undefined): string {
  if (typeof price !== 'number' || price <= 0 || isNaN(price)) {
    return 'Chưa có giá';
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export function getEffectiveRoomLabel(registration: DormRegistration): string {
  if (registration.room_id && typeof registration.room_id === 'object') {
    return registration.room_id.room_name || registration.room_id.room_code || 'Chưa xếp phòng';
  }
  if (registration.assigned_room_name) {
    return registration.assigned_room_name;
  }
  return 'Chưa xếp phòng';
}

export function getEffectiveBedLabel(registration: DormRegistration): string {
  if (registration.bed_id && typeof registration.bed_id === 'object') {
    return registration.bed_id.bed_code || 'Chưa xếp giường';
  }
  return 'Chưa xếp giường';
}

export function getRoomPrice(registration: DormRegistration): number | null {
  if (registration.room_id && typeof registration.room_id === 'object' && typeof registration.room_id.room_price === 'number') {
    return registration.room_id.room_price;
  }
  return null;
}

export function formatDateString(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function StudentDormitoryCard({
  registrationData,
  student,
  onRefresh,
  className,
}: StudentDormitoryCardProps) {
  const { user } = useAuth();
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registration = registrationData?.registration;

  // Form edit state
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editPriorityGroup, setEditPriorityGroup] = useState('Không');
  const [editRoomType, setEditRoomType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editAcademicYear, setEditAcademicYear] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editApplicantProfile, setEditApplicantProfile] = useState(emptyApplicantProfile());

  if (!registrationData?.has_dormitory_registration || !registration) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        className={`bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-4 sm:gap-5 w-full min-w-0 ${className || ''}`}
      >
        <div className="flex items-center gap-[8px] w-full">
          <div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" />
          <h2 className="font-sans font-bold text-[#1E293B] text-[15px] sm:text-[16px] tracking-tight leading-[24px]">
            Thông tin KTX
          </h2>
        </div>
        <p className="text-[13px] font-semibold text-[#64748B]">Không ở trong KTX</p>
      </motion.div>
    );
  }

  const roleName = String(user?.role || user?.roleName || '').toLowerCase();
  const roleCode = String(user?.roleCode || '').toUpperCase();
  const permissions: string[] = user?.permissions || [];

  const isStaff =
    roleName.includes('admin') ||
    roleName.includes('supervisor') ||
    roleCode.includes('ADMIN') ||
    roleCode.includes('SUPERVISOR') ||
    permissions.includes('DORM_REG_UPDATE');

  const studentUserId =
    student?.user_id && typeof student.user_id === 'object'
      ? (student.user_id as any)?._id || (student.user_id as any)?.id
      : student?.user_id?.toString();

  const isSelfStudent =
    (roleName.includes('student') || roleCode === 'STUDENT') &&
    (studentUserId === user?.id || user?.studentId === student?._id);

  const editableFields = registration.editable_fields || [];
  const isEligibleToEdit = isStaff || (isSelfStudent && editableFields.length > 0);

  const roomLabel = getEffectiveRoomLabel(registration);
  const bedLabel = getEffectiveBedLabel(registration);
  const roomPrice = getRoomPrice(registration);
  const formattedPrice = formatVndPrice(roomPrice);

  const openModal = () => {
    setErrorMessage(null);
    setIsEditing(false);
    resetEditForm();
    setIsModalOpen(true);
  };

  const closeModal = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setIsEditing(false);
      setErrorMessage(null);
      setTimeout(() => {
        triggerButtonRef.current?.focus();
      }, 50);
    }
  };

  const resetEditForm = () => {
    setEditPhoneNumber(registration.phone_number || '');
    setEditPriorityGroup(registration.priority_group || 'Không');
    setEditRoomType(registration.preference?.room_type || '');
    setEditNotes(registration.preference?.notes || '');
    setEditSemester(registration.semester || '');
    setEditAcademicYear(registration.academic_year || '');
    setEditDob(
      registration.date_of_birth
        ? new Date(registration.date_of_birth).toISOString().split('T')[0]
        : ''
    );
    setEditGender(registration.gender || 'Male');
    setEditApplicantProfile({
      ...emptyApplicantProfile(),
      ...(registration.applicant_profile || {}),
      father: {
        ...emptyApplicantProfile().father,
        ...(registration.applicant_profile?.father || {}),
      },
      mother: {
        ...emptyApplicantProfile().mother,
        ...(registration.applicant_profile?.mother || {}),
      },
    });
  };

  const handleStartEdit = () => {
    setErrorMessage(null);
    resetEditForm();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setErrorMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (isSelfStudent && !isStaff) {
        // Self-service update
        const payload: any = {
          phone_number: editPhoneNumber.trim(),
          priority_group: editPriorityGroup as any,
          preference: {
            room_type: editRoomType,
            notes: editNotes,
          },
        };
        const applicantProfile = compactApplicantProfile(editApplicantProfile);
        if (applicantProfile) payload.applicant_profile = applicantProfile;
        await dormitoryApi.registrations.updateMine(payload);
      } else if (isStaff) {
        // Staff update
        const payload: any = {
          phone_number: editPhoneNumber.trim(),
          priority_group: editPriorityGroup as any,
          preference: {
            room_type: editRoomType,
            notes: editNotes,
          },
          semester: editSemester,
          academic_year: editAcademicYear,
          date_of_birth: editDob || undefined,
          gender: editGender,
        };
        const applicantProfile = compactApplicantProfile(editApplicantProfile);
        if (applicantProfile) payload.applicant_profile = applicantProfile;
        await dormitoryApi.registrations.update(registration._id, 'FORMAL', payload);
      } else {
        throw new Error('Bạn không có quyền cập nhật thông tin đơn này.');
      }

      toast.success('Cập nhật thông tin KTX thành công!');
      setIsEditing(false);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      console.error('Error updating dormitory registration:', err);
      const msg = err.message || err.error || 'Đã xảy ra lỗi khi cập nhật thông tin KTX.';
      setErrorMessage(msg);
      toast.error(msg);
      // NOTE: Form state is preserved on failure
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        className={`bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-4 sm:gap-5 w-full min-w-0 ${className || ''}`}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-[8px]">
            <div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" />
            <h2 className="font-sans font-bold text-[#1E293B] text-[15px] sm:text-[16px] tracking-tight leading-[24px]">
              Thông tin KTX
            </h2>
          </div>
          <button
            ref={triggerButtonRef}
            onClick={openModal}
            aria-label="Xem chi tiết KTX"
            title="Xem chi tiết KTX"
            className="w-[28px] h-[28px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer shrink-0 text-[#64748B] hover:text-[#1A73E8]"
          >
            <ChevronRight className="w-[16px] h-[16px]" />
          </button>
        </div>

        {/* Card Rows */}
        <div className="flex flex-col gap-[12px] w-full min-w-0">
          <div className="flex items-center justify-between w-full border-b border-white/40 pb-2 gap-3">
            <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">
              Phòng
            </span>
            <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">
              {roomLabel}
            </span>
          </div>

          <div className="flex items-center justify-between w-full border-b border-white/40 pb-2 gap-3">
            <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">
              Giường
            </span>
            <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">
              {bedLabel}
            </span>
          </div>

          <div className="flex items-center justify-between w-full border-b border-white/40 pb-2 gap-3">
            <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">
              Giá tiền
            </span>
            <span className="font-sans font-bold text-[#1A73E8] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">
              {formattedPrice}
            </span>
          </div>

          <div className="flex items-center justify-between w-full pb-0 gap-3">
            <span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">
              Học kỳ
            </span>
            <span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">
              {registration.semester} - {registration.academic_year}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Detail & Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-white/80 shadow-2xl rounded-2xl p-6">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1A73E8] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-[#1E293B]">
                    Chi tiết đăng ký Ký túc xá
                  </DialogTitle>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Mã đơn: <span className="font-semibold text-[#1E293B]">{registration.registration_code}</span>
                  </p>
                </div>
              </div>

              {!isEditing && isEligibleToEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartEdit}
                  className="rounded-xl gap-1.5 border-slate-200 hover:bg-slate-50 text-[#1A73E8] font-semibold text-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Chỉnh sửa
                </Button>
              )}
            </div>
          </DialogHeader>

          {errorMessage && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isEditing ? (
            /* ═══ VIEW MODE ═══ */
            <div className="flex flex-col gap-5 py-4 text-xs">
              {/* Section 1: Thông tin phòng & hợp đồng */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="font-bold text-[#1E293B] text-sm flex items-center gap-2">
                  <Home className="w-4 h-4 text-[#1A73E8]" />
                  Thông tin phòng ở & Hợp đồng
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Phòng ở:</span>
                    <span className="font-semibold text-[#1E293B]">{roomLabel}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Giường:</span>
                    <span className="font-semibold text-[#1E293B]">{bedLabel}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Giá tiền:</span>
                    <span className="font-bold text-[#1A73E8]">{formattedPrice}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Trạng thái đơn:</span>
                    <span className="font-semibold text-[#1E293B]">{registration.status}</span>
                  </div>
                  {registration.active_contract && (
                    <>
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Mã hợp đồng:</span>
                        <span className="font-semibold text-[#1E293B]">
                          {registration.active_contract.contract_code}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Thời hạn hợp đồng:</span>
                        <span className="font-semibold text-[#1E293B]">
                          {formatDateString(registration.active_contract.start_date)} - {formatDateString(registration.active_contract.end_date)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Section 2: Thông tin đăng ký & liên hệ */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
                <h4 className="font-bold text-[#1E293B] text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-[#1A73E8]" />
                  Thông tin đăng ký & Hồ sơ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Học kỳ / Năm học:</span>
                    <span className="font-semibold text-[#1E293B]">
                      {registration.semester} - {registration.academic_year}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Số điện thoại:</span>
                    <span className="font-semibold text-[#1E293B]">{registration.phone_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Đối tượng ưu tiên:</span>
                    <span className="font-semibold text-[#1E293B]">{registration.priority_group || 'Không'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-[#64748B]">Loại phòng nguyện vọng:</span>
                    <span className="font-semibold text-[#1E293B]">{registration.preference?.room_type || 'N/A'}</span>
                  </div>
                  {registration.preference?.notes && (
                    <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 border-b border-slate-200/50 pb-1.5">
                      <span className="text-[#64748B]">Ghi chú nguyện vọng:</span>
                      <span className="font-normal text-[#1E293B]">{registration.preference.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Hồ sơ ứng viên (nếu có) */}
              {registration.applicant_profile && (
                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="font-bold text-[#1E293B] text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#1A73E8]" />
                    Thông tin hồ sơ (không bắt buộc)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-1">
                    {registration.applicant_profile.ethnicity && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Dân tộc:</span>
                        <span className="font-semibold text-[#1E293B]">
                          {registration.applicant_profile.ethnicity}
                        </span>
                      </div>
                    )}
                    {registration.applicant_profile.religion && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Tôn giáo:</span>
                        <span className="font-semibold text-[#1E293B]">
                          {registration.applicant_profile.religion}
                        </span>
                      </div>
                    )}
                    {registration.applicant_profile.citizen_id_number && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">CCCD/CMND:</span>
                        <span className="font-semibold text-[#1E293B]">{registration.applicant_profile.citizen_id_number}</span>
                      </div>
                    )}
                    {registration.applicant_profile.citizen_id_issue_date && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Ngày cấp CCCD/CMND:</span>
                        <span className="font-semibold text-[#1E293B]">{formatDateString(registration.applicant_profile.citizen_id_issue_date)}</span>
                      </div>
                    )}
                    {registration.applicant_profile.citizen_id_issue_place && (
                      <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Nơi cấp CCCD/CMND:</span>
                        <span className="font-semibold text-[#1E293B]">{registration.applicant_profile.citizen_id_issue_place}</span>
                      </div>
                    )}
                    {registration.applicant_profile.permanent_address && (
                      <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Hộ khẩu thường trú:</span>
                        <span className="font-normal text-[#1E293B]">
                          {registration.applicant_profile.permanent_address}
                        </span>
                      </div>
                    )}
                    {registration.applicant_profile.priority_certificate_details && (
                      <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Thông tin giấy chứng nhận ưu tiên:</span>
                        <span className="font-normal text-[#1E293B]">{registration.applicant_profile.priority_certificate_details}</span>
                      </div>
                    )}
                    {registration.applicant_profile.father && (
                      <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Thông tin cha:</span>
                        <span className="font-normal text-[#1E293B]">
                          {[registration.applicant_profile.father.full_name, registration.applicant_profile.father.age && `Tuổi ${registration.applicant_profile.father.age}`, registration.applicant_profile.father.occupation, registration.applicant_profile.father.phone_number].filter(Boolean).join(' · ') || 'N/A'}
                        </span>
                        {(registration.applicant_profile.father.permanent_address || registration.applicant_profile.father.contact_address) && (
                          <span className="font-normal text-[#1E293B]">
                            {[registration.applicant_profile.father.permanent_address, registration.applicant_profile.father.contact_address].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                    {registration.applicant_profile.mother && (
                      <div className="col-span-1 sm:col-span-2 flex flex-col gap-1 border-b border-slate-200/50 pb-1.5">
                        <span className="text-[#64748B]">Thông tin mẹ:</span>
                        <span className="font-normal text-[#1E293B]">
                          {[registration.applicant_profile.mother.full_name, registration.applicant_profile.mother.age && `Tuổi ${registration.applicant_profile.mother.age}`, registration.applicant_profile.mother.occupation, registration.applicant_profile.mother.phone_number].filter(Boolean).join(' · ') || 'N/A'}
                        </span>
                        {(registration.applicant_profile.mother.permanent_address || registration.applicant_profile.mother.contact_address) && (
                          <span className="font-normal text-[#1E293B]">
                            {[registration.applicant_profile.mother.permanent_address, registration.applicant_profile.mother.contact_address].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ═══ EDIT MODE ═══ */
            <form onSubmit={handleSave} className="flex flex-col gap-4 py-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#1E293B]">Số điện thoại</label>
                  <Input
                    type="tel"
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="rounded-xl text-xs h-9"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#1E293B]">Đối tượng ưu tiên</label>
                  <Select value={editPriorityGroup} onValueChange={setEditPriorityGroup}>
                    <SelectTrigger className="rounded-xl text-xs h-9">
                      <SelectValue placeholder="Chọn đối tượng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Không">Không</SelectItem>
                      <SelectItem value="Chính sách">Chính sách</SelectItem>
                      <SelectItem value="Xa nhà">Xa nhà</SelectItem>
                      <SelectItem value="Học lực giỏi">Học lực giỏi</SelectItem>
                      <SelectItem value="Khó khăn">Khó khăn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#1E293B]">Loại phòng nguyện vọng</label>
                  <Input
                    value={editRoomType}
                    onChange={(e) => setEditRoomType(e.target.value)}
                    placeholder="VD: Thường, Máy lạnh..."
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[#1E293B]">Ghi chú nguyện vọng</label>
                  <Input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Ghi chú thêm..."
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                {isStaff && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-[#1E293B]">Học kỳ</label>
                      <Input
                        value={editSemester}
                        onChange={(e) => setEditSemester(e.target.value)}
                        placeholder="VD: HK1, HK2..."
                        className="rounded-xl text-xs h-9"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-[#1E293B]">Năm học</label>
                      <Input
                        value={editAcademicYear}
                        onChange={(e) => setEditAcademicYear(e.target.value)}
                        placeholder="VD: 2025-2026"
                        className="rounded-xl text-xs h-9"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-[#1E293B]">Ngày sinh</label>
                      <Input
                        type="date"
                        value={editDob}
                        onChange={(e) => setEditDob(e.target.value)}
                        className="rounded-xl text-xs h-9"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-[#1E293B]">Giới tính</label>
                      <Select value={editGender} onValueChange={(val: any) => setEditGender(val)}>
                        <SelectTrigger className="rounded-xl text-xs h-9">
                          <SelectValue placeholder="Chọn giới tính" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Nam</SelectItem>
                          <SelectItem value="Female">Nữ</SelectItem>
                          <SelectItem value="Other">Khác</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <ApplicantProfileFields
                value={editApplicantProfile}
                onChange={setEditApplicantProfile}
                className="!rounded-xl"
              />

              <DialogFooter className="border-t border-slate-100 pt-4 flex gap-2 justify-end mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="rounded-xl text-xs"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="rounded-xl text-xs bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white font-semibold"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Lưu thay đổi
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {!isEditing && (
            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => closeModal(false)}
                className="rounded-xl text-xs"
              >
                Đóng
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
