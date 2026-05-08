'use client';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import { Construction } from 'lucide-react';

export default function PlaceholderPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
           <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6">
              <Construction size={40} />
           </div>
           <h1 className="text-2xl font-black text-gray-800 mb-2">Đang phát triển</h1>
           <p className="text-gray-500 max-w-md">Tính năng này hiện đang trong quá trình xây dựng. Vui lòng quay lại sau!</p>
        </div>
      </main>
    </div>
  );
}
