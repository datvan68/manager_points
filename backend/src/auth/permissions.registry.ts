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

export const DECLARED_PERMISSION_SEEDS: PermissionSeed[] = [
  {
    code: 'admin',
    name: 'Truy cập trang quản trị phân quyền',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_PAGE',
    name: 'Truy cập trang quản lý sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_READ',
    name: 'Xem sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_CREATE',
    name: 'Thêm sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_UPDATE',
    name: 'Cập nhật sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_DELETE',
    name: 'Xóa sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_IMPORT',
    name: 'Import danh sách sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_EXPORT',
    name: 'Xuất danh sách sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_ACCOUNT_ACTIVATE',
    name: 'Kích hoạt tài khoản sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'STUDENT_TRANSFER',
    name: 'Chuyển lớp sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'DEPT_CREATE',
    name: 'Thêm khoa',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'DEPT_UPDATE',
    name: 'Cập nhật khoa',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'DEPT_DELETE',
    name: 'Xóa khoa',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'CLASS_CREATE',
    name: 'Thêm lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'CLASS_UPDATE',
    name: 'Cập nhật lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'CLASS_DELETE',
    name: 'Xóa lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'READ_STUDENT_RECORD',
    name: 'Xem ghi nhận sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'CREATE_STUDENT_RECORD',
    name: 'Thêm ghi nhận sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'UPDATE_STUDENT_RECORD',
    name: 'Cập nhật ghi nhận sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'DELETE_STUDENT_RECORD',
    name: 'Xóa ghi nhận sinh viên',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'READ_CLASS_RECORD',
    name: 'Xem ghi nhận lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'CREATE_CLASS_RECORD',
    name: 'Thêm ghi nhận lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'UPDATE_CLASS_RECORD',
    name: 'Cập nhật ghi nhận lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'DELETE_CLASS_RECORD',
    name: 'Xóa ghi nhận lớp',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
  {
    code: 'CONFIG_RECORD',
    name: 'Cấu hình ghi nhận',
    module: UNGROUPED_PERMISSION_GROUP.name,
  },
];
