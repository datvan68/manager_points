'use client';
import React, { useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/auth-api';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự'),
  confirmPassword: z.string().min(8, 'Xác nhận mật khẩu phải chứa ít nhất 8 ký tự')
}).superRefine(({ password, confirmPassword }, ctx) => {
  if (confirmPassword !== password) {
    ctx.addIssue({
      code: "custom",
      message: "Khớp mật khẩu không đúng",
      path: ['confirmPassword']
    });
  }
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: ''
    },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    const token = searchParams.get('token');
    if (!token) {
      toast.error('Token không hợp lệ', {
        description: 'Vui lòng sử dụng liên kết từ email để đặt lại mật khẩu.',
      });
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, data.password);
      toast.success('Thiết lập mật khẩu thành công', {
        description: 'Vui lòng đăng nhập với mật khẩu mới của bạn.',
      });
      router.push('/login');
    } catch (err: any) {
      toast.error('Đặt lại mật khẩu thất bại', {
        description: err.message || 'Token không hợp lệ hoặc đã hết hạn.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] flex flex-col items-center justify-center z-10">
      
      {/* White Card Container */}
      <div className="bg-white rounded-[12px] shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] w-full p-[41px] flex flex-col gap-[32px]">
        
        {/* Header Section */}
        <div className="flex flex-col gap-[8px]">
          <h1 className="font-['Inter'] font-bold text-[#0f172a] text-[30px] tracking-[-0.75px] leading-[36px]">
            Thiết lập mật khẩu mới
          </h1>
          <p className="font-['Inter'] font-normal text-[#64748b] text-[14px] leading-[20px]">
            Vui lòng nhập mật khẩu mới cho tài khoản của bạn. Đảm bảo mật khẩu có ít nhất 8 ký tự bao gồm chữ và số.
          </p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[24px] w-full">
          
          {/* New Password Field */}
          <div className="flex flex-col gap-[8px]">
            <label className="font-['Inter'] font-medium text-[#334155] text-[14px] px-[4px]">
              Mật khẩu mới
            </label>
            <div className={`bg-[#f1f5f9] rounded-[8px] h-[56px] relative flex items-center border transition-all ${errors.password ? 'border-red-500 bg-white ring-1 ring-red-500' : 'border-transparent focus-within:border-[#135bec] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
              <div className="absolute left-[20px] text-[#94a3b8] pointer-events-none flex items-center">
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Nhập mật khẩu mới"
                className="w-full h-full bg-transparent text-[#0f172a] text-[14px] tracking-wide font-['Inter'] placeholder:text-[#94a3b8] outline-none pl-[48px] pr-[48px]"
                disabled={isLoading}
                {...register('password')}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-[16px] text-[#94a3b8] hover:text-slate-600 outline-none flex items-center justify-center"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="text-red-500 text-sm mt-1">{errors.password.message}</span>}
          </div>

          {/* Confirm Password Field */}
          <div className="flex flex-col gap-[8px]">
            <label className="font-['Inter'] font-medium text-[#334155] text-[14px] px-[4px]">
              Xác nhận mật khẩu mới
            </label>
            <div className={`bg-[#f1f5f9] rounded-[8px] h-[56px] relative flex items-center border transition-all ${errors.confirmPassword ? 'border-red-500 bg-white ring-1 ring-red-500' : 'border-transparent focus-within:border-[#135bec] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#135bec]'}`}>
              <div className="absolute left-[20px] text-[#94a3b8] pointer-events-none flex items-center">
                <ShieldCheck size={18} />
              </div>
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Nhập lại mật khẩu mới"
                className="w-full h-full bg-transparent text-[#0f172a] text-[14px] tracking-wide font-['Inter'] placeholder:text-[#94a3b8] outline-none pl-[48px] pr-[48px]"
                disabled={isLoading}
                {...register('confirmPassword')}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-[16px] text-[#94a3b8] hover:text-slate-600 outline-none flex items-center justify-center"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <span className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</span>}
          </div>

          {/* Action Button */}
          <div className="pt-[8px]">
            <button 
              type="submit"
              disabled={isLoading}
              className={`bg-[#135bec] hover:bg-blue-700 text-white rounded-[8px] h-[48px] w-full flex items-center justify-center relative shadow-[0_10px_15px_-3px_rgba(19,91,236,0.2),0_4px_6px_-4px_rgba(19,91,236,0.2)] transition-all ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <span className="font-['Inter'] font-semibold text-[16px]">Đổi mật khẩu</span>
              )}
            </button>
          </div>

          {/* Back to Login Link */}
          <div className="flex justify-center pt-[8px]">
            <Link href="/login" className="flex items-center gap-[4px] font-['Inter'] font-medium text-[#135bec] text-[14px] hover:text-blue-700 transition-colors">
              <ArrowLeft size={16} strokeWidth={2.5} />
              Quay lại Đăng nhập
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}
