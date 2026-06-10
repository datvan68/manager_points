export interface PermissionSeed {
  code: string;
  name: string;
  module: string;
  description?: string;
}

export const UNGROUPED_PERMISSION_GROUP = {
  code: 'G_UNGROUPED',
  name: 'Chưa phân nhóm',
  description: 'Các quyền được khai báo trong hệ thống nhưng chưa được phân nhóm nghiệp vụ.',
  status: 'Active',
};

export const SYSTEM_PERMISSIONS_GROUP = {
  code: 'G_SYSTEM',
  name: 'Trang Phân Quyền',
  description: 'Quản trị hệ thống và phân quyền truy cập.',
  status: 'Active',
};

export const STUDENT_MANAGER_GROUP = {
  code: 'G_STUDENT',
  name: 'Quản lý Học Sinh Sinh Viên',
  description: 'Quản lý thông tin học sinh, sinh viên, lớp học và khoa.',
  status: 'Active',
};

export const GRADING_MANAGER_GROUP = {
  code: 'G_GRADING',
  name: 'Quản lý Điểm Rèn Luyện',
  description: 'Quản lý ghi nhận rèn luyện cá nhân, ghi nhận lớp và cấu hình điểm rèn luyện.',
  status: 'Active',
};

export const TASK_MANAGER_GROUP = {
  code: 'G_TASK',
  name: 'Quản lý Nhiệm Vụ',
  description: 'Quản lý phân công và theo dõi tiến độ nhiệm vụ rèn luyện.',
  status: 'Active',
};

export const DECLARED_PERMISSION_SEEDS: PermissionSeed[] = [
  // 1. Nhóm Trang Phân Quyền
  {
    code: 'admin',
    name: 'Truy cập trang quản trị phân quyền',
    module: SYSTEM_PERMISSIONS_GROUP.name,
  },

  // 2. Nhóm Quản lý Học Sinh Sinh Viên
  {
    code: 'STUDENT_PAGE',
    name: 'Truy cập trang quản lý sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_READ',
    name: 'Xem sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_CREATE',
    name: 'Thêm sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_UPDATE',
    name: 'Cập nhật sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_DELETE',
    name: 'Xóa sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_IMPORT',
    name: 'Import danh sách sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_EXPORT',
    name: 'Xuất danh sách sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_ACCOUNT_ACTIVATE',
    name: 'Kích hoạt tài khoản sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'STUDENT_TRANSFER',
    name: 'Chuyển lớp sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'DEPT_CREATE',
    name: 'Thêm khoa',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'DEPT_UPDATE',
    name: 'Cập nhật khoa',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'DEPT_DELETE',
    name: 'Xóa khoa',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'CLASS_CREATE',
    name: 'Thêm lớp',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'CLASS_UPDATE',
    name: 'Cập nhật lớp',
    module: STUDENT_MANAGER_GROUP.name,
  },
  {
    code: 'CLASS_DELETE',
    name: 'Xóa lớp',
    module: STUDENT_MANAGER_GROUP.name,
  },

  // 3. Nhóm Quản lý Điểm Rèn Luyện
  {
    code: 'GRADING_PAGE',
    name: 'Truy cập trang rèn luyện',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'READ_STUDENT_RECORD',
    name: 'Xem ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'CREATE_STUDENT_RECORD',
    name: 'Thêm ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'UPDATE_STUDENT_RECORD',
    name: 'Cập nhật ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'DELETE_STUDENT_RECORD',
    name: 'Xóa ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'READ_CLASS_RECORD',
    name: 'Xem ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'CREATE_CLASS_RECORD',
    name: 'Thêm ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'UPDATE_CLASS_RECORD',
    name: 'Cập nhật ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'DELETE_CLASS_RECORD',
    name: 'Xóa ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
  },
  {
    code: 'CONFIG_RECORD',
    name: 'Cấu hình ghi nhận',
    module: GRADING_MANAGER_GROUP.name,
  },

  // 4. Nhóm Quản lý Nhiệm Vụ
  {
    code: 'READ_STUDENT_TASK',
    name: 'Xem nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
  },
  {
    code: 'CREATE_STUDENT_TASK',
    name: 'Tạo nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
  },
  {
    code: 'UPDATE_STUDENT_TASK',
    name: 'Cập nhật nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
  },
  {
    code: 'DELETE_STUDENT_TASK',
    name: 'Xóa nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
  },
];
