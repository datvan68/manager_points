'use client';
import React, { useState } from 'react';
import Popup from './Popup';
import { X, CheckCircle, AlertCircle, Save } from 'lucide-react';

interface ImportConfirmPopupProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[];
    onConfirm: () => void;
}

const ImportConfirmPopup: React.FC<ImportConfirmPopupProps> = ({ 
    isOpen, 
    onClose, 
    data, 
    onConfirm 
}) => {
    // Basic table view of data
    return (
        <Popup isOpen={isOpen} onClose={onClose} title="Xác nhận dữ liệu Import" action={
             <button
                onClick={onConfirm}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
                <Save size={14} />
                Lưu vào hệ thống
            </button>
        }>
            <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={16} />
                    <div className="text-sm text-yellow-800">
                        <p className="font-semibold">Vui lòng kiểm tra kỹ dữ liệu trước khi lưu!</p>
                        <p>Hệ thống sẽ bỏ qua các dòng bị lỗi hoặc trùng lặp mã sinh viên.</p>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-semibold sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 border-b">STT</th>
                                    <th className="px-4 py-3 border-b">Mã SV</th>
                                    <th className="px-4 py-3 border-b">Họ và tên</th>
                                    <th className="px-4 py-3 border-b">Lớp</th>
                                    <th className="px-4 py-3 border-b">Ngày sinh</th>
                                    <th className="px-4 py-3 border-b">Giới tính</th>
                                    <th className="px-4 py-3 border-b">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.studentId || row['Mã SV']}</td>
                                        <td className="px-4 py-2.5 text-gray-900">{row.fullName || row['Họ tên']}</td>
                                        <td className="px-4 py-2.5 text-gray-600">{row.classId || row['Lớp']}</td>
                                        <td className="px-4 py-2.5 text-gray-600">{row.dob || row['Ngày sinh']}</td>
                                        <td className="px-4 py-2.5 text-gray-600">{row.gender || row['Giới tính']}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                (row.status || row['Trạng thái']) === 'Studying' ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20' : 
                                                'bg-gray-100 text-gray-600 ring-1 ring-gray-500/10'
                                            }`}>
                                                {row.status || row['Trạng thái'] || 'Unknown'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Popup>
    );
};

export default ImportConfirmPopup;
