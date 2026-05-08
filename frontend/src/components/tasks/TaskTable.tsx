import React from 'react';
import { Search, Plus, Filter, MoreHorizontal, Calendar, Clock, ChevronLeft } from 'lucide-react';

const TaskTable = () => {
  // Data from spec
  const tasks = [
    {
      id: 1,
      name: "Chuẩn bị tài liệu học kỳ mới",
      type: "Chấm điểm rèn luyện",
      priority: "Cao",
      deadline: "15/2/2026",
      supervisor: "GVCN",
      target: ["A", "B"],
      status: "Đang thực hiện",
      progress: 50,
      statusColor: "text-primary bg-primary-light",
      progressColor: "bg-primary"
    },
    {
      id: 2,
      name: "Kiểm tra hệ thống điểm danh",
      type: "Ghi nhận sinh viên",
      priority: "Trung bình",
      deadline: "5/2/2026",
      supervisor: "Quản sinh",
      target: ["B", "C", "..."],
      status: "Chưa hoàn thành",
      progress: 0,
      statusColor: "text-text-secondary bg-gray-100",
      progressColor: "bg-gray-300"
    },
    {
      id: 3,
      name: "Lập kế hoạch tuyển sinh",
      type: "Lên sự kiện",
      priority: "Cao",
      deadline: "20/2/2026",
      supervisor: "GVCN",
      target: ["C"],
      status: "Hoàn thành",
      progress: 100,
      statusColor: "text-success bg-success-bg",
      progressColor: "bg-success"
    },
    {
      id: 4,
      name: "Cập nhật thông tin sinh viên",
      type: "Duyệt điểm",
      priority: "Trung bình",
      deadline: "10/2/2026",
      supervisor: "Quản sinh",
      target: ["D", "E", "..."],
      status: "Đang thực hiện",
      progress: 75,
      statusColor: "text-primary bg-primary-light",
      progressColor: "bg-primary"
    },
    {
        id: 5,
        name: "Đánh giá chất lượng giảng dạy",
        type: "Chấm điểm rèn luyện",
        priority: "Thấp",
        deadline: "28/2/2026",
        supervisor: "GVCN",
        target: ["E", "F"],
        status: "Chưa hoàn thành",
        progress: 0,
        statusColor: "text-text-secondary bg-gray-100",
        progressColor: "bg-gray-300"
      }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter size={16} />
            Loại công việc
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter size={16} />
            Mức độ
          </button>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark">
                <Plus size={16} />
                Tạo mới
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-medium">Tên công việc</th>
              <th className="px-6 py-3 font-medium">Loại công việc</th>
              <th className="px-6 py-3 font-medium">Mức độ</th>
              <th className="px-6 py-3 font-medium">Thời hạn</th>
              <th className="px-6 py-3 font-medium">Người giám sát</th>
              <th className="px-6 py-3 font-medium">Đối tượng</th>
              <th className="px-6 py-3 font-medium">Trạng thái</th>
              <th className="px-6 py-3 font-medium text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{task.name}</td>
                <td className="px-6 py-4 text-gray-600">{task.type}</td>
                <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        task.priority === 'Cao' ? 'bg-danger-bg text-danger' :
                        task.priority === 'Trung bình' ? 'bg-warning-bg text-warning' :
                        'bg-success-bg text-success'
                    }`}>
                        {task.priority}
                    </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-400" />
                        {task.deadline}
                    </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{task.supervisor}</td>
                <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                        {task.target.map((t, idx) => (
                            <div key={idx} className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-medium text-gray-600">
                                {t}
                            </div>
                        ))}
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="space-y-1">
                        <div className={`text-xs font-medium ${task.statusColor.split(' ')[0]}`}>{task.status}</div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${task.progressColor}`} style={{ width: `${task.progress}%` }}></div>
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal size={20} />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination (Footer) */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
         <span className="text-sm text-gray-500">Hiển thị 1-5 trong tổng số 5 công việc</span>
         <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50" disabled>
                <ChevronLeft size={16} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white font-medium">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50" disabled>
                <ChevronLeft size={16} className="rotate-180" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default TaskTable;
