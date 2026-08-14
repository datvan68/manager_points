'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { dormitoryApi, SelfDormitoryRegistration, DormRegistration } from '@/api/dormitory-api';
import { Student } from '@/api/student-api';
import DormitoryRegistrationEditModal from '@/components/dormitory/DormitoryRegistrationEditModal';
import type { EditForm } from '@/components/dormitory/DormitoryRegistrationEditModal';
import { compactApplicantProfile } from '@/components/dormitory/PublicDormitoryRegistrationModal';

interface StudentDormitoryCardProps {
  registrationData: SelfDormitoryRegistration | null;
  student?: Student | null;
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

export function formatVndPrice(price: number | null | undefined): string {
  if (typeof price !== 'number' || price <= 0 || isNaN(price)) return 'Chưa có giá';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export function getEffectiveRoomLabel(registration: DormRegistration): string {
  if (registration.room_id && typeof registration.room_id === 'object') return registration.room_id.room_name || registration.room_id.room_code || 'Chưa xếp phòng';
  if (registration.assigned_room_name) return registration.assigned_room_name;
  return 'Chưa xếp phòng';
}

export function getEffectiveBedLabel(registration: DormRegistration): string {
  if (registration.bed_id && typeof registration.bed_id === 'object') return registration.bed_id.bed_code || 'Chưa xếp giường';
  return 'Chưa xếp giường';
}

export function getRoomPrice(registration: DormRegistration): number | null {
  if (registration.room_id && typeof registration.room_id === 'object' && typeof registration.room_id.room_price === 'number') return registration.room_id.room_price;
  return null;
}

export function formatDateString(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  } catch { return dateStr; }
}

export default function StudentDormitoryCard({ registrationData, student, onRefresh, className }: StudentDormitoryCardProps) {
  const { user } = useAuth();
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const registration = registrationData?.registration;

  if (!registrationData?.has_dormitory_registration || !registration) {
    return <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }} className={`bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-4 sm:gap-5 w-full min-w-0 ${className || ''}`}>
      <div className="flex items-center gap-[8px] w-full"><div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" /><h2 className="font-sans font-bold text-[#1E293B] text-[15px] sm:text-[16px] tracking-tight leading-[24px]">Thông tin KTX</h2></div>
      <p className="text-[13px] font-semibold text-[#64748B]">Không ở trong KTX</p>
    </motion.div>;
  }

  const roleName = String(user?.role || user?.roleName || '').toLowerCase();
  const roleCode = String(user?.roleCode || '').toUpperCase();
  const permissions: string[] = user?.permissions || [];
  const isStaff = roleName.includes('admin') || roleName.includes('supervisor') || roleCode.includes('ADMIN') || roleCode.includes('SUPERVISOR') || permissions.includes('DORM_REG_UPDATE');
  const studentUserId = student?.user_id && typeof student.user_id === 'object' ? (student.user_id as any)?._id || (student.user_id as any)?.id : student?.user_id?.toString();
  const isSelfStudent = (roleName.includes('student') || roleCode === 'STUDENT') && (studentUserId === user?.id || user?.studentId === student?._id);
  const isEligibleToEdit = isStaff || (isSelfStudent && (registration.editable_fields || []).length > 0);
  const roomLabel = getEffectiveRoomLabel(registration);
  const bedLabel = getEffectiveBedLabel(registration);
  const formattedPrice = formatVndPrice(getRoomPrice(registration));

  const submitUpdate = async (row: DormRegistration, form: EditForm) => {
    if (isSelfStudent && !isStaff) {
      const applicantProfile = compactApplicantProfile(form.applicant_profile);
      const payload: any = { phone_number: form.phone_number.trim(), priority_group: form.priority_group, preference: { room_type: form.room_type, notes: form.notes } };
      if (applicantProfile) payload.applicant_profile = applicantProfile;
      await dormitoryApi.registrations.updateMine(payload);
      return;
    }
    if (isStaff) {
      const applicantProfile = compactApplicantProfile(form.applicant_profile);
      const payload: any = {
        phone_number: form.phone_number.trim(),
        priority_group: form.priority_group,
        preference: { room_type: form.room_type, notes: form.notes },
        semester: form.semester,
        academic_year: form.academic_year,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || 'Male',
      };
      if (applicantProfile) payload.applicant_profile = applicantProfile;
      await dormitoryApi.registrations.update(row._id, 'FORMAL', payload);
      return;
    }
    throw new Error('Bạn không có quyền cập nhật thông tin đơn này.');
  };

  return <>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }} className={`bg-white/40 backdrop-blur-md border border-white/70 p-4 sm:p-6 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col gap-4 sm:gap-5 w-full min-w-0 ${className || ''}`}>
      <div className="flex items-center justify-between w-full"><div className="flex items-center gap-[8px]"><div className="bg-[#1A73E8] h-[20px] w-[5px] rounded-full" /><h2 className="font-sans font-bold text-[#1E293B] text-[15px] sm:text-[16px] tracking-tight leading-[24px]">Thông tin KTX</h2></div><button ref={triggerButtonRef} onClick={() => setModalOpen(true)} aria-label="Xem chi tiết KTX" title="Xem chi tiết KTX" className="w-[28px] h-[28px] flex items-center justify-center rounded-xl bg-white/50 border border-white/80 hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out shadow-sm cursor-pointer shrink-0 text-[#64748B] hover:text-[#1A73E8]"><ChevronRight className="w-[16px] h-[16px]" /></button></div>
      <div className="flex flex-col gap-[12px] w-full min-w-0">
        <div className="flex items-center justify-between w-full border-b border-white/40 pb-2 gap-3"><span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">Phòng</span><span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">{roomLabel}</span></div>
        <div className="flex items-center justify-between w-full border-b border-white/40 pb-2 gap-3"><span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">Giường</span><span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">{bedLabel}</span></div>
        <div className="flex items-center justify-between w-full border-b border-white/40 pb-2 gap-3"><span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">Giá tiền</span><span className="font-sans font-bold text-[#1A73E8] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">{formattedPrice}</span></div>
        <div className="flex items-center justify-between w-full pb-0 gap-3"><span className="font-sans font-medium text-[#64748B] text-[12px] leading-[18px] shrink-0">Học kỳ</span><span className="font-sans font-bold text-[#1E293B] text-[13px] leading-[18px] text-right truncate min-w-0 flex-1">{registration.semester} - {registration.academic_year}</span></div>
      </div>
    </motion.div>
    <DormitoryRegistrationEditModal open={modalOpen} registration={registration} canEdit={isEligibleToEdit} requirePersonalDetails={false} onOpenChange={setModalOpen} restoreFocusRef={triggerButtonRef} onSubmit={submitUpdate} onSuccess={onRefresh} successMessage="Cập nhật thông tin KTX thành công!" />
  </>;
}
