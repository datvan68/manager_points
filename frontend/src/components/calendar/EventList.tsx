import React from 'react';
import { Search, Plus, Filter, Calendar, Clock, MapPin, Award, Users, MoreHorizontal, Edit, Trash2, ChevronLeft } from 'lucide-react';

const EventList = () => {
  const events = [
    {
      id: 1,
      name: "Hội thảo Khoa học Công nghệ 2026",
      type: "Hội nghị",
      typeColor: "bg-blue-100 text-blue-700",
      date: "15/2/2026",
      time: "08:00 - 17:00",
      location: "Hội trường A - Tòa nhà chính",
      points: 100,
      participants: 250
    },
    {
      id: 2,
      name: "Workshop Kỹ năng mềm cho SV",
      type: "Workshop",
      typeColor: "bg-purple-100 text-purple-700",
      date: "8/2/2026",
      time: "14:00 - 16:30",
      location: "Phòng 301 - Tòa B",
      points: 50,
      participants: 80
    },
    {
      id: 3,
      name: "Festival Văn hóa Sinh viên 2026",
      type: "Lễ hội",
      typeColor: "bg-orange-100 text-orange-700",
      date: "12/2/2026",
      time: "09:00 - 17:00",
      location: "Sân trường - Khu A",
      points: 75,
      participants: 320
    },
    {
      id: 4,
      name: "Hội nghị Đào tạo Quốc tế",
      type: "Hội nghị",
      typeColor: "bg-blue-100 text-blue-700",
      date: "5/2/2026",
      time: "13:30 - 17:00",
      location: "Hội trường B",
      points: 120,
      participants: 180
    },
    {
      id: 5,
      name: "Ngày hội Việc làm 2026",
      type: "Lễ hội",
      typeColor: "bg-orange-100 text-orange-700",
      date: "25/2/2026",
      time: "08:00 - 17:00",
      location: "Sân vận động trường",
      points: 150,
      participants: 500
    },
    {
        id: 6,
        name: "Workshop AI trong Giáo dục",
        type: "Workshop",
        typeColor: "bg-purple-100 text-purple-700",
        date: "26/2/2026",
        time: "09:00 - 11:30",
        location: "Phòng máy 1 - Tòa C",
        points: 80,
        participants: 120
      }
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
             <Filter size={16} />
             Loại sự kiện
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

      {/* Grid of Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
            <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${event.typeColor}`}>
                        {event.type}
                    </span>
                    <div className="flex gap-1">
                        <button className="p-1 text-gray-400 hover:text-blue-600 rounded">
                            <Edit size={16} />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-red-600 rounded">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-4 line-clamp-2 min-h-[56px]">{event.name}</h3>
                
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Clock size={16} className="text-gray-400" />
                        <span>{event.time}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Award size={16} className="text-gray-400" />
                        <span className="font-medium text-orange-600">{event.points} điểm</span>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users size={16} />
                        <span>{event.participants} người tham gia</span>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Chi tiết</button>
                </div>
            </div>
        ))}
      </div>

      {/* Pagination (Footer) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex items-center justify-between">
         <span className="text-sm text-gray-500">Hiển thị 1-6 trong tổng số 6 sự kiện</span>
         <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50" disabled>
                <ChevronLeft size={16} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark">
                1
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 rotate-180">
                <ChevronLeft size={16} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default EventList;
