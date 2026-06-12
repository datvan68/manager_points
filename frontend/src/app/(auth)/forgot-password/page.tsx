'use client';
import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/api/auth-api';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không đúng định dạng'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      toast.success('Yêu cầu đã được gửi', {
        description: `Một liên kết đặt lại mật khẩu đã được gửi đến email của bạn nếu nó tồn tại trong hệ thống.`,
      });
      setIsSuccess(true);
    } catch (err: any) {
      toast.error('Gửi yêu cầu thất bại', {
        description: err.message || 'Đã xảy ra lỗi.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
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
            
            {/* Checkmark Circle Icon */}
            <div className="flex justify-center w-full">
              <div className="backdrop-blur-[2px] bg-emerald-50 border border-emerald-100 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-emerald-600">
                <ShieldCheck size={28} />
              </div>
            </div>

            {/* Heading Container */}
            <div className="flex flex-col gap-[12px] items-center text-center">
              <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[32px] tracking-tight leading-[40px]">
                Kiểm tra email của bạn
              </h1>
              <p className="font-['Inter'] font-medium text-[#64748b] text-[14px] leading-[22px] max-w-[360px]">
                Nếu email bạn nhập tồn tại trên hệ thống, chúng tôi đã gửi một hướng dẫn thiết lập lại mật khẩu vào hòm thư của bạn.
              </p>
            </div>

            <div className="flex flex-col gap-[16px] w-full text-center">
              <p className="text-xs text-slate-500">
                Vui lòng kiểm tra cả thư mục thư rác (Spam) nếu bạn không thấy email trong vài phút.
              </p>
              
              <Link 
                href="/login" 
                className="bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all mt-4 w-full font-['Inter'] font-semibold text-[16px]"
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
          
          {/* Email Circle Icon */}
          <div className="flex justify-center w-full">
            <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-[#005bbf]">
              <Mail size={24} />
            </div>
          </div>

          {/* Heading Container */}
          <div className="flex flex-col gap-[8px] items-center text-center">
            <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[36px] tracking-tight leading-[44px]">
              Quên mật khẩu?
            </h1>
            <p className="font-['Inter'] font-semibold text-[#64748b] text-[14px] leading-[20px] max-w-[340px]">
              Nhập địa chỉ email liên kết với tài khoản của bạn và chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[24px] w-full">
            <div className="flex flex-col gap-[20px]">
              
              {/* Email Field */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="pl-[16px]">
                  <label className="font-['Inter'] font-medium text-[#414754] text-[13px]">
                    Địa chỉ Email
                  </label>
                </div>
                <div className="relative w-full">
                  <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[49px] pr-[25px] flex items-center transition-all ${errors.email ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                    <input 
                      type="email" 
                      placeholder="name@example.com"
                      className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#a3b1cc] outline-none"
                      disabled={isLoading}
                      {...register('email')}
                    />
                  </div>
                  <div className="absolute left-[16px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]">
                    <Mail size={18} />
                  </div>
                </div>
                {errors.email && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.email.message}</span>
                )}
              </div>

            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className={`bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all mt-2 w-full ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span className="font-['Inter'] font-semibold text-[16px]">Gửi liên kết đặt lại</span>
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

            {/* Support Notice */}
            <div className="flex justify-center w-full mt-4 border-t border-white/60 pt-4">
              <span className="font-['Inter'] font-semibold text-[#566069] text-[13px] text-center">
                Bạn gặp khó khăn?{' '}
                <Link href="#" className="text-[#005bbf] hover:underline font-bold">
                  Liên hệ hỗ trợ
                </Link>
              </span>
            </div>

          </form>

        </div>
      </div>
    </>
  );
}
