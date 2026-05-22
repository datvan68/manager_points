"use client";
import React, { useEffect, useState } from "react";
import Popup from "./Popup";
import {
  BookOpen,
  Hash,
  Check,
  Calendar as CalendarIcon,
  School,
  PenLine,
  User,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { classApi } from "@/api/class-api";
import { departmentApi, Department } from "@/api/department-api";
import { authApi, tokenStorage } from "@/api/auth-api";

interface ClassPopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any | null;
  onSuccess?: () => void;
}

const formSchema = z.object({
  name: z.string().min(1, { message: "Tên lớp bắt buộc nhập." }),
  year: z.string().min(1, { message: "Niên khóa bắt buộc nhập." }),
  departmentId: z.string().min(1, { message: "Vui lòng chọn khoa." }),
  degreeLevel: z.string().min(1, { message: "Vui lòng chọn khoá." }),
  teacherId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ClassPopup({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}: ClassPopupProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      year: "",
      departmentId: "",
      degreeLevel: "Trung cấp",
      teacherId: "",
    },
  });
  useEffect(() => {
    if (isOpen) {
      // Load departments list dynamically
      departmentApi
        .getDepartments()
        .then(setDepartments)
        .catch((err) => console.error("Lỗi khi tải danh sách khoa:", err));

      // Load users list dynamically for GVCN
      const token = tokenStorage.getAccessToken() || "";
      authApi
        .getUsers(token)
        .then(setUsers)
        .catch((err) => console.error("Lỗi khi tải danh sách giáo viên:", err));

      if (initialData) {
        // Trích xuất ID string nếu teacherId là một Object được populate từ backend
        let extractedTeacherId = "";
        if (initialData.teacherId) {
          if (typeof initialData.teacherId === "object") {
            extractedTeacherId = initialData.teacherId._id || initialData.teacherId.id || "";
          } else {
            extractedTeacherId = initialData.teacherId;
          }
        }

        reset({
          name: initialData.name || "",
          year: initialData.year || "",
          departmentId: initialData.departmentId || "",
          degreeLevel: initialData.degreeLevel || "Trung cấp",
          teacherId: extractedTeacherId,
        });
      } else {
        reset({
          name: "",
          year: "",
          departmentId: "",
          degreeLevel: "Trung cấp",
          teacherId: "",
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data: FormValues) => {
    console.log("Submitting class:", data);
    try {
      const payload = {
        class_name: data.name,
        class_year: data.year,
        dept_id: data.departmentId,
        class_type: data.degreeLevel,
        user_id: data.teacherId || null,
      };

      if (initialData && initialData._id) {
        await classApi.updateClass(initialData._id, payload);
        toast.success(`Đã cập nhật lớp: ${data.name}`);
      } else {
        await classApi.createClass(payload);
        toast.success(`Đã thêm lớp học mới: ${data.name}`);
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      toast.error("Có lỗi xảy ra: " + error.message);
    }
  };

  const isEditMode = !!(initialData && initialData._id);

  return (
    <Popup isOpen={isOpen} onClose={onClose} className="max-w-120" contentClassName="overflow-visible">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col w-full">
        {/* Header */}
        <div className="bg-[rgba(248,250,252,0.5)] border-b border-[#f1f5f9] border-dashed flex items-center justify-between pb-6 pt-6 px-6 relative w-full">
          <div className="flex flex-col gap-1 w-full">
            <h3 className="font-['Lexend:Bold',sans-serif] font-bold text-[#0f172a] text-[18px] leading-[28px]">
              {isEditMode ? "Sửa Lớp" : "Thêm Lớp"}
            </h3>
            <p className="font-['Lexend:Regular',sans-serif] font-normal text-[#64748b] text-[12px] leading-[16px]">
              Điền thông tin lớp học vào biểu mẫu bên dưới.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6 relative w-full">
          {/* Tên lớp */}
          <Input
            label="Tên lớp"
            required
            placeholder="Nhập tên lớp"
            {...register("name")}
            error={errors.name?.message}
          />

          {/* Niên khóa */}
          <Input
            label="Niên khóa"
            required
            placeholder="Nhập niên khoá"
            {...register("year")}
            error={errors.year?.message}
          />

          <div className="flex gap-5 w-full">
            {/* Thuộc khoa */}
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 px-1">
                Thuộc Khoa <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select
                    key={departments.length}
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn khoa" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1"
                    >
                      {departments.map((dept) => (
                        <SelectItem
                          key={dept._id}
                          value={dept._id}
                          className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700"
                        >
                          {dept.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId && (
                <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">
                  {errors.departmentId.message}
                </p>
              )}
            </div>

            {/* Khoá */}
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700 px-1">
                Khoá
              </label>
              <Controller
                name="degreeLevel"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn khoá" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1"
                    >
                      <SelectItem
                        value="Trung cấp"
                        className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700"
                      >
                        Trung cấp
                      </SelectItem>
                      <SelectItem
                        value="Cao đẳng"
                        className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700"
                      >
                        Cao đẳng
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.degreeLevel && (
                <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">
                  {errors.degreeLevel.message}
                </p>
              )}
            </div>
          </div>

          {/* GVCN */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 px-1">
              GVCN
            </label>
            <Controller
              name="teacherId"
              control={control}
              render={({ field }) => (
                <Select
                  key={users.length}
                  onValueChange={field.onChange}
                  value={field.value || undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn giáo viên chủ nhiệm" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1"
                  >
                    {users.map((u) => {
                      const displayName = `${u.user_name || u.username || "Chưa rõ tên"} (${u.email || "Không có email"})`;
                      return (
                        <SelectItem
                          key={u._id || u.id}
                          value={u._id || u.id}
                          className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700"
                        >
                          {displayName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* BOTTOM Section: Actions */}
        <div className="flex items-center justify-end gap-3 pb-6 pt-2 px-6">
          <Button variant="secondary" onClick={onClose} type="button">
            Huỷ
          </Button>
          <Button type="submit">{isEditMode ? "Lưu lại" : "Thêm lớp"}</Button>
        </div>
      </form>
    </Popup>
  );
}
