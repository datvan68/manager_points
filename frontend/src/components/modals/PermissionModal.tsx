import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
  initialData?: any;
  groups: { id: string; name: string }[];
  defaultGroupId?: string;
  onSave: (data: any) => Promise<void>;
}

export default function PermissionModal({
  isOpen,
  onClose,
  isEditing = false,
  initialData = null,
  groups,
  defaultGroupId,
  onSave,
}: PermissionModalProps) {
  const [formData, setFormData] = useState({
    code: "",
    groupId: "",
    name: "",
    description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData && isEditing) {
        setFormData({
          code: (initialData.code || "").toUpperCase(),
          groupId: initialData.groupId || defaultGroupId || "",
          name: initialData.name || "",
          description: initialData.description || initialData.desc || "",
        });
      } else {
        setFormData({
          code: "",
          groupId: defaultGroupId || "",
          name: "",
          description: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData, isEditing, defaultGroupId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, groupId: value }));
    if (errors.groupId) {
      setErrors((prev) => ({ ...prev, groupId: "" }));
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const cleanValue = rawValue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .toUpperCase();

    setFormData((prev) => ({ ...prev, code: cleanValue }));
    if (errors.code) {
      setErrors((prev) => ({ ...prev, code: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.code.trim()) {
      newErrors.code = "Vui lòng nhập Mã quyền";
    }
    if (!formData.groupId) {
      newErrors.groupId = "Vui lòng chọn Nhóm quyền";
    }
    if (!formData.name.trim()) {
      newErrors.name = "Vui lòng nhập Tên quyền";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      try {
        const group = groups.find((g) => g.id === formData.groupId);
        await onSave({
          ...formData,
          module: group ? group.name : formData.groupId,
        });
        onClose();
      } catch (error: any) {
        toast.error("Lỗi khi lưu: " + error.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center p-4"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-[560px] flex flex-col pointer-events-auto overflow-hidden font-sans"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <h2 className="text-xl font-bold text-slate-800">
                  {isEditing ? "Cập nhật Quyền" : "Thêm Quyền mới"}
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="px-6 py-6 bg-white overflow-visible">
                <form
                  id="permission-form"
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6"
                >
                  {/* Grid 2 Column */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Mã quyền */}
                    <Input
                      label="Mã quyền"
                      required
                      error={errors.code}
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleCodeChange}
                      placeholder="VD: view_report"
                      containerClassName="w-full"
                      className="bg-[#f8fafc] "
                    />

                    {/* Thuộc nhóm */}
                    <Select
                      label="Thuộc nhóm"
                      required
                      error={errors.groupId}
                      value={formData.groupId}
                      onValueChange={handleSelectChange}
                    >
                      <SelectTrigger className="h-10 bg-[#f8fafc] border-slate-200/60">
                        <SelectValue placeholder="Chọn nhóm quyền" />
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        <SelectGroup>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tên quyền */}
                  <Input
                    label="Tên quyền"
                    required
                    error={errors.name}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="VD: Xem báo cáo thống kê"
                    className="bg-[#f8fafc]"
                  />

                  {/* Mô tả chi tiết */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700">
                      Mô tả chi tiết
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Mô tả chi tiết về phạm vi và tác động của quyền này..."
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
                    />
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                <Button
                  type="button"
                  variant="cancel"
                  onClick={onClose}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  form="permission-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Lưu Quyền
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
