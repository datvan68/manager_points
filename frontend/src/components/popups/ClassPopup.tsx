'use client';
import React, { useEffect } from 'react';
import Popup from './Popup';
import { BookOpen, Hash, Check, Calendar as CalendarIcon, School, PenLine, User } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';

interface ClassPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: FormValues | null;
}

const formSchema = z.object({
    name: z.string().min(1, { message: "Tên lớp bắt buộc nhập." }),
    year: z.string().min(1, { message: "Niên khóa bắt buộc nhập." }),
    departmentId: z.string().min(1, { message: "Vui lòng chọn khoa." }),
    degreeLevel: z.string().min(1, { message: "Vui lòng chọn khoá." }),
    teacherId: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function ClassPopup({ isOpen, onClose, initialData }: ClassPopupProps) {
    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            year: '',
            departmentId: '',
            degreeLevel: 'Trung cấp',
            teacherId: ''
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset(initialData);
            } else {
                reset({ name: '', year: '', departmentId: '', degreeLevel: 'Trung cấp', teacherId: '' });
            }
        }
    }, [isOpen, initialData, reset]);

    const onSubmit = (data: FormValues) => {
        console.log('Submitting class:', data);
        if (initialData) {
            toast.success(`Đã cập nhật lớp: ${data.name}`);
        } else {
            toast.success(`Đã thêm lớp học mới: ${data.name}`);
        }
        onClose();
    };

    const isEditMode = !!initialData;

    return (
        <Popup isOpen={isOpen} onClose={onClose} className="max-w-[480px]">
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
                        {...register('name')}
                        error={errors.name?.message}
                    />

                    {/* Niên khóa */}
                    <Input 
                        label="Niên khóa"
                        required
                        placeholder="Nhập niên khoá"
                        {...register('year')}
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn khoa" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                            <SelectItem value="CNTT" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Công nghệ TT</SelectItem>
                                            <SelectItem value="KT" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Kinh tế</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.departmentId && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.departmentId.message}</p>}
                        </div>

                        {/* Khoá */}
                        <div className="flex-1 flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-slate-700 px-1">Khoá</label>
                            <Controller
                                name="degreeLevel"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn khoá" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                            <SelectItem value="Trung cấp" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Trung cấp</SelectItem>
                                            <SelectItem value="Cao đẳng" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Cao đẳng</SelectItem>
                                            <SelectItem value="Đại học" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Đại học</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.degreeLevel && <p className="px-1 text-[12px] font-medium text-red-500 mt-0.5">{errors.degreeLevel.message}</p>}
                        </div>
                    </div>

                    {/* GVCN */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-slate-700 px-1">GVCN</label>
                        <Controller
                            name="teacherId"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Chọn giáo viên chủ nhiệm" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                        <SelectItem value="GV01" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Trần Lệ Xuân</SelectItem>
                                        <SelectItem value="GV02" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Nguyễn Văn Quyết</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="flex items-center justify-end gap-3 pb-6 pt-2 px-6">
                    <Button 
                        variant="secondary"
                        onClick={onClose}
                        type="button"
                    >
                        Huỷ
                    </Button>
                    <Button 
                        type="submit" 
                    >
                        {isEditMode ? "Lưu lại" : "Thêm lớp"}
                    </Button>
                </div>
            </form>
        </Popup>
    );
}
