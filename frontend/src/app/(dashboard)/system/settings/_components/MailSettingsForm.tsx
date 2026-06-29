"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Shield, ShieldAlert, Server, Mailbox, Send, CheckCircle2, Loader2, Save, User } from "lucide-react";
import { toast } from "sonner";
import { systemApi, MailSettings } from "@/api/system-api";

const mailSettingsSchema = z.object({
  host: z.string().min(1, "Vui lòng nhập SMTP Host"),
  port: z.number().min(1, "Port không hợp lệ").max(65535, "Port không hợp lệ"),
  secure: z.boolean(),
  user: z.string().min(1, "Vui lòng nhập tài khoản (username)"),
  pass: z.string().optional(),
  from: z.string().min(1, "Vui lòng nhập email người gửi (FROM)"),
});

export default function MailSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const form = useForm<z.infer<typeof mailSettingsSchema>>({
    resolver: zodResolver(mailSettingsSchema),
    defaultValues: {
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      from: "",
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await systemApi.getMailSettings();
      form.reset({
        host: data.host || "",
        port: data.port || 587,
        secure: data.secure || false,
        user: data.user || "",
        pass: "",
        from: data.from || "",
      });
      setHasPassword(data.hasPassword || false);
    } catch (error: any) {
      toast.error("Lỗi khi tải cấu hình MAIL: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof mailSettingsSchema>) => {
    try {
      setSaving(true);
      await systemApi.updateMailSettings({
        ...values,
        pass: values.pass || undefined, // send undefined if empty
      });
      toast.success("Đã lưu cấu hình MAIL SMTP thành công");
      
      // If user typed a new password, they now have one
      if (values.pass) {
        setHasPassword(true);
        form.setValue("pass", ""); // Clear password field after save
      }
    } catch (error: any) {
      toast.error("Lỗi khi lưu cấu hình: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const onTestConnection = async () => {
    try {
      setTesting(true);
      // Validate form first
      const isValid = await form.trigger();
      if (!isValid) {
        toast.error("Vui lòng điền đúng các trường bắt buộc trước khi kiểm tra.");
        return;
      }
      
      const values = form.getValues();
      await systemApi.testMailConnection({
        ...values,
        pass: values.pass || undefined,
      });
      toast.success("Kiểm tra kết nối SMTP thành công!");
    } catch (error: any) {
      toast.error("Kết nối SMTP thất bại: " + error.message);
    } finally {
      setTesting(false);
    }
  };

  const onSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email nhận thư kiểm tra hợp lệ.");
      return;
    }
    
    try {
      setSendingTest(true);
      const values = form.getValues();
      await systemApi.sendTestMail(testEmail, {
        ...values,
        pass: values.pass || undefined,
      });
      toast.success(`Đã gửi email thử nghiệm đến ${testEmail} thành công!`);
      setIsTestModalOpen(false);
      setTestEmail("");
    } catch (error: any) {
      toast.error("Gửi email thử nghiệm thất bại: " + error.message);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const { formState: { errors } } = form;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cấu hình MAIL SMTP</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Cấu hình máy chủ gửi email tự động (Nodemailer) của hệ thống</p>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* SMTP Host */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                SMTP Host
              </label>
              <input
                {...form.register("host")}
                placeholder="VD: smtp.gmail.com"
                className={`w-full px-3 py-2 text-[13px] rounded-lg border ${errors.host ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50/50`}
              />
              {errors.host && <p className="text-xs text-red-500">{errors.host.message}</p>}
            </div>

            {/* SMTP Port */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                Port
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="number"
                  {...form.register("port", { valueAsNumber: true })}
                  placeholder="VD: 587"
                  className={`w-32 px-3 py-2 text-[13px] rounded-lg border ${errors.port ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50/50`}
                />
                
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      {...form.register("secure")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </div>
                  <span className="text-[13px] font-medium text-slate-700 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Secure (SSL/TLS)
                  </span>
                </label>
              </div>
              {errors.port && <p className="text-xs text-red-500">{errors.port.message}</p>}
              <p className="text-[11px] text-slate-500">Gợi ý: Dùng Port 465 với SSL (bật Secure) hoặc Port 587 với TLS (tắt Secure).</p>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Tài khoản SMTP
              </label>
              <input
                {...form.register("user")}
                placeholder="VD: noreply@domain.com"
                className={`w-full px-3 py-2 text-[13px] rounded-lg border ${errors.user ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50/50`}
              />
              {errors.user && <p className="text-xs text-red-500">{errors.user.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                  Mật khẩu SMTP / App Password
                </span>
                {hasPassword && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Đã lưu cấu hình
                  </span>
                )}
              </label>
              <input
                type="password"
                {...form.register("pass")}
                placeholder={hasPassword ? "Nhập để thay đổi mật khẩu..." : "Nhập mật khẩu SMTP (bắt buộc)"}
                className={`w-full px-3 py-2 text-[13px] rounded-lg border ${errors.pass ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50/50`}
              />
              {errors.pass && <p className="text-xs text-red-500">{errors.pass.message}</p>}
              {hasPassword && (
                <p className="text-[11px] text-amber-600 italic">Để trống nếu không muốn thay đổi mật khẩu.</p>
              )}
            </div>

            {/* From Address */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Mailbox className="w-3.5 h-3.5 text-slate-400" />
                Địa chỉ gửi (MAIL_FROM)
              </label>
              <input
                {...form.register("from")}
                placeholder='VD: "Manager Point" <noreply@domain.com>'
                className={`w-full px-3 py-2 text-[13px] rounded-lg border ${errors.from ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-slate-50/50`}
              />
              {errors.from && <p className="text-xs text-red-500">{errors.from.message}</p>}
              <p className="text-[11px] text-slate-500">Tên hiển thị và email gửi tới người dùng. Nên khớp với domain của Tài khoản SMTP.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-end">
            <button
              type="button"
              onClick={onTestConnection}
              disabled={testing || saving}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-[13px] font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              Test Connection
            </button>

            <button
              type="button"
              onClick={() => setIsTestModalOpen(true)}
              disabled={sendingTest || saving}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 text-[13px] font-semibold rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Gửi mail thử
            </button>

            <button
              type="submit"
              disabled={saving || testing}
              className="px-6 py-2 bg-[#1A73E8] text-white text-[13px] font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>

      {/* Modal gửi email thử */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Gửi email thử nghiệm</h3>
            <p className="text-[13px] text-slate-500 mb-4">
              Nhập địa chỉ email để nhận thư test. Hệ thống sẽ sử dụng cấu hình hiện tại trong form để thử nghiệm gửi.
            </p>
            
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="VD: user@example.com"
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-4"
              autoFocus
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onSendTestEmail}
                disabled={sendingTest}
                className="px-4 py-2 bg-indigo-600 text-white text-[13px] font-semibold rounded-xl hover:bg-indigo-700 flex items-center gap-2"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gửi ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
