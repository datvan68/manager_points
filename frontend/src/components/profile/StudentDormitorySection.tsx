"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Pencil, RefreshCw, Save, X } from "lucide-react";
import { dormitoryApi } from "@/api/dormitory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type ParentProfile = {
  full_name?: string;
  age?: string | number;
  permanent_address?: string;
  contact_address?: string;
  occupation?: string;
  phone_number?: string;
};

type Registration = {
  _id?: string;
  registration_code?: string;
  semester?: string;
  academic_year?: string;
  status?: string;
  phone_number?: string;
  priority_group?: string;
  preference?: { room_type?: string; building_id?: string; notes?: string };
  assigned_room_name?: string;
  assigned_bed_code?: string;
  room_id?: { room_code?: string; room_name?: string } | string;
  bed_id?: { bed_code?: string } | string;
  active_contract?: { start_date?: string; end_date?: string; status?: string };
  active_contract_id?: string;
  applicant_profile?: {
    ethnicity?: string;
    religion?: string;
    citizen_id_number?: string;
    citizen_id_issue_date?: string;
    citizen_id_issue_place?: string;
    permanent_address?: string;
    priority_certificate_details?: string;
    father?: ParentProfile;
    mother?: ParentProfile;
  };
};

type SelfRegistrationResponse = {
  has_dormitory_registration?: boolean;
  registration?: Registration | null;
  editable_fields?: string[];
  history?: Registration[];
} & Registration;

type RegistrationClient = typeof dormitoryApi.registrations & {
  getMine: () => Promise<SelfRegistrationResponse>;
  updateMine: (dto: Record<string, unknown>) => Promise<SelfRegistrationResponse>;
};

const client = dormitoryApi.registrations as RegistrationClient;

type FormValues = Record<string, string>;

const fields = [
  ["phone_number", "Số điện thoại"],
  ["preference.room_type", "Loại phòng mong muốn"],
  ["preference.building_id", "Tòa nhà mong muốn"],
  ["preference.notes", "Ghi chú"],
  ["priority_group", "Nhóm ưu tiên"],
  ["applicant_profile.ethnicity", "Dân tộc"],
  ["applicant_profile.religion", "Tôn giáo"],
  ["applicant_profile.citizen_id_number", "Số CCCD/CMND"],
  ["applicant_profile.citizen_id_issue_date", "Ngày cấp CCCD/CMND"],
  ["applicant_profile.citizen_id_issue_place", "Nơi cấp CCCD/CMND"],
  ["applicant_profile.permanent_address", "Địa chỉ thường trú"],
  ["applicant_profile.priority_certificate_details", "Thông tin giấy chứng nhận ưu tiên"],
  ["applicant_profile.father.full_name", "Họ tên cha"],
  ["applicant_profile.father.age", "Tuổi cha"],
  ["applicant_profile.father.permanent_address", "Địa chỉ thường trú của cha"],
  ["applicant_profile.father.contact_address", "Địa chỉ liên hệ của cha"],
  ["applicant_profile.father.occupation", "Nghề nghiệp của cha"],
  ["applicant_profile.father.phone_number", "Số điện thoại cha"],
  ["applicant_profile.mother.full_name", "Họ tên mẹ"],
  ["applicant_profile.mother.age", "Tuổi mẹ"],
  ["applicant_profile.mother.permanent_address", "Địa chỉ thường trú của mẹ"],
  ["applicant_profile.mother.contact_address", "Địa chỉ liên hệ của mẹ"],
  ["applicant_profile.mother.occupation", "Nghề nghiệp của mẹ"],
  ["applicant_profile.mother.phone_number", "Số điện thoại mẹ"],
] as const;

function getPath(object: unknown, path: string): string {
  const value = path.split(".").reduce<any>((current, key) => current?.[key], object);
  return value === undefined || value === null ? "" : String(value);
}

function toForm(registration: Registration): FormValues {
  return Object.fromEntries(fields.map(([path]) => [path, getPath(registration, path)]));
}

function assignPath(target: Record<string, any>, path: string, value: string) {
  const parts = path.split(".");
  const last = parts.pop()!;
  const parent = parts.reduce<Record<string, any>>((current, part) => (current[part] ??= {}), target);
  parent[last] = value;
}

