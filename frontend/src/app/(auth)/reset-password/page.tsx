'use client';
import React, { useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, ArrowLeft, Loader2, ArrowRight, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/api/auth-api';

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Mật khẩu phải chứa ít nhất 8 ký tự')
    .regex(/[a-z]/, 'Mật khẩu phải chứa ít nhất 1 chữ thường')
    .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 số')
    .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt'),
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
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: ''
    },
  });

  const passwordValue = watch('password', '');

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'Yếu', percentage: 10, color: 'bg-red-500', textClass: 'text-red-500', meetsLength: false, meetsChars: false };
    
    const meetsLength = pass.length >= 8;
    const hasLower = /[a-z]/.test(pass);
    const hasUpper = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^A-Za-z0-9]/.test(pass);
    const meetsChars = hasLower && hasUpper && hasNumber && hasSpecial;
    
    let strength = 0;
    if (pass.length > 0) strength += 20; // Started typing
    if (meetsLength) strength += 40;
    if (meetsChars) strength += 40;
    
    let label = 'Yếu';
    let color = 'bg-red-500';
    let textClass = 'text-red-500';
    
    if (strength >= 100) {
      label = 'Mạnh';
      color = 'bg-green-500';
      textClass = 'text-green-500';
    } else if (strength >= 60) {
      label = 'Trung bình';
      color = 'bg-yellow-500';
      textClass = 'text-yellow-500';
    }
    
    return { label, percentage: strength, color, textClass, meetsLength, meetsChars };
  };

  const strengthInfo = getPasswordStrength(passwordValue);
  const token = searchParams.get('token');

  const onSubmit = async (data: ResetPasswordFormValues) => {
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

  if (!token) {
    return (
      <>
        {/* Background Gradient */}
        <div 
          className="fixed inset-0 z-0 pointer-events-none" 
          style={{ 
            backgroundImage: "linear-gradient(135deg, rgb(235, 242, 250) 0%, rgb(220, 230, 241) 100%)" 
          }} 
        />

        <div className="w-full max-w-[512px] z-10 px-4">
          {/* Glass Card Container */}
          <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 flex flex-col gap-[32px] items-stretch p-6 sm:p-[49px] relative rounded-[32px] shadow-[0px_4px_20px_rgba(203,213,225,0.4)] text-center">
            
            {/* Warning Circle Icon */}
            <div className="flex justify-center w-full">
              <div className="backdrop-blur-[2px] bg-red-50 border border-red-100 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-red-500">
                <ShieldCheck size={28} />
              </div>
            </div>

            {/* Heading Container */}
            <div className="flex flex-col gap-[12px] items-center">
              <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[28px] tracking-tight leading-[36px]">
                Đường dẫn không hợp lệ
              </h1>
              <p className="font-['Inter'] font-medium text-[#64748b] text-[14px] leading-[22px] max-w-[360px]">
                Thiếu mã xác thực (token) đặt lại mật khẩu hoặc liên kết đã bị thay đổi. Vui lòng sử dụng liên kết chính xác được gửi từ hòm thư của bạn.
              </p>
            </div>

            <div className="flex flex-col gap-[16px] w-full mt-4">
              <Link 
                href="/login" 
                className="bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all w-full font-['Inter'] font-semibold text-[16px]"
              >
                Quay lại trang đăng nhập
              </Link>
            </div>

          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Background Gradient */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none" 
        style={{ 
          backgroundImage: "linear-gradient(135deg, rgb(235, 242, 250) 0%, rgb(220, 230, 241) 100%)" 
        }} 
      />

      <div className="w-full max-w-[512px] z-10 px-4">
        {/* Glass Card Container */}
        <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 flex flex-col gap-[32px] items-stretch p-6 sm:p-[49px] relative rounded-[32px] shadow-[0px_4px_20px_rgba(203,213,225,0.4)]">
          
          {/* Recovery Circle Icon */}
          <div className="flex justify-center w-full">
            <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-[#005bbf]">
              <KeyRound size={24} />
            </div>
          </div>

          {/* Heading Container */}
          <div className="flex flex-col gap-[8px] items-center text-center">
            <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[36px] tracking-tight leading-[44px]">
              Đặt lại mật khẩu
            </h1>
            <p className="font-['Inter'] font-semibold text-[#64748b] text-[14px] leading-[20px] max-w-[340px]">
              Nhập mật khẩu mới của bạn bên dưới để khôi phục quyền truy cập vào Manager Point.
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[24px] w-full">
            <div className="flex flex-col gap-[20px]">
              
              {/* New Password Field */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="pl-[16px]">
                  <label className="font-['Inter'] font-medium text-[#414754] text-[13px]">
                    Mật khẩu mới
                  </label>
                </div>
                <div className="relative w-full">
                  <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[49px] pr-[49px] flex items-center transition-all ${errors.password ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#a3b1cc] outline-none tracking-widest"
                      disabled={isLoading}
                      {...register('password')}
                    />
                  </div>
                  <div className="absolute left-[16px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]">
                    <Lock size={18} />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-[16px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none flex items-center justify-center"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.password.message}</span>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="pl-[16px]">
                  <label className="font-['Inter'] font-medium text-[#414754] text-[13px]">
                    Xác nhận mật khẩu mới
                  </label>
                </div>
                <div className="relative w-full">
                  <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[49px] pr-[49px] flex items-center transition-all ${errors.confirmPassword ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#a3b1cc] outline-none tracking-widest"
                      disabled={isLoading}
                      {...register('confirmPassword')}
                    />
                  </div>
                  <div className="absolute left-[16px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]">
                    <ShieldCheck size={18} />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-[16px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none flex items-center justify-center"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.confirmPassword.message}</span>
                )}
              </div>

              {/* Security Indicator Box */}
              <div className="bg-white/30 border border-white/60 flex flex-col gap-[12px] p-[17px] rounded-[24px] w-full shrink-0">
                <div className="flex gap-[12px] items-center w-full">
                  <div className="bg-[#c1c6d6] flex-[1] h-[6px] relative rounded-full overflow-hidden">
                    <div 
                      className={`absolute left-0 top-0 bottom-0 ${strengthInfo.color} rounded-full transition-all duration-300`} 
                      style={{ width: `${strengthInfo.percentage}%` }} 
                    />
                  </div>
                  <span className={`font-['Inter'] font-medium text-[11px] tracking-[0.55px] whitespace-nowrap ${strengthInfo.textClass}`}>
                    Độ bảo mật: {strengthInfo.label}
                  </span>
                </div>
                <div className="flex flex-col gap-[6px] items-start w-full">
                  <div className="flex gap-[10px] items-center">
                    <div className={`w-[6px] h-[6px] rounded-full transition-all duration-300 ${strengthInfo.meetsLength ? 'bg-green-500' : 'bg-[#c1c6d6]'}`} />
                    <span className={`font-['Inter'] font-medium text-[11px] transition-all duration-300 ${strengthInfo.meetsLength ? 'text-green-600 font-semibold' : 'text-[#414754]'}`}>
                      Ít nhất 8 ký tự
                    </span>
                  </div>
                  <div className="flex gap-[10px] items-center">
                    <div className={`w-[6px] h-[6px] rounded-full transition-all duration-300 ${strengthInfo.meetsChars ? 'bg-green-500' : 'bg-[#c1c6d6]'}`} />
                    <span className={`font-['Inter'] font-medium text-[11px] transition-all duration-300 ${strengthInfo.meetsChars ? 'text-green-600 font-semibold' : 'text-[#414754]'}`}>
                      Bao gồm chữ thường, chữ hoa, số và ký tự đặc biệt
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Action Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className={`bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all mt-2 w-full ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span className="font-['Inter'] font-semibold text-[16px]">Cập nhật mật khẩu</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Back to Login Link */}
            <div className="flex justify-center w-full mt-2">
              <Link href="/login" className="flex items-center gap-[6px] font-['Inter'] font-medium text-[#005bbf] text-[13px] hover:underline transition-all">
                <ArrowLeft size={16} />
                <span>Quay lại trang đăng nhập</span>
              </Link>
            </div>

          </form>

        </div>
      </div>
    </>
  );
}
