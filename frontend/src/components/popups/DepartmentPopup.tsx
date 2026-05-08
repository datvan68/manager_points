'use client';
import React, { useEffect } from 'react';
import Popup from './Popup';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

interface DepartmentPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: FormValues | null;
}

const formSchema = z.object({
    name: z.string().min(2, { message: "Tên khoa phải có ít nhất 2 ký tự." }),
    code: z.string().min(2, { message: "Mã khoa phải có ít nhất 2 ký tự." }).max(10, { message: "Mã khoa tối đa 10 ký tự." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function DepartmentPopup({ isOpen, onClose, initialData }: DepartmentPopupProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            code: ''
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset(initialData);
            } else {
                reset({ name: '', code: '' });
            }
        }
    }, [isOpen, initialData, reset]);

    const onSubmit = (data: FormValues) => {
        console.log('Submitting department:', data);
        if (initialData) {
            toast.success(`Đã cập nhật khoa: ${data.name}`);
        } else {
            toast.success(`Đã thêm khoa mới: ${data.name}`);
        }
        onClose();
    };

    const isEditMode = !!initialData;

    return (
        <Popup isOpen={isOpen} onClose={onClose} title={isEditMode ? "Sửa Khoa" : "Thêm Khoa"}>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pt-2">
                <div className="flex flex-col gap-5 px-1">
                    <div className="space-y-1.5">
                        <label className="text-[14px] font-bold text-[#1e293b]">
                            Tên khoa
                        </label>
                        <input 
                            type="text" 
                            {...register('name')}
                            className={`w-full px-4 py-3 bg-[#f8fafc] border rounded-xl text-[14px] text-[#475569] focus:outline-none focus:ring-2 transition-all ${errors.name ? 'border-red-500 focus:ring-red-200' : 'border-[#e2e8f0] focus:ring-primary/20 focus:border-primary'}`}
                            placeholder="Vui lòng nhập tên khoa"
                        />
                        {errors.name && <p className="text-[11px] font-medium text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[14px] font-bold text-[#1e293b]">
                            Mã khoa
                        </label>
                        <input 
                            type="text" 
                            {...register('code')}
                            className={`w-full px-4 py-3 bg-[#f8fafc] border rounded-xl text-[14px] text-[#475569] focus:outline-none focus:ring-2 transition-all uppercase placeholder:normal-case ${errors.code ? 'border-red-500 focus:ring-red-200' : 'border-[#e2e8f0] focus:ring-primary/20 focus:border-primary'}`}
                            placeholder="NHẬP MÃ KHOA"
                        />
                        {errors.code ? (
                             <p className="text-[11px] font-medium text-red-500 mt-1">{errors.code.message}</p>
                        ) : (
                             <p className="text-[12px] text-[#94a3b8] mt-1">Mã khoa nên viết tắt, không dấu và viết hoa.</p>
                        )}
                    </div>
                </div>

                {/* BOTTOM Section: Actions */}
                <div className="pt-4 border-t border-[#f1f5f9] flex items-center justify-end gap-3 mt-2">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="min-w-[83px] px-[16px] py-[8px] bg-[#f2f2f2] rounded-[8px] text-[14px] font-bold text-[#656565] transition-all hover:bg-gray-200 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1)]"
                    >
                        Huỷ
                    </button>
                    <button 
                        type="submit" 
                        className="px-[16px] py-[8px] rounded-[8px] text-[14px] font-bold text-white bg-[#155dfc] hover:bg-blue-700 transition-all flex items-center justify-center shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]"
                    >
                        {isEditMode ? "Lưu thay đổi" : "Thêm khoa"}
                    </button>
                </div>
            </form>
        </Popup>
    );
}
