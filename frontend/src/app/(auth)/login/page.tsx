'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi, tokenStorage } from '@/api/auth-api';
import { useAuth } from '@/providers/auth-provider';
import { isStudentRole, isTeacherRole } from '@/utils/role.util';

const INVALID_LOGIN_MESSAGE = 'Tài khoản hoặc mật khẩu không chính xác.';

const loginSchema = z.object({
  email: z.string().min(1, 'Email hoặc Mã sinh viên không được để trống'),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự'),
  remember: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Read saved login credentials for pre-fill
  const savedEmail = tokenStorage.getSavedEmail();
  const savedRemember = tokenStorage.getRemember();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: savedEmail || '',
      password: '',
      remember: savedRemember,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const result = await authApi.login(data.email, data.password, !!data.remember);

      // Set remember flag before setAccessToken so it stores in the right place
      tokenStorage.setRemember(!!data.remember);

      // Save or clear email for pre-fill on next visit
      if (data.remember) {
        tokenStorage.setSavedEmail(data.email);
      } else {
        tokenStorage.clearSavedEmail();
      }

      tokenStorage.setAccessToken(result.access_token);
      tokenStorage.setUser(result.user);

      // Update global auth state
      checkAuth();

      toast.success('Đăng nhập thành công', {
        description: `Chào mừng ${result.user.username} quay trở lại!`,
      });
      if (isStudentRole(result.user) || isTeacherRole(result.user)) {
        router.push('/students/tasks');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      const description = err?.status === 401
        ? INVALID_LOGIN_MESSAGE
        : err.message || 'Vui lòng kiểm tra lại thông tin đăng nhập.';

      toast.error('Đăng nhập thất bại', {
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Background Gradient */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(141.429deg, rgb(235, 242, 250) 0%, rgb(220, 230, 241) 100%)"
        }}
      />

      <div className="w-full max-w-[512px] z-10 px-4">
        {/* Glass Card Container */}
        <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 flex flex-col gap-[32px] items-stretch p-6 sm:p-[49px] relative rounded-[24px] shadow-[0px_4px_20px_rgba(203,213,225,0.4)]">

          {/* Trust Badge */}
          <div className="flex justify-center w-full">
            <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center px-[29px] py-[9px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0">
              <span className="font-['Inter'] font-medium text-[#64748b] text-[11px] tracking-[0.275px] whitespace-nowrap">
                HỌC SINH SINH VIÊN
              </span>
            </div>
          </div>

          {/* Heading Container */}
          <div className="flex flex-col gap-[8px] items-center text-center">
            <h1 className="font-['Inter'] font-medium text-[#1e293b] text-[28px] sm:text-[36px] tracking-tight leading-[36px] sm:leading-[44px]">
              Chào mừng trở lại
            </h1>
            <p className="font-['Inter'] font-normal text-[#718096] text-[14px] leading-[20px]">
              Vui lòng nhập thông tin của bạn để tiếp tục
            </p>
          </div>

          {/* Main Form Section */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[24px] w-full">
            <div className="flex flex-col gap-[24px]">

              {/* Email / Username Field */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="pl-[16px]">
                  <label className="font-['Inter'] font-medium text-[#566069] text-[11px] tracking-[1.1px] uppercase">
                    Tài khoản
                  </label>
                </div>
                <div className="relative w-full">
                  <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[57px] pr-[25px] flex items-center transition-all ${errors.email ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#1a73e8] focus-within:ring-1 focus-within:ring-[#1a73e8] focus-within:bg-white/80'}`}>
                    <input
                      type="text"
                      placeholder="Email hoặc mã sinh viên"
                      className="w-full h-full bg-transparent text-[#334155] text-[14px] font-['Inter'] font-medium placeholder:text-[#a3b1cc] outline-none"
                      disabled={isLoading}
                      {...register('email')}
                    />
                  </div>
                  <div className="absolute left-[20px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]">
                    <Mail size={18} />
                  </div>
                </div>
                {errors.email && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.email.message}</span>
                )}
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-[8px] w-full">
                <div className="flex justify-between items-center px-[16px]">
                  <label className="font-['Inter'] font-medium text-[#566069] text-[11px] tracking-[1.1px] uppercase">
                    MẬT KHẨU
                  </label>
                  <Link href="/forgot-password" className="font-['Inter'] font-medium text-[#005bbf] text-[11px] tracking-[0.55px] hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative w-full">
                  <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[57px] pr-[57px] flex items-center transition-all ${errors.password ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#1a73e8] focus-within:ring-1 focus-within:ring-[#1a73e8] focus-within:bg-white/80'}`}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full h-full bg-transparent text-[#334155] text-[14px] font-['Inter'] font-medium placeholder:text-[#a3b1cc] outline-none tracking-widest"
                      disabled={isLoading}
                      {...register('password')}
                    />
                  </div>
                  <div className="absolute left-[20px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]">
                    <Lock size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-[20px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{errors.password.message}</span>
                )}
              </div>

            </div>

            {/* Remember Me Checkbox */}
            <div className="flex gap-[12px] items-center px-[16px] py-[8px]">
              <input
                type="checkbox"
                id="remember"
                className="w-[20px] h-[20px] border border-white/70 bg-white/40 rounded-[6px] text-[#1a73e8] focus:ring-[#1a73e8] cursor-pointer"
                disabled={isLoading}
                {...register('remember')}
              />
              <label htmlFor="remember" className="font-['Inter'] font-medium text-[#64748b] text-[14px] cursor-pointer select-none">
                Ghi nhớ đăng nhập
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`bg-[#1a73e8] hover:bg-[#155fc0] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_10px_15px_-3px_rgba(26,115,232,0.3),0px_4px_6px_-4px_rgba(26,115,232,0.3)] transition-all ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <span className="font-['Inter'] font-semibold text-[14px]">Đăng nhập</span>
              )}
            </button>

            {/* Footer / bottom registration link */}
            {/* 
            <div className="flex justify-center w-full mt-2">
              <span className="font-['Inter'] font-semibold text-[#566069] text-[14px]">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="text-[#005bbf] font-bold hover:underline">
                  Tạo tài khoản
                </Link>
              </span>
            </div>
            */}

          </form>

        </div>
      </div>
    </>
  );
}