function registrationFrom(response: SelfRegistrationResponse): Registration | null {
  if (response.registration) return response.registration;
  return response._id ? response : null;
}

export function StudentDormitorySection() {
  const [response, setResponse] = useState<SelfRegistrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<FormValues>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await client.getMine();
      setResponse(current);
      const registration = registrationFrom(current);
      if (registration) setValues(toForm(registration));
    } catch (cause: any) {
      setError(cause?.message || "Không thể tải thông tin đăng ký KTX.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const registration = response ? registrationFrom(response) : null;
  const editableFields = useMemo(() => new Set(response?.editable_fields ?? []), [response]);
  const isEditable = (path: string) => editableFields.has(path);

  const save = async () => {
    const changed: Record<string, unknown> = {};
    for (const [path] of fields) {
      if (isEditable(path) && values[path] !== getPath(registration, path)) assignPath(changed, path, values[path]);
    }
    if (!Object.keys(changed).length) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await client.updateMine(changed);
      toast.success("Đã cập nhật thông tin đăng ký KTX.");
      setEditing(false);
      await load();
    } catch (cause: any) {
      // Keep form values intact so server-side validation feedback never loses user input.
      toast.error(cause?.message || "Không thể lưu thông tin KTX.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton aria-label="Đang tải thông tin KTX" className="h-56 w-full rounded-2xl bg-white/20" />;
  if (error) return <section className="rounded-2xl border border-red-200 bg-red-50/80 p-5" aria-label="Lỗi tải KTX"><div className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />Không thể tải thông tin KTX</div><p className="mt-1 text-xs text-red-700">{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Thử lại</Button></section>;
  if (!registration || response?.has_dormitory_registration === false) return null;

  const roomName = registration.assigned_room_name || (typeof registration.room_id === "object" ? registration.room_id.room_name || registration.room_id.room_code : "");
  const bedCode = registration.assigned_bed_code || (typeof registration.bed_id === "object" ? registration.bed_id.bed_code : "");
  return <section className="rounded-2xl border border-white/70 bg-white/40 shadow-sm shadow-slate-300/40 backdrop-blur-md" aria-labelledby="student-dormitory-heading">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-5 py-4">
      <div><h2 id="student-dormitory-heading" className="flex items-center gap-2 text-[15px] font-bold text-[#1E293B]"><Building2 className="h-5 w-5 text-[#1A73E8]" />Thông tin KTX</h2><p className="mt-1 text-xs text-[#64748B]">Mã đơn: {registration.registration_code || "Chưa có"}</p></div>
      {editing ? <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => { setValues(toForm(registration)); setEditing(false); }}><X className="mr-1 h-3.5 w-3.5" />Hủy</Button><Button type="button" size="sm" disabled={saving} onClick={() => void save()}><Save className="mr-1 h-3.5 w-3.5" />{saving ? "Đang lưu..." : "Lưu"}</Button></div> : editableFields.size > 0 ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3.5 w-3.5" />Chỉnh sửa</Button> : null}
    </div>
    <div className="space-y-6 p-5">
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Detail label="Trạng thái" value={registration.status} /><Detail label="Học kỳ" value={registration.semester} /><Detail label="Năm học" value={registration.academic_year} /><Detail label="Phòng đã xếp" value={roomName} /><Detail label="Giường đã xếp" value={bedCode} /><Detail label="Hợp đồng" value={registration.active_contract?.status || (registration.active_contract_id ? "Đang có hiệu lực" : "Chưa có")} /></div>
      <div><h3 className="mb-3 text-sm font-bold text-[#1E293B]">Thông tin đơn và người liên hệ</h3><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{fields.map(([path, label]) => <Input key={path} label={label} multiline={path.endsWith("address") || path.endsWith("details") || path.endsWith("notes")} rows={2} value={editing ? values[path] ?? "" : getPath(registration, path) || "Chưa cập nhật"} readOnly={!editing || !isEditable(path) || saving} onChange={(event) => setValues((current) => ({ ...current, [path]: event.target.value }))} />)}</div></div>
    </div>
  </section>;
}

function Detail({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-xl border border-white/70 bg-white/50 px-3 py-2"><p className="text-[11px] font-medium text-[#64748B]">{label}</p><p className="mt-0.5 text-xs font-semibold text-[#1E293B]">{value || "Chưa cập nhật"}</p></div>;
}
