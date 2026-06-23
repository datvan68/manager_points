'use client';
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Mail, ArrowRight, ArrowLeft, Loader2, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/api/auth-api';

const emailSchema = z.object({
  email: z.string().min(1, 'Email hoặc mã sinh viên không được để trống'),
});

const newPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt'),
  confirmPassword: z.string().min(1, 'Xác nhận mật khẩu không được để trống'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});

type EmailFormValues = z.infer<typeof emailSchema>;
type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  // App State
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [isLoading, setIsLoading] = useState(false);
  
  // Data State
  const [email, setEmail] = useState('');
  const [requestId, setRequestId] = useState('');
  const [resetToken, setResetToken] = useState('');
  
  // OTP State
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Email Form
  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  // New Password Form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
  } = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Step 1: Request OTP
  const onSubmitEmail = async (data: EmailFormValues) => {
    setIsLoading(true);
    try {
      const res = await authApi.requestPasswordReset(data.email);
      setEmail(data.email);
      setRequestId(res.requestId);
      setResendCountdown(res.resendAfter || 60);
      toast.success(res.message || 'OTP đã được gửi');
      setStep(2);
      
      // Auto focus first OTP input after transition
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 100);
    } catch (err: any) {
      toast.error('Gửi yêu cầu thất bại', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP Input
  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    // Allow pasting
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      for (let i = 0; i < pastedData.length; i++) {
        if (index + i < 6) newOtp[index + i] = pastedData[i];
      }
      setOtp(newOtp);
      // Focus next empty input or the last one
      const nextIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newOtp[index] = value;
      setOtp(newOtp);
      if (value !== '' && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('Vui lòng nhập đủ 6 số OTP');
      return;
    }
    setIsLoading(true);
    try {
      const res = await authApi.verifyPasswordResetOtp(requestId, code);
      setResetToken(res.resetToken);
      sessionStorage.setItem('temp_reset_token', res.resetToken);
      setStep(3);
    } catch (err: any) {
      toast.error('Xác minh thất bại', { description: err.message });
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Auto verify when 6 digits are entered
  useEffect(() => {
    const code = otp.join('');
    if (code.length === 6 && step === 2 && !isLoading) {
      const timer = setTimeout(() => {
        handleVerifyOtp();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [otp, step]);

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    try {
      const res = await authApi.resendPasswordResetOtp(requestId);
      setResendCountdown(res.resendAfter || 60);
      toast.success('Đã gửi lại OTP');
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      toast.error('Gửi lại thất bại', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Complete Password Reset
  const onSubmitPassword = async (data: NewPasswordFormValues) => {
    setIsLoading(true);
    const token = resetToken || sessionStorage.getItem('temp_reset_token') || '';
    try {
      await authApi.completePasswordReset(token, data.newPassword, data.confirmPassword);
      toast.success('Đổi mật khẩu thành công');
      sessionStorage.removeItem('temp_reset_token');
      setStep(4);
    } catch (err: any) {
      toast.error('Đổi mật khẩu thất bại', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-0 pointer-events-none" 
        style={{ backgroundImage: "linear-gradient(135deg, rgb(235, 242, 250) 0%, rgb(220, 230, 241) 100%)" }} 
      />

      <div className="w-full max-w-[512px] z-10 px-4">
        <div className="backdrop-blur-[6px] bg-white/45 border border-white/75 flex flex-col gap-[32px] items-stretch p-6 sm:p-[49px] relative rounded-[32px] shadow-[0px_4px_20px_rgba(203,213,225,0.4)]">
          
          {step === 1 && (
            <>
              <div className="flex justify-center w-full">
                <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-[#005bbf]">
                  <Mail size={24} />
                </div>
              </div>

              <div className="flex flex-col gap-[8px] items-center text-center">
                <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[36px] tracking-tight leading-[44px]">Quên mật khẩu?</h1>
                <p className="font-['Inter'] font-semibold text-[#64748b] text-[14px] leading-[20px] max-w-[340px]">
                  Nhập địa chỉ email hoặc mã sinh viên liên kết với tài khoản của bạn để nhận mã xác minh.
                </p>
              </div>

              <form onSubmit={handleSubmitEmail(onSubmitEmail)} className="flex flex-col gap-[24px] w-full">
                <div className="flex flex-col gap-[8px] w-full">
                  <div className="pl-[16px]"><label className="font-['Inter'] font-medium text-[#414754] text-[13px]">Email / Mã sinh viên</label></div>
                  <div className="relative w-full">
                    <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[49px] pr-[25px] flex items-center transition-all ${emailErrors.email ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                      <input 
                        type="text" 
                        placeholder="Nhập email hoặc mã sinh viên"
                        className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#a3b1cc] outline-none"
                        disabled={isLoading}
                        {...registerEmail('email')}
                      />
                    </div>
                    <div className="absolute left-[16px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]"><Mail size={18} /></div>
                  </div>
                  {emailErrors.email && <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{emailErrors.email.message}</span>}
                </div>
                <button type="submit" disabled={isLoading} className={`bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all w-full ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}>
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <><span className="font-['Inter'] font-semibold text-[16px]">Nhận mã xác minh</span><ArrowRight size={18} /></>}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex justify-center w-full">
                <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-[#005bbf]">
                  <ShieldCheck size={28} />
                </div>
              </div>

              <div className="flex flex-col gap-[8px] items-center text-center">
                <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[32px] tracking-tight leading-[40px]">Nhập mã OTP</h1>
                <p className="font-['Inter'] font-medium text-[#64748b] text-[14px] leading-[22px] max-w-[360px]">
                  Mã OTP 6 chữ số đã được gửi đến email của bạn.
                </p>
              </div>

              <div className="flex flex-col gap-[24px] w-full mt-2">
                <div className="flex justify-center gap-2 sm:gap-4">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={6}
                      value={digit}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      disabled={isLoading}
                      className="w-[45px] h-[55px] sm:w-[55px] sm:h-[65px] bg-white/60 border border-white/80 rounded-xl text-center text-[24px] font-bold text-[#0f172a] focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20 outline-none transition-all disabled:opacity-50"
                    />
                  ))}
                </div>
                
                <button 
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otp.join('').length !== 6} 
                  className={`bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all w-full ${(isLoading || otp.join('').length !== 6) ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <><span className="font-['Inter'] font-semibold text-[16px]">Xác nhận</span><ArrowRight size={18} /></>}
                </button>

                <div className="flex justify-center w-full">
                  <button 
                    type="button" 
                    onClick={handleResendOtp}
                    disabled={resendCountdown > 0 || isLoading}
                    className="font-['Inter'] font-medium text-[#005bbf] text-[14px] hover:underline disabled:text-[#94a3b8] disabled:hover:no-underline transition-all"
                  >
                    {resendCountdown > 0 ? `Gửi lại mã sau ${resendCountdown}s` : 'Gửi lại mã OTP'}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex justify-center w-full">
                <div className="backdrop-blur-[2px] bg-white/50 border border-white/80 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-[#005bbf]">
                  <Lock size={24} />
                </div>
              </div>

              <div className="flex flex-col gap-[8px] items-center text-center">
                <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[32px] tracking-tight leading-[40px]">Tạo mật khẩu mới</h1>
                <p className="font-['Inter'] font-medium text-[#64748b] text-[14px] leading-[22px] max-w-[360px]">
                  Vui lòng nhập mật khẩu mới cho tài khoản của bạn.
                </p>
              </div>

              <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="flex flex-col gap-[24px] w-full">
                <div className="flex flex-col gap-[16px] w-full">
                  <div className="flex flex-col gap-[8px] w-full">
                    <div className="pl-[16px]"><label className="font-['Inter'] font-medium text-[#414754] text-[13px]">Mật khẩu mới</label></div>
                    <div className="relative w-full">
                      <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[49px] pr-[25px] flex items-center transition-all ${passwordErrors.newPassword ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                        <input 
                          type="password" 
                          placeholder="Nhập mật khẩu mới"
                          className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#a3b1cc] outline-none"
                          disabled={isLoading}
                          {...registerPassword('newPassword')}
                        />
                      </div>
                      <div className="absolute left-[16px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]"><Lock size={18} /></div>
                    </div>
                    {passwordErrors.newPassword && <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{passwordErrors.newPassword.message}</span>}
                  </div>

                  <div className="flex flex-col gap-[8px] w-full">
                    <div className="pl-[16px]"><label className="font-['Inter'] font-medium text-[#414754] text-[13px]">Xác nhận mật khẩu</label></div>
                    <div className="relative w-full">
                      <div className={`bg-white/40 border border-white/70 rounded-full h-[48px] pl-[49px] pr-[25px] flex items-center transition-all ${passwordErrors.confirmPassword ? 'border-red-500 ring-1 ring-red-500 bg-red-50/10' : 'focus-within:border-[#005bbf] focus-within:ring-1 focus-within:ring-[#005bbf] focus-within:bg-white/80'}`}>
                        <input 
                          type="password" 
                          placeholder="Xác nhận mật khẩu mới"
                          className="w-full h-full bg-transparent text-[#0f172a] text-[14px] font-['Inter'] font-semibold placeholder:text-[#a3b1cc] outline-none"
                          disabled={isLoading}
                          {...registerPassword('confirmPassword')}
                        />
                      </div>
                      <div className="absolute left-[16px] top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-[#94a3b8]"><Lock size={18} /></div>
                    </div>
                    {passwordErrors.confirmPassword && <span className="text-red-500 text-[12px] mt-1 pl-[16px]">{passwordErrors.confirmPassword.message}</span>}
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className={`bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all w-full ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}>
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <><span className="font-['Inter'] font-semibold text-[16px]">Cập nhật mật khẩu</span></>}
                </button>
              </form>
            </>
          )}

          {step === 4 && (
            <>
              <div className="flex justify-center w-full">
                <div className="backdrop-blur-[2px] bg-emerald-50 border border-emerald-100 flex items-center justify-center w-[64px] h-[64px] rounded-full shadow-[0px_1px_2px_rgba(0,0,0,0.05)] shrink-0 text-emerald-600">
                  <CheckCircle2 size={28} />
                </div>
              </div>

              <div className="flex flex-col gap-[12px] items-center text-center">
                <h1 className="font-['Inter'] font-semibold text-[#111c2d] text-[32px] tracking-tight leading-[40px]">Đổi mật khẩu thành công</h1>
                <p className="font-['Inter'] font-medium text-[#64748b] text-[14px] leading-[22px] max-w-[360px]">
                  Mật khẩu của bạn đã được cập nhật. Bạn có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống.
                </p>
              </div>

              <div className="flex flex-col gap-[16px] w-full mt-4">
                <button 
                  onClick={() => router.push('/login')}
                  className="bg-[#005bbf] hover:bg-[#004da3] text-white rounded-full h-[48px] flex items-center justify-center gap-2 relative shadow-[0px_4px_6px_rgba(0,0,0,0.05)] transition-all w-full font-['Inter'] font-semibold text-[16px]"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </>
          )}

          {step < 4 && (
            <div className="flex justify-center w-full mt-2">
              <button 
                type="button"
                onClick={() => step === 1 ? router.push('/login') : setStep((s) => s - 1 as 1|2|3)} 
                className="flex items-center gap-[6px] font-['Inter'] font-medium text-[#005bbf] text-[13px] hover:underline transition-all disabled:opacity-50"
                disabled={isLoading}
              >
                <ArrowLeft size={16} />
                <span>{step === 1 ? 'Quay lại trang đăng nhập' : 'Quay lại'}</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
