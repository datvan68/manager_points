import { httpClient, handleResponse } from './http-client';

const API_BASE = `${(process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001').replace(/\/api\/?$/, '')}/api`;

export interface StudentTask {
  id: string;
  _id?: string;
  title: string;
  type: 'project' | 'assignment' | 'activity';
  subject: string;
  deadline: string; // ISO Date String
  priority: 'high' | 'medium' | 'low';
  status: 'not_started' | 'in_progress' | 'completed';
  linkedPage: string;
  targetType: 'student' | 'teacher' | 'supervisor';
  targetScope: 'all' | 'specific';
  targetDetail?: string;
  targetStudentIds?: string[];
  targetClassIds?: string[];
  targetTeacherIds?: string[];
  createdBy?: any;
  updatedBy?: any;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  userProgress?: {
    id: string;
    status: 'not_started' | 'in_progress' | 'completed';
    startedAt?: string;
    completedAt?: string;
  };
}

export interface CreateTaskDto {
  title: string;
  type: 'project' | 'assignment' | 'activity';
  subject: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  status: 'not_started' | 'in_progress' | 'completed';
  linkedPage: string;
  targetType: 'student' | 'teacher' | 'supervisor';
  targetScope: 'all' | 'specific';
  targetDetail?: string;
  targetStudentIds?: string[];
  targetClassIds?: string[];
  targetTeacherIds?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  type?: 'project' | 'assignment' | 'activity';
  subject?: string;
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'not_started' | 'in_progress' | 'completed';
  linkedPage?: string;
  targetType?: 'student' | 'teacher' | 'supervisor';
  targetScope?: 'all' | 'specific';
  targetDetail?: string;
  targetStudentIds?: string[];
  targetClassIds?: string[];
  targetTeacherIds?: string[];
}

export interface QueryTaskDto {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  targetType?: string;
  search?: string;
  sort?: 'newest' | 'deadline_asc' | 'deadline_desc' | 'priority_desc';
}

export interface TaskListResponse {
  items: StudentTask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalTasks: number;
    urgentTasks: number;
    completedTasks: number;
    progressPercentage: number;
  };
}

export const studentTaskApi = {
  async getTasks(query: QueryTaskDto): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.status) params.append('status', query.status);
    if (query.priority) params.append('priority', query.priority);
    if (query.targetType) params.append('targetType', query.targetType);
    if (query.search) params.append('search', query.search);
    if (query.sort) params.append('sort', query.sort);

    const queryString = params.toString();
    const url = `${API_BASE}/student-tasks${queryString ? `?${queryString}` : ''}`;

    const res = await httpClient(url);
    const data = await handleResponse<TaskListResponse>(res);

    return {
      ...data,
      items: (data.items || []).map((item) => ({
        ...item,
        id: item._id || item.id,
      })),
    };
  },

  async getTask(id: string): Promise<StudentTask> {
    const res = await httpClient(`${API_BASE}/student-tasks/${id}`);
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async createTask(dto: CreateTaskDto): Promise<StudentTask> {
    const res = await httpClient(`${API_BASE}/student-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async updateTask(id: string, dto: UpdateTaskDto): Promise<StudentTask> {
    const res = await httpClient(`${API_BASE}/student-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async updateTaskStatus(id: string, status: string): Promise<StudentTask> {
    const res = await httpClient(`${API_BASE}/student-tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async deleteTask(id: string): Promise<StudentTask> {
    const res = await httpClient(`${API_BASE}/student-tasks/${id}`, {
      method: 'DELETE',
    });
    const item = await handleResponse<any>(res);
    return { ...item, id: item._id || item.id };
  },

  async getTeachers(): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/student-tasks/assignees/teachers`);
    return handleResponse<any[]>(res);
  },

  async getTaskProgressOverview(query: any): Promise<TaskProgressOverviewResponse> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.status && query.status !== 'all') params.append('status', query.status);
    if (query.assigneeType && query.assigneeType !== 'all') params.append('assigneeType', query.assigneeType);
    if (query.taskId) params.append('taskId', query.taskId);
    if (query.classId) params.append('classId', query.classId);
    if (query.search) params.append('search', query.search);
    if (query.sort) params.append('sort', query.sort);
    if (query.deadlineFrom) params.append('deadlineFrom', query.deadlineFrom);
    if (query.deadlineTo) params.append('deadlineTo', query.deadlineTo);

    const queryString = params.toString();
    const url = `${API_BASE}/student-tasks/progress/overview${queryString ? `?${queryString}` : ''}`;
    const res = await httpClient(url);
    const data = await handleResponse<TaskProgressOverviewResponse>(res);
    return data;
  },

  async updateTaskProgressStatus(id: string, status: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/student-tasks/progress/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return handleResponse<any>(res);
  },

  async sendLinkedTaskProgressEvent(payload: {
    taskId: string;
    event: 'started' | 'completed' | 'reset';
    linkedPage?: string;
    sourceType?: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    const res = await httpClient(`${API_BASE}/student-tasks/progress/linked-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(res);
  },

  async checkTaskAccess(id: string): Promise<{
    allowed: boolean;
    mode: 'none' | 'manual' | 'auto';
    linkedPage: string;
    progressId?: string;
  }> {
    const res = await httpClient(`${API_BASE}/student-tasks/${id}/access`);
    return handleResponse<any>(res);
  },
};

export interface StudentTaskProgress {
  id: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  subject: string;
  deadline: string;
  assigneeUserId: string;
  assigneeName: string;
  assigneeType: string;
  studentId?: string;
  classId?: string;
  className?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  lastActivityAt?: string;
  updatedBy?: { id: string; name: string };
  updatedAt: string;
  linkedPage?: string;
  statusSource?: 'manual' | 'linked_event' | 'system';
  sourceType?: string;
  sourceId?: string;
  lastSyncedAt?: string;
}

export interface TaskProgressOverviewResponse {
  items: StudentTaskProgress[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalAssignees: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    completionRate: number;
  };
}
