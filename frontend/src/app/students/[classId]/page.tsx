'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Users, 
  ArrowLeft, 
  Download, 
  Trash2, 
  Edit, 
  X,
  User,
  ArrowRightLeft
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import StudentPopup from '@/components/popups/StudentPopup';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { CustomPagination } from '@/components/ui/pagination';
import {
  classes,
  mockStudents
} from '@/lib/mock-data/students';

function ClassStudentsPageContent() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const selectedClass = classes.find(c => c.id === classId) || { name: 'Lớp học', id: classId, students: 0 };

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const itemsPerPage = 50;

  const filteredStudents = mockStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         student.id.includes(searchTerm);
    const matchesStatus = activeTab === 'Tất cả' || 
                         (activeTab === 'Đang học' && student.status === 'Đang học') ||
                         (activeTab === 'Bảo lưu' && student.status === 'Bảo lưu') ||
                         (activeTab === 'Thôi học' && student.status === 'Thôi học');
    
    const matchesClass = (student as any).classId === classId;
    
    return matchesSearch && matchesStatus && matchesClass;
  });

  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === paginatedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(paginatedStudents.map(s => s.id));
    }
  };

  const handleExport = () => {
    toast.success(`Đã xuất file ${selectedStudentIds.length} sinh viên thành công.`);
  };

  const handleDelete = () => {
    toast.success(`Đã xóa ${selectedStudentIds.length} sinh viên thành công.`);
    setSelectedStudentIds([]);
  };

  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <main className="flex-1 p-4 overflow-hidden flex flex-col bg-gray-50 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
              <div className="px-6 py-4 bg-white border-b border-dashed border-gray-200 flex items-center justify-between shrink-0 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bottom-0 w-64 bg-gradient-to-l from-blue-500/5 to-transparent pointer-events-none" />
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 z-10 w-full max-w-screen-2xl mx-auto">
                      <div className="flex items-center gap-4 flex-1">
                        <button 
                            onClick={() => router.push('/students')} 
                            className="flex items-center gap-1.5 text-gray-900 hover:text-primary transition-colors font-bold text-[16px] shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" /> {selectedClass.name}
                        </button>
                        
                        <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
                           <div className="flex items-center gap-1.5">
                               <Users className="w-4 h-4 text-gray-400" />
                               <span>Sĩ số: <span className="font-semibold text-gray-700">{selectedClass.students} Sinh viên</span></span>
                           </div>
                           <div className="flex items-center gap-1.5">
                               <User className="w-4 h-4 text-gray-400" />
                               <span>GVCN: <span className="font-semibold text-gray-700">Nguyễn Văn A</span></span>
                           </div>
                        </div>
                      </div>
                      
                      <div className="flex-1" />
                      <button 
                          onClick={() => { setEditingStudent(null); setIsStudentPopupOpen(true); }}
                          className="flex items-center gap-2 px-[10px] py-[7px] text-[14px] font-bold text-white bg-[#155dfc] rounded-[10px] hover:bg-blue-700 shadow-sm transition-colors z-10 whitespace-nowrap"
                      >
                          <Plus className="w-4 h-4" /> Thêm sinh viên
                      </button>
                  </div>
              </div>

              {/* Filter Bar */}
              <div className="px-6 py-3 bg-white/50 backdrop-blur-[2px] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 rounded-xl my-1 w-full max-w-screen-2xl mx-auto">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-[14px] h-[14px]" />
                        <input 
                            type="text" 
                            placeholder="Tìm theo tên hoặc mã SV..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[rgba(255,255,255,0.56)] border-none rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all h-[33px]" 
                        />
                    </div>
                    
                    {selectedStudentIds.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button onClick={handleExport} className="flex items-center gap-1.5 px-[13px] py-[7px] text-[14px] font-medium text-[#16a34a] bg-[#f0fdf4] border border-[#16a34a] rounded-lg hover:bg-green-100 transition-all">
                                <Download size={15} /> Xuất ({selectedStudentIds.length})
                            </button>
                            <button onClick={handleDelete} className="flex items-center gap-1.5 px-[14px] py-[7px] text-[14px] font-medium text-[#ef4444] bg-[#fef2f2] border border-[#ef4444] rounded-lg hover:bg-red-100 transition-all">
                                <Trash2 size={15} /> Xóa ({selectedStudentIds.length})
                            </button>
                        </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center min-h-[41px]">
                      <span className="text-[12px] font-semibold text-[#64748b]">Trạng thái:</span>
                      <div className="flex flex-wrap gap-1 items-center bg-transparent">
                          {['Tất cả', 'Đang học', 'Bảo lưu', 'Thôi học'].map((status) => (
                              <button 
                                  key={status} 
                                  onClick={() => setActiveTab(status)}
                                  className={`px-3 py-1.5 text-[12px] transition-all rounded-[8px] ${
                                      activeTab === status 
                                          ? 'bg-white text-[#135bec] shadow-sm font-bold' 
                                          : 'text-[#64748b] font-medium hover:text-gray-700 hover:bg-gray-50'
                                  }`}
                              >
                                  {status}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Student Table */}
              <div className="flex-1 overflow-hidden bg-white border border-[#f1f5f9] rounded-[12px] shadow-sm max-w-screen-2xl w-full mx-auto relative flex flex-col mb-4">
                  <div className="overflow-x-auto flex-1 h-full">
                  <table className="w-full text-left border-collapse min-w-max">
                      <thead className="bg-[#f8fafc] sticky top-0 z-20 border-b border-[#f1f5f9]">
                          <tr>
                              <th className="px-4 py-4 w-16 text-center">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 text-primary w-4 h-4"
                                    checked={paginatedStudents.length > 0 && selectedStudentIds.length === paginatedStudents.length}
                                    onChange={toggleSelectAll} 
                                  />
                              </th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">MÃ SV</th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">HỌ VÀ TÊN</th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">NGÀY SINH</th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">GIỚI TÍNH</th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase">ĐRL</th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase text-center">TRẠNG THÁI</th>
                              <th className="px-6 py-4 text-[12px] font-bold text-[#64748b] tracking-[0.6px] uppercase text-right">HÀNH ĐỘNG</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                         {isLoading || isDataLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="h-[49px]">
                                    <td className="px-4 text-center"><Skeleton className="w-4 h-4 rounded mx-auto" /></td>
                                    <td className="px-6"><Skeleton className="w-20 h-4" /></td>
                                    <td className="px-6 py-2"><Skeleton className="w-48 h-9 rounded-full" /></td>
                                    <td className="px-6"><Skeleton className="w-24 h-4" /></td>
                                    <td className="px-6"><Skeleton className="w-16 h-4" /></td>
                                    <td className="px-6"><Skeleton className="w-16 h-4" /></td>
                                    <td className="px-6 text-center"><Skeleton className="w-20 h-5 rounded-full mx-auto" /></td>
                                    <td className="px-6 text-right"><Skeleton className="w-6 h-6 rounded-md ml-auto" /></td>
                                </tr>
                            ))
                         ) : (
                           paginatedStudents.map((student, idx) => (
                              <motion.tr
                                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1, delay: idx * 0.05 }}
                                  key={student.id} className="hover:bg-blue-50/20 transition-colors group h-[49px]"
                              >
                                  <td className="px-4 text-center">
                                      <input 
                                        type="checkbox" 
                                        className="rounded border-[#cbd5e1] text-primary w-4 h-4" 
                                        checked={selectedStudentIds.includes(student.id)}
                                        onChange={() => toggleStudentSelection(student.id)}
                                      />
                                  </td>
                                  <td className="px-6 font-mono text-[14px] text-[#64748b]">{student.id}</td>
                                  <td className="px-6 py-2">
                                      <div className="flex items-center gap-[12px]">
                                          <div className="w-[36px] h-[36px] rounded-full overflow-hidden border border-[#f1f5f9] shrink-0">
                                              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${student.id}&backgroundColor=b6e3f4`} alt="Avatar" className="w-full h-full object-cover" />
                                          </div>
                                          <div>
                                              <div className="font-semibold text-[14px] text-[#0f172a]">{student.name}</div>
                                              <div className="text-[10px] text-[#64748b] lowercase">{student.name.split(' ').pop()}.nv21@school.edu.vn</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 text-[14px] text-[#475569]">{student.dob}</td>
                                  <td className="px-6 text-[14px] text-[#475569]">{student.gender}</td>
                                  <td className="px-6">
                                      <div className="flex items-center gap-[4px] font-bold">
                                          <span className="text-[14px] text-[#334155]">{student.score}</span>
                                          <span className="text-[10px] text-[#94a3b8] font-normal">/100</span>
                                      </div>
                                  </td>
                                  <td className="px-6 text-center">
                                      <span className={`inline-flex items-center justify-center px-[8px] py-[3.5px] rounded-full font-bold text-[12px] ${
                                          student.status === 'Đang học' ? 'bg-[#f0fdf4] text-[#16a34a]' :
                                          student.status === 'Bảo lưu' ? 'bg-[#fefce8] text-[#ca8a04]' :
                                          'bg-[#fef2f2] text-[#ef4444]'
                                      }`}>
                                          {student.status}
                                      </span>
                                  </td>
                                  <td className="px-6 text-right">
                                      <Drawer 
                                          direction="right" 
                                          open={openDrawerId === student.id} 
                                          onOpenChange={(isOpen) => setOpenDrawerId(isOpen ? student.id : null)}
                                      >
                                          <DrawerTrigger asChild>
                                              <button className="flex items-center justify-center w-[34px] h-[34px] ml-auto text-gray-400 hover:text-primary transition-colors hover:bg-gray-100 rounded-lg">
                                                  <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={2.5} />
                                              </button>
                                          </DrawerTrigger>

                                          <DrawerContent className="w-[448px] h-full bg-white outline-none flex flex-col items-stretch overflow-hidden">
                                              <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9] bg-white shrink-0">
                                                  <DrawerTitle className="text-lg font-semibold text-[#0f172a]">Chi tiết sinh viên</DrawerTitle>
                                                  <DrawerDescription className="sr-only">Thông tin chi tiết về sinh viên được chọn.</DrawerDescription>
                                                  <DrawerClose asChild>
                                                      <button className="w-7 h-7 flex justify-center items-center text-gray-500 hover:text-gray-700 transition-colors">
                                                          <X className="w-5 h-5" />
                                                      </button>
                                                  </DrawerClose>
                                              </div>
                                              
                                              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                                                  <div className="flex items-center gap-4">
                                                      <div className="w-16 h-16 rounded-full overflow-hidden border border-[#e2e8f0]">
                                                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${student.id}&backgroundColor=b6e3f4`} alt="Avatar" className="w-full h-full object-cover" />
                                                      </div>
                                                      <div>
                                                          <h2 className="text-xl font-bold text-[#0f172a]">{student.name}</h2>
                                                          <p className="text-sm text-[#64748b]">ID: {student.id}</p>
                                                      </div>
                                                  </div>
                                                  
                                                  <div className="flex flex-col gap-4">
                                                      <h4 className="text-sm font-bold text-[#135bec] uppercase tracking-wider">Thông tin cá nhân</h4>
                                                      <div className="flex justify-between">
                                                          <span className="text-gray-500 text-sm">Ngày sinh</span>
                                                          <span className="text-gray-900 font-medium text-sm">{student.dob}</span>
                                                      </div>
                                                      <div className="flex justify-between">
                                                          <span className="text-gray-500 text-sm">Giới tính</span>
                                                          <span className="text-gray-900 font-medium text-sm">{student.gender}</span>
                                                      </div>
                                                  </div>

                                                  <div className="flex flex-col gap-4">
                                                      <h4 className="text-sm font-bold text-[#135bec] uppercase tracking-wider">Hành động</h4>
                                                      <button className="flex items-center justify-center gap-2 w-full py-3 bg-[#eff6ff] text-[#135bec] rounded-xl font-bold text-sm">
                                                          <ArrowRightLeft className="w-5 h-5" /> Chuyển lớp
                                                      </button>
                                                      <div className="flex gap-3">
                                                          <button 
                                                              onClick={() => router.push(`/students/${classId}/${student.id}`)}
                                                              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                                                          >
                                                              <Edit className="w-4 h-4 inline mr-2" /> Sửa
                                                          </button>
                                                          <button className="flex-1 py-3 bg-[#fef2f2] text-red-600 rounded-xl font-medium text-sm border border-red-100">
                                                              <Trash2 className="w-4 h-4 inline mr-2" /> Xóa
                                                          </button>
                                                      </div>
                                                  </div>
                                              </div>
                                          </DrawerContent>
                                      </Drawer>
                                  </td>
                              </motion.tr>
                           ))
                         )}
                      </tbody>
                  </table>
                  </div>
              </div>
              
              <div className="sticky bottom-0 z-10 border-t border-[#f1f5f9] mt-auto">
                  <CustomPagination
                    currentPage={currentPage}
                    pageSize={itemsPerPage}
                    totalItems={filteredStudents.length}
                    onPageChange={(page) => setCurrentPage(page)}
                    label="sinh viên"
                    isLoading={isDataLoading}
                  />
              </div>
          </motion.div>
        </main>
      </div>
      <StudentPopup isOpen={isStudentPopupOpen} onClose={() => setIsStudentPopupOpen(false)} initialData={editingStudent} />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function ClassStudentsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-400">Loading students...</div>}>
      <ClassStudentsPageContent />
    </Suspense>
  );
}
