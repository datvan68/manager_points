'use client';

import React, { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import TaskTable from '../../components/tasks/TaskTable';
import EventList from '../../components/calendar/EventList';

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-auto p-6">
          {/* Page Toolbar / Tabs */}
          <div className="flex items-center gap-6 mb-6 border-b border-gray-200">
            <button 
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('tasks')}
            >
                Công việc
            </button>
            <button 
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'events' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('events')}
            >
                Sự kiện
            </button>
          </div>

          {/* Content */}
          <div className="animate-in fade-in py-2">
             {activeTab === 'tasks' ? <TaskTable /> : <EventList />}
          </div>
        </div>
      </main>
    </div>
  );
}
