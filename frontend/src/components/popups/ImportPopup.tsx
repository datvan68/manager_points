'use client';
import React, { useState, useRef } from 'react';
import Popup from './Popup';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import ImportConfirmPopup from './ImportConfirmPopup';

interface ImportPopupProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    onImport?: (data: any[]) => void;
}

const ImportPopup: React.FC<ImportPopupProps> = ({ 
    isOpen, 
    onClose, 
    title = "Import danh sách sinh viên", 
    onImport 
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (file: File) => {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];
        
        if (validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
            setFile(file);
            setUploadStatus('idle');
        } else {
            setUploadStatus('error');
            alert("Vui lòng tải lên file Excel (.xlsx, .xls) hoặc CSV");
        }
    };

    const handleUpload = () => {
        if (!file) return;
        setUploadStatus('uploading');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            if (data) {
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                
                setPreviewData(jsonData);
                setUploadStatus('success');
                setTimeout(() => {
                    setShowConfirm(true); 
                }, 500);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = async () => {
        // Here we would typically send data to backend
        console.log("Saving data:", previewData);
        if (onImport) onImport(previewData);
        
        // Close everything
        setShowConfirm(false);
        onClose();
        setFile(null);
        setUploadStatus('idle');
        setPreviewData([]);
    };

    const removeFile = () => {
        setFile(null);
        setUploadStatus('idle');
        if (inputRef.current) inputRef.current.value = '';
    };

    if (showConfirm) {
        return (
            <ImportConfirmPopup 
                isOpen={showConfirm} 
                onClose={() => setShowConfirm(false)} 
                data={previewData} 
                onConfirm={handleConfirmImport} 
            />
        );
    }

    return (
        <Popup isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Upload Area */}
                <div 
                    className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 ${
                        dragActive 
                            ? 'border-primary bg-blue-50/50 scale-[0.99]' 
                            : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                    } ${file ? 'border-none bg-white' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    {!file ? (
                        <>
                            <div className="p-4 rounded-full bg-blue-50 text-primary mb-3 shadow-sm">
                                <Upload size={32} />
                            </div>
                            <p className="mb-2 text-sm text-gray-700 font-semibold">
                                <span 
                                    className="text-primary hover:underline cursor-pointer"
                                    onClick={() => inputRef.current?.click()}
                                >
                                    Click to upload
                                </span> or drag and drop
                            </p>
                            <p className="text-xs text-text-secondary">
                                XLSX, XLS or CSV (MAX. 10MB)
                            </p>
                            <input
                                ref={inputRef}
                                type="file"
                                className="hidden"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleChange}
                            />
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-blue-50 rounded-xl border border-blue-100 relative">
                            <button 
                                onClick={removeFile}
                                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-danger hover:bg-red-50 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                            <FileSpreadsheet size={48} className="text-primary mb-3" />
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px] text-center mb-1">
                                {file.name}
                            </p>
                            <p className="text-xs text-gray-500 mb-4">
                                {(file.size / 1024).toFixed(2)} KB
                            </p>
                            
                            {uploadStatus === 'idle' && (
                                <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle size={14} /> File ready to upload
                                </div>
                            )}
                             {uploadStatus === 'uploading' && (
                                <div className="w-full max-w-[200px] bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                                     <div className="bg-primary h-1.5 rounded-full animate-progress-indeterminate"></div>
                                </div>
                            )}
                             {uploadStatus === 'success' && (
                                <div className="text-xs text-green-600 font-bold flex items-center gap-1 mt-2">
                                    <CheckCircle size={14} /> Importing...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Instructions / Template Download */}
                <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                    <div className="flex items-start gap-3">
                         <div className="mt-0.5 text-blue-500 shrink-0">
                            <AlertCircle size={18} />
                         </div>
                        <div className="text-sm text-gray-600">
                             <p className="font-medium text-gray-900 mb-1">Lưu ý quan trọng:</p>
                             <ul className="list-disc pl-4 space-y-1 text-xs">
                                 <li>Vui lòng sử dụng file mẫu chuẩn để tránh lỗi dữ liệu.</li>
                                 <li>Đảm bảo các trường bắt buộc (Mã SV, Họ tên) không được để trống.</li>
                             </ul>
                             <div className="mt-3">
                                 <a href="#" className="text-xs font-semibold text-primary hover:text-primary-dark underline inline-flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                                     <FileSpreadsheet size={14} /> Tải file mẫu (.xlsx)
                                 </a>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-text-main focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploadStatus === 'uploading' || uploadStatus === 'success'}
                        className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm transition-all flex items-center gap-2 ${
                            !file || uploadStatus === 'uploading' || uploadStatus === 'success'
                                ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                                : 'bg-primary hover:bg-primary-dark shadow-blue-500/20'
                        }`}
                    >
                        {uploadStatus === 'uploading' ? 'Đang tải lên...' : 'Import File'}
                    </button>
                </div>
            </div>
        </Popup>
    );
};

export default ImportPopup;
