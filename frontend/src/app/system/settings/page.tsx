"use client";

import React from "react";
import { RouteGuard } from "@/components/guards/RouteGuard";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MailSettingsForm from "./_components/MailSettingsForm";

export default function SystemSettingsPage() {
  return (
    <RouteGuard
      anyPermission={[
        "SYSTEM_ADMIN",
        "SYSTEM_MAIL_CONFIG_MANAGE"
      ]}
      useDynamicMapping={false}
      failClosed={true}
    >
      <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC]">
            <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
              
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
                <p className="text-[13px] text-slate-500 mt-1">Quản lý các cấu hình cốt lõi của hệ thống Manager Point</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <MailSettingsForm />
              </div>

            </div>
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
