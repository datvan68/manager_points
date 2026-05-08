'use client';
import React, { useEffect } from 'react';
import Popup from './Popup';
import { BookOpen, Hash, Check, Calendar as CalendarIcon, School, PenLine, User } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
                    <div className="space-y-2">
                        <label className="text-[12px] font-semibold text-[#334155] font-['Lexend:Semi_Bold',sans-serif]">
                            Tên lớp <span className="text-[#ef4444]">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <PenLine size={15} color="#94A3B8" />
                            </div>
                            <input 
                                type="text" 
                                {...register('name')}
                                placeholder="Nhập tên lớp"
                                className={`w-full h-[40px] pl-[40px] pr-[16px] py-[11px] bg-[#f8fafc] rounded-[12px] text-[14px] text-[#94a3b8] focus:outline-none focus:ring-2 transition-all ${errors.name ? 'ring-red-500 bg-red-50' : 'focus:ring-primary/20 focus:bg-white focus:text-[#0f172a]'}`}
                            />
                        </div>
                        {errors.name && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.name.message}</p>}
                    </div>

                    {/* Niên khóa */}
                    <div className="space-y-2">
                        <label className="text-[12px] font-semibold text-[#334155] font-['Lexend:Semi_Bold',sans-serif]">
                            Niên khóa <span className="text-[#ef4444]">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <CalendarIcon size={15} color="#94A3B8" />
                            </div>
                            <input 
                                type="text" 
                                {...register('year')}
                                placeholder="Nhập niên khoá"
                                className={`w-full h-[40px] pl-[40px] pr-[16px] py-[11px] bg-[#f8fafc] rounded-[12px] text-[14px] text-[#94a3b8] focus:outline-none focus:ring-2 transition-all ${errors.year ? 'ring-red-500 bg-red-50' : 'focus:ring-primary/20 focus:bg-white focus:text-[#0f172a]'}`}
                            />
                        </div>
                        {errors.year && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.year.message}</p>}
                    </div>

                    <div className="flex gap-5 w-full">
                        {/* Thuộc khoa */}
                        <div className="flex-1 space-y-2">
                            <label className="text-[12px] font-semibold text-[#334155] font-['Lexend:Semi_Bold',sans-serif]">
                                Thuộc Khoa <span className="text-[#ef4444]">*</span>
                            </label>
                            <Controller
                                name="departmentId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className={`w-full h-[40px] px-4 bg-[#f8fafc] border-transparent rounded-[12px] text-[14px] text-[#0f172a] shadow-none transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none focus:bg-white`}>
                                            <SelectValue placeholder="Chọn khoa" />
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="z-[100] min-w-[var(--radix-select-trigger-width)] bg-white rounded-xl shadow-xl border border-gray-100 p-1">
                                            <SelectItem value="CNTT" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Công nghệ TT</SelectItem>
                                            <SelectItem value="KT" className="rounded-md cursor-pointer focus:bg-blue-50 focus:text-blue-700">Kinh tế</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.departmentId && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.departmentId.message}</p>}
                        </div>

                        {/* Khoá */}
                        <div className="flex-1 space-y-2">
                            <label className="text-[12px] font-bold text-[#334155] font-['Roboto:Bold',sans-serif]">
                                Khoá
                            </label>
                            <Controller
                                name="degreeLevel"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className={`w-full h-[40px] px-4 bg-[#f8fafc] border-transparent rounded-[12px] text-[14px] text-[#0f172a] shadow-none transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none focus:bg-white`}>
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
                            {errors.degreeLevel && <p className="text-[11px] font-medium text-red-500 mt-1">{errors.degreeLevel.message}</p>}
                        </div>
                    </div>

                    {/* GVCN */}
                    <div className="space-y-2">
                        <label className="text-[12px] font-bold text-[#334155] font-['Roboto:Bold',sans-serif]">
                            GVCN
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                                <User size={15} color="#94A3B8" />
                            </div>
                            <Controller
                                name="teacherId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className={`w-full h-[40px] pl-[40px] pr-[16px] bg-[#f8fafc] border-transparent rounded-[12px] text-[14px] ${field.value ? 'text-[#0f172a]' : 'text-[#94a3b8]'} shadow-none transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none focus:bg-white`}>
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
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="flex items-center justify-end gap-2.5 pb-6 pt-2 px-6">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="w-[83px] py-[7px] bg-[#f2f2f2] rounded-[8px] text-[14px] font-bold text-[#656565] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:bg-gray-200 transition-colors"
                    >
                        Huỷ
                    </button>
                    <button 
                        type="submit" 
                        className="px-[10px] py-[7px] bg-[#155dfc] rounded-[8px] text-[14px] font-bold text-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:bg-blue-700 transition-colors"
                    >
                        {isEditMode ? "Lưu lại" : "Thêm lớp"}
                    </button>
                </div>
            </form>
        </Popup>
    );
}
