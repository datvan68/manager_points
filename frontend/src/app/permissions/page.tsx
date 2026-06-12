'use client';

import React, { useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import UserModal from '../../components/modals/UserModal';
import GroupModal from '../../components/modals/GroupModal';
import PermissionModal from '../../components/modals/PermissionModal';
import RoleModal from '../../components/modals/RoleModal';
import RoutePermissionModal from '../../components/modals/RoutePermissionModal';
import { Search, Filter, Settings, Plus, Mail, Phone, Pencil, Trash2, ChevronLeft, ChevronRight, Save, Route, Globe, Cpu, Zap, Shield, ToggleLeft, ToggleRight, LayoutDashboard, Users, GraduationCap, Lock, Unlock, Eye, EyeOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomPagination } from '@/components/ui/pagination';
import TabNavigation from '@/components/ui/TabNavigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Action from '@/components/ui/Action';
import { authApi, tokenStorage } from '../../api/auth-api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import ConfirmModal from '../../components/modals/ConfirmModal';
import { RouteGuard, invalidateRoutePermissionCache } from '@/components/guards/RouteGuard';

function PermissionsPageContent() {
  const [activeTab, setActiveTab] = useState('Người dùng');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('Tất cả');
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['Tất cả']);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [permissionsByGroup, setPermissionsByGroup] = useState<Record<string, any[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isRightPanelLoading, setIsRightPanelLoading] = useState(false);
  const [innerRightTab, setInnerRightTab] = useState('Danh sách Quyền');

  // Route Permissions state
  const [routePermissions, setRoutePermissions] = useState<any[]>([]);
  const [isRoutePermModalOpen, setIsRoutePermModalOpen] = useState(false);
  const [editingRoutePerm, setEditingRoutePerm] = useState<any>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // State cho việc chọn hàng loạt User
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Pagination for users table
  const [userPageSize, setUserPageSize] = useState(20);
  const [userCurrentPage, setUserCurrentPage] = useState(1);

  // Preview RBAC state
  const [selectedPreviewRole, setSelectedPreviewRole] = useState('');
  const [selectedPreviewUser, setSelectedPreviewUser] = useState('');
  const [previewActiveTab, setPreviewActiveTab] = useState<'logs' | 'requests' | 'backup'>('logs');

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllUsers = (filteredUsers: any[]) => {
    const filteredUserIds = filteredUsers.map(u => u._id || u.id);
    const allSelected = filteredUserIds.length > 0 && filteredUserIds.every(id => selectedUserIds.includes(id));
    
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !filteredUserIds.includes(id)));
    } else {
      setSelectedUserIds(prev => {
        const newSelection = [...prev];
        filteredUserIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleToggleStatus = (status: string) => {
    if (status === 'Tất cả') {
      setFilterStatuses(['Tất cả']);
    } else {
      setFilterStatuses(prev => {
        let next = prev.filter(s => s !== 'Tất cả');
        if (next.includes(status)) {
          next = next.filter(s => s !== status);
        } else {
          next.push(status);
        }
        return next.length === 0 ? ['Tất cả'] : next;
      });
    }
  };

  const handleDeleteUsersBulk = () => {
    if (selectedUserIds.length === 0) return;
    
    setDeleteConfig({
      title: 'Xác nhận xóa nhiều tài khoản',
      message: `Bạn có chắc chắn muốn xóa ${selectedUserIds.length} tài khoản đã chọn? Hành động này sẽ không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) return;
        
        try {
          setIsDataLoading(true);
          const res = await authApi.deleteUsersBulk(selectedUserIds, token);
          toast.success(res.message || 'Đã xóa các tài khoản thành công!');
          setSelectedUserIds([]); // Reset selection
          fetchData(); // Reload table
        } catch (error: any) {
          toast.error(error.message || 'Xóa tài khoản hàng loạt thất bại');
        } finally {
          setIsDataLoading(false);
          setIsDeleteModalOpen(false);
        }
      }
    });
    setIsDeleteModalOpen(true);
  };

  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading, logout } = useAuth();

  const fetchData = async () => {
    // Wait for auth to be determined
    if (isAuthLoading) return;

    const token = tokenStorage.getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setIsDataLoading(true);
    try {
      const [u, r, p, g, rp] = await Promise.all([
        authApi.getUsers(token),
        authApi.getRoles(token),
        authApi.getPermissions(token),
        authApi.getPermissionGroups(token),
        authApi.getRoutePermissions(token).catch(() => [])
      ]);

      setUsers(u);
      setRoles(r);
      setAllPermissions(p);
      setRoutePermissions(rp);

      // Groups from API
      const apiGroups = g.map((group: any, idx: number) => ({
        id: group._id,
        name: group.name,
        desc: group.description || `Các quyền thuộc nhóm ${group.name}`,
        tag: `G_${idx}`,
        status: group.status || 'Active',
        count: group.permissions?.length || 0,
        permissions: group.permissions || []
      }));

      const groupsMap: Record<string, any[]> = {};
      apiGroups.forEach((group: any) => {
        groupsMap[group.id] = (group.permissions || []).map((perm: any) => ({
          code: perm.code,
          name: perm.name,
          desc: perm.description || perm.name,
          _id: perm._id,
          groupId: group.id
        }));
      });

      // Handle permissions NOT in any group (Legacy/Fallback)
      const permsInGroups = new Set(g.flatMap((group: any) => group.permissions?.map((p: any) => p._id.toString()) || []));
      const ungroupedPerms = p.filter(perm => !permsInGroups.has(perm._id.toString()));

      if (ungroupedPerms.length > 0) {
        const fallbackId = 'fallback_group';
        apiGroups.push({
          id: fallbackId,
          name: 'Chưa phân nhóm',
          desc: 'Các quyền chưa được gán vào nhóm cụ thể',
          tag: 'G_LEGACY',
          status: 'Active',
          count: ungroupedPerms.length,
          permissions: ungroupedPerms
        });
        groupsMap[fallbackId] = ungroupedPerms.map(perm => ({
          code: perm.code,
          name: perm.name,
          desc: perm.description || perm.name,
          _id: perm._id,
          groupId: fallbackId
        }));
      }

      setGroups(apiGroups);
      setPermissionsByGroup(groupsMap);

      // Auto-select first group if none selected or if selectedGroup no longer exists
      if (apiGroups.length > 0) {
        if (!selectedGroup || !apiGroups.some(g => g.id === selectedGroup)) {
          setSelectedGroup(apiGroups[0].id);
        }
      }
    } catch (error: any) {
      if (error.status === 401) {
        try {
          // Thử âm thầm làm mới token trước khi đăng xuất
          const refreshResult = await authApi.refreshToken();
          tokenStorage.setAccessToken(refreshResult.access_token);
          // Tải lại dữ liệu bằng token mới
          fetchData();
        } catch (refreshErr) {
          console.error("Silent refresh failed on 401 error:", refreshErr);
          logout();
        }
      } else {
        toast.error('Lỗi khi tải dữ liệu: ' + (error.message || 'Hết phiên làm việc'));
      }
    } finally {
      setIsDataLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isAuthLoading) {
      fetchData();
    }
  }, [isAuthLoading, authUser]);

  // Auto-switch preview active tab based on selected user/role permissions
  React.useEffect(() => {
    let previewRoleObj: any = null;
    let previewUserObj: any = null;
    
    if (selectedPreviewUser && selectedPreviewUser !== 'none') {
      previewUserObj = users.find(u => (u._id || u.id) === selectedPreviewUser);
      previewRoleObj = previewUserObj?.role;
    } else if (selectedPreviewRole && selectedPreviewRole !== 'none') {
      previewRoleObj = roles.find(r => (r._id || r.id) === selectedPreviewRole);
    } else if (roles.length > 0) {
      previewRoleObj = roles[0];
    }

    const previewRoleCode = previewRoleObj?.role_code || '';
    const previewRoleName = previewRoleObj?.name || '';
    const previewPermissions = (previewRoleObj?.permissions || []).map((p: any) => 
      typeof p === 'string' ? p : p.code || p._id || p.id
    );
    
    const isPreviewAdmin = previewRoleCode === 'ADMIN' || previewPermissions.includes('ADMIN_FULL') || previewRoleName.toLowerCase() === 'admin';
    const hasPreviewPermission = (code: string) => isPreviewAdmin || previewPermissions.includes(code);

    const previewCanReadLogs = hasPreviewPermission("LOGIN_LOG_READ");
    const previewCanReadRequests = hasPreviewPermission("SYSTEM_REQUEST_READ") || hasPreviewPermission("SYSTEM_REQUEST_MANAGE");
    const previewCanReadBackups = hasPreviewPermission("DATABASE_BACKUP_READ");

    if (!previewCanReadLogs) {
      if (previewCanReadRequests) {
        setPreviewActiveTab("requests");
      } else if (previewCanReadBackups) {
        setPreviewActiveTab("backup");
      }
    } else {
      setPreviewActiveTab("logs");
    }
  }, [selectedPreviewRole, selectedPreviewUser, roles, users]);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<any>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  // Roles Tabs state
  const [selectedRole, setSelectedRole] = useState('');
  const [roleFilter, setRoleFilter] = useState('Tất cả');
  const [checkedPerms, setCheckedPerms] = useState<string[]>([]);
  const [isRoleSaving, setIsRoleSaving] = useState(false);

  // Update checked perms when selectedRole changes
  React.useEffect(() => {
    if (selectedRole) {
      const role = roles.find(r => r._id === selectedRole || r.id === selectedRole);
      if (role && role.permissions) {
        // Handle both populated and unpopulated permissions
        const perms = role.permissions.map((p: any) => typeof p === 'string' ? p : p.code || p._id);
        setCheckedPerms(perms);
      }
    }
  }, [selectedRole, roles]);

  const togglePermission = (code: string) => {
    setCheckedPerms(prev => prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]);
  };

  const toggleGroupPermissions = (groupId: string, isChecked: boolean) => {
    const groupPerms = permissionsByGroup[groupId]?.map(p => p.code) || [];
    if (isChecked) {
      setCheckedPerms(prev => Array.from(new Set([...prev, ...groupPerms])));
    } else {
      setCheckedPerms(prev => prev.filter(code => !groupPerms.includes(code)));
    }
  };

  const isGroupFullyChecked = (groupId: string) => {
    const groupPerms = permissionsByGroup[groupId]?.map(p => p.code) || [];
    return groupPerms.length > 0 && groupPerms.every(code => checkedPerms.includes(code));
  };

  const handleSaveRole = async () => {
    if (!selectedRole) {
      toast.error('Vui lòng chọn vai trò để lưu');
      return;
    }

    setIsRoleSaving(true);
    try {
      const token = tokenStorage.getAccessToken();
      if (!token) throw new Error('Hết phiên làm việc');

      // Map codes back to _ids for the backend
      const permissionIds = allPermissions
        .filter(p => checkedPerms.includes(p.code))
        .map(p => p._id);

      await authApi.updateRole(selectedRole, { permissions: permissionIds }, token);

      toast.success('Lưu cấu hình phân quyền thành công!');
      fetchData(); // Refresh data
    } catch (error: any) {
      toast.error('Lỗi khi lưu: ' + error.message);
    } finally {
      setIsRoleSaving(false);
    }
  };

  const isEditingUser = !!editingUser;

  const handleUserSave = async (userData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    if (isEditingUser) {
      if (userData.role) {
        await authApi.assignRole(editingUser._id, userData.role, token);
      }
    } else {
      await authApi.register(userData.user_name || userData.username, userData.email, userData.password);
    }
    fetchData();
  };

  const handleDeleteUser = (user: any) => {
    setDeleteConfig({
      title: 'Xóa người dùng',
      message: `Bạn có chắc chắn muốn xóa người dùng "${user.user_name || user.username}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deleteUser(user._id, token);
        toast.success('Xóa người dùng thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handlePermissionSave = async (permData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    if (editingPermission) {
      await authApi.updatePermission(editingPermission._id, permData, token);
      toast.success('Cập nhật quyền thành công');
    } else {
      await authApi.createPermission(permData, token);
      toast.success('Tạo quyền mới thành công');
    }
    fetchData();
  };

  const handleRoleModalSave = async (roleData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    try {
      if (editingRole) {
        await authApi.updateRole(editingRole._id, roleData, token);
        toast.success('Cập nhật vai trò thành công');
      } else {
        await authApi.createRole(roleData, token);
        toast.success('Tạo vai trò thành công');
      }
      fetchData();
    } catch (error: any) {
      toast.error('Lỗi khi lưu: ' + error.message);
      throw error;
    }
  };

  const handleRoleDelete = (role: any) => {
    if (role.name === 'Admin') {
      toast.error('Không thể xóa vai trò quản trị hệ thống');
      return;
    }

    setDeleteConfig({
      title: 'Xóa vai trò',
      message: `Bạn có chắc chắn muốn xóa vai trò "${role.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deleteRole(role._id, token);
        toast.success('Xóa vai trò thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handlePermissionDelete = (perm: any) => {
    setDeleteConfig({
      title: 'Xóa quyền hạn',
      message: `Bạn có chắc chắn muốn xóa quyền "${perm.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deletePermission(perm._id, token);
        toast.success('Xóa quyền thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handleGroupSave = async (groupData: any) => {
    const token = tokenStorage.getAccessToken();
    if (!token) throw new Error('Hết phiên làm việc');

    if (editingGroup) {
      await authApi.updatePermissionGroup(editingGroup.id, groupData, token);
      toast.success('Cập nhật nhóm quyền thành công');
    } else {
      await authApi.createPermissionGroup(groupData, token);
      toast.success('Tạo nhóm quyền mới thành công');
    }
    fetchData();
  };

  const handleGroupDelete = (group: any) => {
    setDeleteConfig({
      title: 'Xóa nhóm quyền',
      message: `Bạn có chắc chắn muốn xóa nhóm quyền "${group.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        const token = tokenStorage.getAccessToken();
        if (!token) {
          toast.error('Hết phiên làm việc');
          return;
        }
        await authApi.deletePermissionGroup(group.id, token);
        toast.success('Xóa nhóm quyền thành công');
        fetchData();
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleOpenAddGroupModal = () => {
    setEditingGroup(null);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroupModal = (group: any) => {
    setEditingGroup(group);
    setIsGroupModalOpen(true);
  };

  const handleOpenAddPermissionModal = () => {
    setEditingPermission(null);
    setIsPermissionModalOpen(true);
  };

  const handleOpenEditPermissionModal = (perm: any) => {
    setEditingPermission(perm);
    setIsPermissionModalOpen(true);
  };

  const handleOpenAddRoleModal = () => {
    setEditingRole(null);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRoleModal = (role: any) => {
    setEditingRole(role);
    setIsRoleModalOpen(true);
  };

  React.useEffect(() => {
    if (activeTab === 'Quyền hạn') {
      setIsRightPanelLoading(true);
      const timer = setTimeout(() => setIsRightPanelLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedGroup, activeTab]);


  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const userRole = u.role?.name || 'User';
    const matchesRole = filterRole === 'Tất cả' || userRole === filterRole;
    
    const userStatus = u.status || 'active';
    const matchesStatus = filterStatuses.includes('Tất cả') || 
      filterStatuses.some(status => {
        if (status === 'Hoạt động') return userStatus === 'active';
        if (status === 'Chưa kích hoạt') return userStatus === 'inactive' || userStatus === 'pending' || !u.status;
        if (status === 'Bị khóa') return userStatus === 'locked';
        return false;
      });
      
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination derived data for users table
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  React.useEffect(() => {
    // Reset to first page when searching, filtering, or changing page size
    setUserCurrentPage(1);
  }, [searchTerm, filterRole, filterStatuses, userPageSize]);

  // If current page is out of range after filters change, bring it back
  React.useEffect(() => {
    if (userCurrentPage > totalUserPages) {
      setUserCurrentPage(totalUserPages);
    }
  }, [filteredUsers.length, totalUserPages, userCurrentPage]);

  const paginatedUsers = filteredUsers.slice(
    (userCurrentPage - 1) * userPageSize,
    userCurrentPage * userPageSize,
  );

  return (
    <div className="flex bg-slate-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <TabNavigation
          tabs={[
            { id: 'Người dùng', label: 'Người dùng' },
            { id: 'Vai trò', label: 'Vai trò' },
            { id: 'Quyền hạn', label: 'Quyền hạn' },
            { id: 'Xem trước', label: 'Xem trước' },
            { id: 'Cấu hình', label: 'Cấu hình' }
          ]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id)}
        />
        <main className="flex-1 p-6 overflow-hidden flex flex-col bg-slate-50 relative">

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {activeTab === 'Người dùng' && (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border rounded-lg transition-all shadow-sm select-none ${
                          isFilterOpen 
                            ? 'bg-blue-50 text-blue-600 border-blue-200' 
                            : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Filter className="w-4 h-4" strokeWidth={2.5} />
                        Bộ lọc
                        {(filterRole !== 'Tất cả' || !filterStatuses.includes('Tất cả')) && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                      </button>

                      <AnimatePresence>
                        {isFilterOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200/60 z-50 p-4"
                          >
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Vai trò</h4>
                                <Select value={filterRole} onValueChange={setFilterRole}>
                                  <SelectTrigger className="w-full h-9 text-xs font-bold text-slate-700 border-slate-200 rounded-lg focus:ring-blue-500/20 bg-white">
                                    <SelectValue placeholder="Chọn vai trò" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[60] bg-white border border-slate-200 shadow-lg rounded-lg">
                                    {['Tất cả', ...(roles || []).map((r: any) => r.name).filter(Boolean)].map((role) => (
                                      <SelectItem
                                        key={role}
                                        value={role}
                                        className="text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                      >
                                        {role}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="border-t border-slate-100 pt-3 relative">
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Trạng thái</h4>
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsStatusSelectOpen(!isStatusSelectOpen);
                                    }}
                                    className="flex items-center justify-between w-full h-9 px-3 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 bg-white shadow-sm"
                                  >
                                    <span className="truncate">{filterStatuses.join(', ')}</span>
                                    <span className="text-[9px] text-slate-400">▼</span>
                                  </button>
                                  
                                  {isStatusSelectOpen && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-1.5 z-[70] space-y-0.5">
                                      {['Tất cả', 'Hoạt động', 'Chưa kích hoạt', 'Bị khóa'].map((status) => {
                                        const isChecked = filterStatuses.includes(status);
                                        return (
                                          <div
                                            key={status}
                                            onClick={() => handleToggleStatus(status)}
                                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer select-none"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {}}
                                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer w-3.5 h-3.5"
                                            />
                                            {status}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {(filterRole !== 'Tất cả' || !filterStatuses.includes('Tất cả')) && (
                                <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-400">Đang lọc nhanh</span>
                                  <button
                                    onClick={() => {
                                      setFilterRole('Tất cả');
                                      setFilterStatuses(['Tất cả']);
                                      setIsFilterOpen(false);
                                      setIsStatusSelectOpen(false);
                                    }}
                                    className="text-[11px] font-bold text-red-500 hover:text-red-600 transition-all"
                                  >
                                    Xóa bộ lọc
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {selectedUserIds.length > 0 && (
                      <button
                        onClick={handleDeleteUsersBulk}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all shadow-sm animate-fade-in"
                      >
                        <Trash2 className="w-4 h-4" />
                        Xóa ({selectedUserIds.length})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="w-9 h-9 flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={handleOpenAddModal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" strokeWidth={3} />
                      Thêm người dùng
                    </button>
                  </div>
                </div>

                {/* Table người dùng */}
                <div className="flex-1 overflow-auto bg-white relative">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 w-12">
                          <input 
                            type="checkbox" 
                            checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.includes(u._id || u.id))}
                            onChange={() => toggleSelectAllUsers(paginatedUsers)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" 
                          />
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Tên</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Liên hệ</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Vai trò</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Trạng thái</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isDataLoading ? (
                        Array.from({ length: userPageSize }).map((_, i) => (
                          <tr key={i}>
                            <td className="px-6 py-3 border-b border-gray-50"><Skeleton className="w-4 h-4 rounded" /></td>
                            <td className="px-6 py-3 border-b border-gray-50">
                              <div className="flex items-center gap-3">
                                <Skeleton className="w-9 h-9 rounded-full" />
                                <div className="flex flex-col gap-1">
                                  <Skeleton className="w-24 h-4" />
                                  <Skeleton className="w-16 h-3" />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3 border-b border-gray-50">
                              <div className="flex flex-col gap-1.5">
                                <Skeleton className="w-32 h-4" />
                                <Skeleton className="w-24 h-4" />
                              </div>
                            </td>
                            <td className="px-6 py-3 border-b border-gray-50">
                              <div className="flex items-center gap-1.5">
                                <Skeleton className="w-16 h-5 rounded-md" />
                                <Skeleton className="w-20 h-5 rounded-md" />
                              </div>
                            </td>
                            <td className="px-6 py-3 border-b border-gray-50">
                              <Skeleton className="w-16 h-5 rounded-full" />
                            </td>
                            <td className="px-6 py-3 border-b border-gray-50 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Skeleton className="w-8 h-8 rounded-lg" />
                                <Skeleton className="w-8 h-8 rounded-lg" />
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <AnimatePresence>
                          {paginatedUsers.map((user, idx) => (
                            <motion.tr
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15, delay: idx * 0.05 }}
                              key={user._id}
                              className="hover:bg-slate-50/50 transition-colors group"
                            >
                              <td className="px-6 py-3 align-middle">
                                <input 
                                  type="checkbox" 
                                  checked={selectedUserIds.includes(user._id || user.id)}
                                  onChange={() => toggleSelectUser(user._id || user.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" 
                                />
                              </td>
                              <td className="px-6 py-3 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                                    {(user.user_name || 'U').substring(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">{user.user_name || user.username}</span>
                                    <span className="text-xs font-medium text-slate-400 mt-0.5">ID: {user._id.substring(user._id.length - 8)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 align-middle">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="text-slate-600 font-medium">{user.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 align-middle">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {user.role && (
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${user.role.name === 'Admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                                      }`}>
                                      {user.role.name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3 align-middle">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' : 'bg-rose-50 text-rose-600 border-rose-100/50'
                                  }`}>
                                  <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span className="text-xs font-bold">{user.status}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 align-middle text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Action
                                    onView={() => router.push(`/permissions/${user._id || user.id}`)}
                                    onEdit={() => handleOpenEditModal(user)}
                                    onDelete={() => handleDeleteUser(user)}
                                  />
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Pagination */}
                <CustomPagination
                  currentPage={userCurrentPage}
                  pageSize={userPageSize}
                  totalItems={filteredUsers.length}
                  onPageChange={setUserCurrentPage}
                  onPageSizeChange={setUserPageSize}
                  label="người"
                  isLoading={isDataLoading}
                />
              </>
            )}

            {/* --- TAB QUYỀN HẠN --- */}
            {activeTab === 'Quyền hạn' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Groups */}
                <div className="w-[320px] bg-slate-50/50 border-r border-slate-200 flex flex-col shrink-0">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Danh sách Nhóm quyền</h2>
                    <button onClick={handleOpenAddGroupModal} className="text-blue-600 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm nhóm..."
                        className="w-full pl-9 pr-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-3">
                    {isDataLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="w-full h-24 rounded-xl" />
                      ))
                    ) : (
                      groups.map((group) => (
                        <div
                          key={group.id}
                          onClick={() => setSelectedGroup(group.id)}
                          className={`p-4 rounded-xl cursor-pointer transition-all border-l-[3px] ${selectedGroup === group.id
                            ? 'bg-blue-50/50 border-blue-600 border-y-transparent border-r-transparent shadow-sm'
                            : 'bg-white border-transparent hover:border-blue-200 hover:shadow-sm'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h3 className={`text-sm font-bold ${selectedGroup === group.id ? 'text-blue-700' : 'text-slate-800'}`}>
                              {group.name}
                            </h3>
                            <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-md uppercase tracking-wider">{group.tag}</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-3 line-clamp-1">{group.desc}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${group.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className={`text-[11px] font-semibold ${group.status === 'Active' ? 'text-slate-600' : 'text-slate-400'}`}>
                                  {group.status === 'Active' ? 'Hoạt động' : 'Ngừng kích hoạt'}
                                </span>
                              </div>
                              <span className="text-slate-300 text-[10px]">•</span>
                              <span className="text-[11px] font-semibold text-slate-500">{group.count} Quyền</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEditGroupModal(group); }} className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleGroupDelete(group); }} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Permissions List */}
                <div className="flex-1 bg-white flex flex-col min-w-0">
                  {/* Header / Tabs right panel */}
                  <div className="px-6 flex flex-col sm:flex-row sm:items-end justify-between border-b border-slate-100 shrink-0 gap-4">
                    {/* Inner Tabs */}
                    <div className="flex items-center gap-6">
                      {['Danh sách Quyền', 'Lịch sử Audit'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setInnerRightTab(tab)}
                          className={`py-4 text-sm font-bold transition-colors relative ${innerRightTab === tab ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                          {tab}
                          {innerRightTab === tab && (
                            <motion.div
                              layoutId="innerTabIndicator"
                              className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-full"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pb-2">
                      <button className="w-9 h-9 flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={handleOpenAddPermissionModal} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors">
                        <Plus className="w-4 h-4" />
                        Thêm quyền
                      </button>
                    </div>
                  </div>

                  {/* Table area */}
                  <div className="flex-1 overflow-auto relative p-6 bg-slate-50/50">
                    <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                      <table className="w-full text-left border-collapse shrink-0">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã Quyền</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên Quyền</th>
                            <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[40%]">Mô tả</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                          </tr>
                        </thead>
                      </table>
                      <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <tbody className="divide-y divide-slate-50">
                            {isRightPanelLoading || isDataLoading ? (
                              Array.from({ length: 4 }).map((_, i) => (
                                <tr key={`skel-${i}`}>
                                  <td className="px-6 py-4 w-[20%]"><Skeleton className="w-24 h-4" /></td>
                                  <td className="px-6 py-4 w-[25%]"><Skeleton className="w-32 h-4" /></td>
                                  <td className="px-4 py-4 w-[40%]"><Skeleton className="w-full h-8" /></td>
                                  <td className="px-6 py-4 text-right"><Skeleton className="w-16 h-4 inline-block" /></td>
                                </tr>
                              ))
                            ) : (
                              <AnimatePresence mode="popLayout">
                                {(permissionsByGroup[selectedGroup] || []).length > 0 ? (
                                  permissionsByGroup[selectedGroup].map((perm, idx) => (
                                    <motion.tr
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: 10 }}
                                      transition={{ duration: 0.15, delay: idx * 0.05 }}
                                      key={`${selectedGroup}-${perm.code}`}
                                      className="hover:bg-slate-50 inline-table w-full group transition-colors"
                                    >
                                      <td className="px-6 py-4 w-[20%] font-mono text-xs font-semibold text-slate-500 tracking-tight">
                                        {perm.code}
                                      </td>
                                      <td className="px-6 py-4 w-[25%] font-bold text-sm text-slate-800">
                                        {perm.name}
                                      </td>
                                      <td className="px-4 py-4 w-[40%] text-sm text-slate-500 font-medium">
                                        {perm.desc}
                                      </td>
                                      <td className="px-6 py-4 text-right align-middle">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleOpenEditPermissionModal(perm)} className="text-slate-400 hover:text-slate-700 transition-colors"><Pencil className="w-4 h-4" /></button>
                                          <button onClick={() => handlePermissionDelete(perm)} className="text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                      </td>
                                    </motion.tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                                      Không có quyền nào trong nhóm này.
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Footer */}
                      <CustomPagination
                        currentPage={1}
                        pageSize={10}
                        totalItems={(permissionsByGroup[selectedGroup] || []).length}
                        onPageChange={() => { }}
                        label="quyền"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB VAI TRÒ --- */}
            {activeTab === 'Vai trò' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Roles */}
                <div className="w-[340px] bg-slate-50/50 border-r border-slate-200 flex flex-col shrink-0">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Danh sách vai trò</h2>
                    <button onClick={handleOpenAddRoleModal} className="text-blue-600 hover:text-blue-700 p-1 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm vai trò..."
                        className="w-full pl-9 pr-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                      />
                    </div>
                    {/* Filter chips */}

                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isDataLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="w-full h-28 rounded-xl" />
                      ))
                    ) : (
                      roles.map((role) => (
                        <div
                          key={role._id}
                          onClick={() => setSelectedRole(role._id)}
                          className={`p-4 rounded-xl cursor-pointer transition-all border-l-[3px] ${selectedRole === role._id
                            ? 'bg-blue-50/50 border-blue-600 border-y-transparent border-r-transparent shadow-sm'
                            : 'bg-white border-transparent hover:border-blue-200 hover:shadow-sm'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <h3 className={`text-sm font-bold ${selectedRole === role._id ? 'text-blue-700' : 'text-slate-800'}`}>
                              {role.name}
                            </h3>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${role.name === 'Admin' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                              System
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mb-4 line-clamp-1">{role.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500`} />
                                <span className={`text-[11px] font-semibold text-emerald-600`}>
                                  Hoạt động
                                </span>
                              </div>
                              <span className="text-slate-300 text-[10px]">•</span>
                              <span className="text-[11px] font-semibold text-slate-500">{role.permissions?.length || 0} quyền</span>
                            </div>
                            <div className={`flex items-center gap-2 ${selectedRole === role._id ? 'opacity-100' : 'opacity-0'}`}>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEditRoleModal(role); }} className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleRoleDelete(role); }} className="text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Permission Matrix */}
                <div className="flex-1 bg-white flex flex-col min-w-0">
                  {/* Header / Tabs right panel */}
                  <div className="px-6 flex flex-col sm:flex-row sm:items-end justify-between border-b border-slate-100 shrink-0 gap-4">
                    <div className="flex items-center gap-6">
                      {['Ma trận quyền', 'Lịch sử Audit'].map(tab => (
                        <button
                          key={tab}
                          className={`py-4 text-sm font-bold transition-colors relative ${tab === 'Ma trận quyền' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                          {tab}
                          {tab === 'Ma trận quyền' && (
                            <motion.div
                              layoutId="matrixTabIndicator"
                              className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-full"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pb-2">
                      <button className="w-9 h-9 flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSaveRole}
                        disabled={isRoleSaving}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors disabled:opacity-50"
                      >
                        {isRoleSaving ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Lưu thay đổi
                      </button>
                    </div>
                  </div>

                  {/* Matrix Content Area */}
                  <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-slate-50/50">
                    <div className="max-w-5xl mx-auto space-y-6">
                      {isDataLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="w-full h-48 rounded-2xl" />
                        ))
                      ) : (
                        groups.map((groupData) => {
                          const permissions = permissionsByGroup[groupData.id] || [];

                          return (
                            <div key={groupData.id} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                              {/* Group Header */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 border-b border-slate-50 relative pb-5">
                                <div className="pr-40">
                                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                    <h3 className="text-base font-bold text-slate-800">{groupData.name}</h3>
                                  </div>
                                  <p className="text-[13px] text-slate-500 font-medium">{groupData.desc}</p>
                                </div>
                                <div className="flex items-center gap-4 sm:absolute sm:top-6 sm:right-6">
                                  <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-100 text-[10px] font-bold rounded-md uppercase tracking-wider">
                                    MÃ: {groupData.tag}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`checkAll-${groupData.id}`}
                                      checked={isGroupFullyChecked(groupData.id)}
                                      onChange={(e) => toggleGroupPermissions(groupData.id, e.target.checked)}
                                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                                    />
                                    <label htmlFor={`checkAll-${groupData.id}`} className="text-[13px] font-bold text-slate-600 cursor-pointer select-none">
                                      Chọn tất cả
                                    </label>
                                  </div>
                                </div>
                              </div>

                              {/* Permissions Grid */}
                              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-y-7 gap-x-12">
                                {permissions.map((perm) => (
                                  <div key={perm.code} className="flex items-start gap-4 flex-1 group">
                                    <div className="mt-0.5 shrink-0">
                                      <input
                                        type="checkbox"
                                        id={`perm-${perm.code}`}
                                        checked={checkedPerms.includes(perm.code)}
                                        onChange={() => togglePermission(perm.code)}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer transition-colors"
                                      />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-3 mb-0.5">
                                        <label htmlFor={`perm-${perm.code}`} className="text-[14px] font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors leading-tight">
                                          {perm.name}
                                        </label>
                                        <span className="font-mono text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5 shrink-0">
                                          {perm.code}
                                        </span>
                                      </div>
                                      <p className="text-[12px] sm:text-[13px] text-slate-500 font-medium leading-relaxed pr-2">
                                        {perm.desc}
                                      </p>
                                    </div>

                                    {/* Permission Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditPermissionModal(perm);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        title="Sửa quyền"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePermissionDelete(perm);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                        title="Xóa quyền"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Gán quyền trang */}
            {activeTab === 'Cấu hình' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col overflow-hidden bg-white"
              >
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                      <Route className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Cấu hình quyền theo trang</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">{routePermissions.length} cấu hình đang hoạt động</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingRoutePerm(null); setIsRoutePermModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" strokeWidth={3} />
                    Thêm cấu hình
                  </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-white relative">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Route</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Tên</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Loại</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Quyền yêu cầu</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Kiểm tra</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isDataLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                          <tr key={`sk-${idx}`}>
                            {Array.from({ length: 7 }).map((_, ci) => (
                              <td key={ci} className="px-6 py-4"><Skeleton className="h-4 w-24 rounded" /></td>
                            ))}
                          </tr>
                        ))
                      ) : routePermissions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                                <Route className="w-7 h-7 text-slate-400" />
                              </div>
                              <p className="text-sm text-gray-500 font-medium">Chưa có cấu hình nào</p>
                              <p className="text-xs text-gray-400">Nhấn "Thêm cấu hình" để gán quyền cho trang</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        routePermissions.map((rp: any) => {
                          const typeConfig = rp.type === 'api'
                            ? { icon: Cpu, label: 'API', color: 'text-purple-600 bg-purple-50 border-purple-100' }
                            : rp.type === 'feature'
                              ? { icon: Zap, label: 'Chức năng', color: 'text-amber-600 bg-amber-50 border-amber-100' }
                              : { icon: Globe, label: 'Trang', color: 'text-blue-600 bg-blue-50 border-blue-100' };
                          const TypeIcon = typeConfig.icon;
                          return (
                            <tr key={rp._id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-3.5 align-middle">
                                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{rp.route_path}</span>
                              </td>
                              <td className="px-6 py-3.5 align-middle">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{rp.route_name}</p>
                                  {rp.description && <p className="text-xs font-medium text-slate-400 mt-0.5 truncate max-w-[200px]">{rp.description}</p>}
                                </div>
                              </td>
                              <td className="px-6 py-3.5 align-middle">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeConfig.color}`}>
                                  <TypeIcon size={12} />
                                  {typeConfig.label}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 align-middle">
                                <div className="flex flex-wrap gap-1 max-w-[240px]">
                                  {(rp.permissions || []).slice(0, 3).map((p: any) => (
                                    <span key={p._id || p} className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                      {p.code || p}
                                    </span>
                                  ))}
                                  {(rp.permissions || []).length > 3 && (
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                      +{rp.permissions.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3.5 align-middle text-center">
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${rp.check_type === 'any' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                  {rp.check_type === 'any' ? 'Ít nhất 1' : 'Tất cả'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 align-middle text-center">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${rp.is_active !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' : 'bg-slate-50 text-slate-400 border-slate-100'
                                  }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${rp.is_active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="text-xs font-bold">{rp.is_active !== false ? 'Active' : 'Inactive'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 align-middle text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Action
                                    onEdit={() => { setEditingRoutePerm(rp); setIsRoutePermModalOpen(true); }}
                                    onDelete={() => {
                                      setDeleteConfig({
                                        title: 'Xóa cấu hình route',
                                        message: `Bạn có chắc chắn muốn xóa cấu hình cho route "${rp.route_path}"?`,
                                        onConfirm: async () => {
                                          const token = tokenStorage.getAccessToken();
                                          if (!token) { toast.error('Hết phiên làm việc'); return; }
                                          await authApi.deleteRoutePermission(rp._id, token);
                                          invalidateRoutePermissionCache();
                                          if (typeof window !== 'undefined') {
                                            window.dispatchEvent(new CustomEvent('route-permissions-updated'));
                                          }
                                          toast.success('Xóa cấu hình thành công');
                                          fetchData();
                                        }
                                      });
                                      setIsDeleteModalOpen(true);
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* --- TAB XEM TRƯỚC (PREVIEW) --- */}
            {activeTab === 'Xem trước' && (
              <div className="flex-grow flex flex-col overflow-hidden bg-slate-50/20">
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Xem trước phân quyền</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">Giả lập hiển thị và chức năng hệ thống theo đối tượng được chọn</p>
                    </div>
                  </div>
                  
                  {/* Selectors */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chọn Vai trò:</span>
                      <div className="w-[180px]">
                        <Select
                          value={selectedPreviewRole}
                          onValueChange={(val) => {
                            setSelectedPreviewRole(val === 'none' ? '' : val);
                            setSelectedPreviewUser('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold text-slate-700 border-slate-200 rounded-lg bg-white">
                            <SelectValue placeholder="Chọn vai trò..." />
                          </SelectTrigger>
                          <SelectContent className="z-[60] bg-white border border-slate-200 shadow-lg rounded-lg">
                            <SelectItem value="none" className="text-xs font-bold text-slate-500 italic">Mặc định (Admin)</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r._id || r.id} value={r._id || r.id} className="text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-300">HOẶC</span>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Chọn Người dùng:</span>
                      <div className="w-[180px]">
                        <Select
                          value={selectedPreviewUser}
                          onValueChange={(val) => {
                            setSelectedPreviewUser(val === 'none' ? '' : val);
                            setSelectedPreviewRole('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold text-slate-700 border-slate-200 rounded-lg bg-white">
                            <SelectValue placeholder="Chọn người dùng..." />
                          </SelectTrigger>
                          <SelectContent className="z-[60] bg-white border border-slate-200 shadow-lg rounded-lg">
                            <SelectItem value="none" className="text-xs font-bold text-slate-500 italic">Mặc định (Admin)</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u._id || u.id} value={u._id || u.id} className="text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                {u.user_name || u.username} ({u.role?.name || 'User'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulation Area */}
                {(() => {
                  let previewRoleObj: any = null;
                  let previewUserObj: any = null;
                  
                  if (selectedPreviewUser) {
                    previewUserObj = users.find(u => (u._id || u.id) === selectedPreviewUser);
                    previewRoleObj = previewUserObj?.role;
                  } else if (selectedPreviewRole) {
                    previewRoleObj = roles.find(r => (r._id || r.id) === selectedPreviewRole);
                  } else if (roles.length > 0) {
                    // Mặc định lấy vai trò Admin (hoặc vai trò đầu tiên có code ADMIN)
                    previewRoleObj = roles.find(r => r.role_code === 'ADMIN') || roles[0];
                  }

                  const previewRoleCode = previewRoleObj?.role_code || '';
                  const previewRoleName = previewRoleObj?.name || '';
                  const previewPermissions = (previewRoleObj?.permissions || []).map((p: any) => 
                    typeof p === 'string' ? p : p.code || p._id || p.id
                  );
                  
                  const isPreviewAdmin = previewRoleCode === 'ADMIN' || previewPermissions.includes('ADMIN_FULL') || previewRoleName.toLowerCase() === 'admin';
                  const hasPreviewPermission = (code: string) => isPreviewAdmin || previewPermissions.includes(code);

                  // Check Sidebar Menu display
                  const showStudents = isPreviewAdmin || previewRoleCode === 'TEACHER' || previewRoleCode === 'STUDENT' || hasPreviewPermission('STUDENT_PAGE') || hasPreviewPermission('STUDENT_READ');
                  const showGrading = isPreviewAdmin || previewRoleCode === 'TEACHER' || previewRoleCode === 'SUPERVISOR' || hasPreviewPermission('GRADING_PAGE');
                  const showSystem = isPreviewAdmin || [
                    'SYSTEM_ADMIN', 'LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'SYSTEM_REQUEST_MANAGE',
                    'DATABASE_BACKUP_READ', 'DATABASE_BACKUP_CREATE', 'DATABASE_BACKUP_DOWNLOAD', 'DATABASE_BACKUP_DELETE'
                  ].some(code => hasPreviewPermission(code));
                  const showPermissions = isPreviewAdmin || hasPreviewPermission('admin');

                  // Check System sub-permissions
                  const previewCanReadLogs = hasPreviewPermission("LOGIN_LOG_READ");
                  const previewCanReadRequests = hasPreviewPermission("SYSTEM_REQUEST_READ") || hasPreviewPermission("SYSTEM_REQUEST_MANAGE");
                  const previewCanManageRequests = hasPreviewPermission("SYSTEM_REQUEST_MANAGE");
                  const previewCanReadBackups = hasPreviewPermission("DATABASE_BACKUP_READ");
                  const previewCanCreateBackup = hasPreviewPermission("DATABASE_BACKUP_CREATE");
                  const previewCanDownloadBackup = hasPreviewPermission("DATABASE_BACKUP_DOWNLOAD");
                  const previewCanDeleteBackup = hasPreviewPermission("DATABASE_BACKUP_DELETE");

                  return (
                    <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
                      {/* Left Column: Mockup Sidebar */}
                      <div className="w-[240px] bg-white border border-slate-200 rounded-2xl flex flex-col p-4 shrink-0 shadow-sm relative overflow-hidden select-none">
                        <div className="absolute top-0 right-0 bg-indigo-500 text-[8px] font-black text-white px-2 py-0.5 rounded-bl-lg tracking-widest uppercase">Mockup</div>
                        
                        <div className="flex items-center gap-2 px-2 pb-4 border-b border-slate-100 mb-4">
                          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">E</div>
                          <span className="text-sm font-bold text-slate-800">EduManager</span>
                        </div>

                        <div className="flex flex-col gap-1.5 flex-grow">
                          <span className="text-[9px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider">Menu Hệ thống</span>
                          
                          {/* Trang chủ */}
                          <div className="flex items-center justify-between px-3 py-2 bg-blue-50/40 text-blue-600 border border-blue-100/30 rounded-xl text-xs font-semibold">
                            <div className="flex items-center gap-2.5">
                              <LayoutDashboard size={15} />
                              <span>Trang chủ</span>
                            </div>
                            <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">Mở</span>
                          </div>

                          {/* Học sinh sinh viên */}
                          <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            showStudents 
                              ? 'bg-white text-slate-700 border-slate-100' 
                              : 'bg-slate-50/50 text-slate-400 border-slate-150/40 opacity-50'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <Users size={15} />
                              <span>Học sinh sinh viên</span>
                            </div>
                            {showStudents ? (
                              <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">Mở</span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded">🔒 Ẩn</span>
                            )}
                          </div>

                          {/* Rèn luyện */}
                          <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            showGrading 
                              ? 'bg-white text-slate-700 border-slate-100' 
                              : 'bg-slate-50/50 text-slate-400 border-slate-150/40 opacity-50'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <GraduationCap size={15} />
                              <span>Rèn luyện</span>
                            </div>
                            {showGrading ? (
                              <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">Mở</span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded">🔒 Ẩn</span>
                            )}
                          </div>

                          {/* Quản trị hệ thống */}
                          <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            showSystem 
                              ? 'bg-white text-slate-700 border-slate-150 shadow-xs ring-1 ring-blue-500/5' 
                              : 'bg-slate-50/50 text-slate-400 border-slate-150/40 opacity-50'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <Settings size={15} />
                              <span>Quản trị hệ thống</span>
                            </div>
                            {showSystem ? (
                              <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">Mở</span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded">🔒 Ẩn</span>
                            )}
                          </div>

                          {/* Phân quyền */}
                          <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            showPermissions 
                              ? 'bg-white text-slate-700 border-slate-100' 
                              : 'bg-slate-50/50 text-slate-400 border-slate-150/40 opacity-50'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <Shield size={15} />
                              <span>Phân quyền (RBAC)</span>
                            </div>
                            {showPermissions ? (
                              <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">Mở</span>
                            ) : (
                              <span className="text-[9px] font-bold bg-slate-400 text-white px-1.5 py-0.5 rounded">🔒 Ẩn</span>
                            )}
                          </div>
                        </div>

                        {/* Profile Info mockup */}
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2.5 mt-auto">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-black text-blue-600 shrink-0">
                            {(previewUserObj?.user_name || previewRoleObj?.name || 'A').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-black text-slate-800 truncate leading-none">
                              {previewUserObj ? previewUserObj.user_name : (previewRoleObj?.name || 'Chưa chọn')}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 leading-none">
                              {previewRoleCode || 'GUEST'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Mockup Page Content */}
                      <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm relative min-w-0">
                        <div className="absolute top-0 right-0 bg-indigo-500 text-[8px] font-black text-white px-2 py-0.5 rounded-bl-lg tracking-widest uppercase">Mockup</div>

                        {/* Top bar of Page */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between shrink-0 gap-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center border border-blue-100">
                              <Settings size={15} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 leading-none">Quản trị Hệ thống</h4>
                              <p className="text-[9px] text-slate-400 font-semibold mt-1">Mô phỏng giao diện /system theo vai trò</p>
                            </div>
                          </div>

                          {/* Sub-tab Selectors */}
                          {showSystem && (
                            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold text-slate-600 select-none">
                              <button
                                onClick={() => setPreviewActiveTab('logs')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                  previewActiveTab === 'logs' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-800'
                                }`}
                              >
                                Nhật ký
                                {!previewCanReadLogs && <span>🔒</span>}
                              </button>
                              <button
                                onClick={() => setPreviewActiveTab('requests')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                  previewActiveTab === 'requests' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-800'
                                }`}
                              >
                                Yêu cầu
                                {!previewCanReadRequests && <span>🔒</span>}
                              </button>
                              <button
                                onClick={() => setPreviewActiveTab('backup')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                  previewActiveTab === 'backup' ? 'bg-white text-slate-800 shadow-xs' : 'hover:text-slate-800'
                                }`}
                              >
                                Sao lưu
                                {!previewCanReadBackups && <span>🔒</span>}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Page body */}
                        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/10">
                          {!showSystem ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 py-10">
                              <Lock className="w-12 h-12 text-rose-300" />
                              <h4 className="text-sm font-black text-rose-500">TRANG BỊ KHÓA TRUY CẬP (FAIL-CLOSED)</h4>
                              <p className="text-xs text-slate-500 max-w-sm text-center font-semibold leading-relaxed">
                                Người dùng này không có bất kỳ quyền hệ thống con nào. Việc truy cập trực tiếp vào đường dẫn <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 text-[10px]">/system</code> sẽ bị RouteGuard chặn và báo lỗi 403.
                              </p>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col min-h-0">
                              {/* TAB PREVIEW: LOGS */}
                              {previewActiveTab === 'logs' && (
                                <div className="flex-grow flex flex-col space-y-4">
                                  {!previewCanReadLogs ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-3 py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                      <Lock className="w-10 h-10 text-slate-300" />
                                      <h5 className="text-xs font-bold text-slate-600">TAB KHÔNG THỂ TRUY CẬP</h5>
                                      <p className="text-[11px] text-slate-400 max-w-xs text-center font-medium leading-relaxed">
                                        Tab Nhật ký đăng nhập bị chặn do thiếu quyền <code className="bg-slate-100 text-slate-600 px-1 rounded font-mono">LOGIN_LOG_READ</code>.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100/60 p-3 rounded-xl">
                                        <div className="flex items-center gap-2">
                                          <Check className="w-4 h-4 text-emerald-600" />
                                          <span className="text-xs font-bold">Quyền hạn hợp lệ: LOGIN_LOG_READ</span>
                                        </div>
                                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wider">CHO PHÉP XEM</span>
                                      </div>

                                      {/* Mockup Data table */}
                                      <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white">
                                        <div className="bg-slate-50 px-3 py-2 font-bold text-slate-500 grid grid-cols-3 border-b border-slate-150">
                                          <span>Thời gian</span>
                                          <span>Tài khoản</span>
                                          <span>Địa chỉ IP</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          <div className="px-3 py-2 grid grid-cols-3 text-slate-600 font-medium">
                                            <span>15:11:15</span>
                                            <span className="font-bold text-slate-800">hoang_admin</span>
                                            <span className="font-mono">192.168.1.55</span>
                                          </div>
                                          <div className="px-3 py-2 grid grid-cols-3 text-slate-600 font-medium">
                                            <span>14:30:22</span>
                                            <span className="font-bold text-slate-800">nguyen_teacher</span>
                                            <span className="font-mono">113.22.45.18</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* TAB PREVIEW: REQUESTS */}
                              {previewActiveTab === 'requests' && (
                                <div className="flex-grow flex flex-col space-y-4">
                                  {!previewCanReadRequests ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-3 py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                      <Lock className="w-10 h-10 text-slate-300" />
                                      <h5 className="text-xs font-bold text-slate-600">TAB KHÔNG THỂ TRUY CẬP</h5>
                                      <p className="text-[11px] text-slate-400 max-w-xs text-center font-medium leading-relaxed">
                                        Không thể xem các yêu cầu do thiếu cả quyền đọc và ghi yêu cầu hệ thống.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100/60 p-3 rounded-xl">
                                        <div className="flex items-center gap-2">
                                          <Check className="w-4 h-4 text-emerald-600" />
                                          <span className="text-xs font-bold">Quyền hạn hợp lệ: SYSTEM_REQUEST_READ</span>
                                        </div>
                                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wider">CHO PHÉP XEM</span>
                                      </div>

                                      {/* Mockup Data table with actions simulation */}
                                      <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white">
                                        <div className="bg-slate-50 px-3 py-2.5 font-bold text-slate-500 grid grid-cols-4 border-b border-slate-150">
                                          <span className="col-span-2">Yêu cầu</span>
                                          <span>Độ ưu tiên</span>
                                          <span className="text-right">Hành động</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          <div className="px-3 py-3 grid grid-cols-4 text-slate-600 font-medium items-center">
                                            <div className="col-span-2 flex flex-col pr-4">
                                              <span className="font-bold text-slate-800">Cập nhật điểm rèn luyện lớp K45A</span>
                                              <span className="text-[9px] text-slate-400 mt-1">Ghi chú bắt buộc khi phê duyệt/từ chối</span>
                                            </div>
                                            <div>
                                              <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100 font-bold text-[9px] uppercase">High</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 shrink-0">
                                              {previewCanManageRequests ? (
                                                <>
                                                  <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow-xs">Duyệt</button>
                                                  <button className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold border border-rose-200">Xóa</button>
                                                </>
                                              ) : (
                                                <div className="flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-150/40" title="Yêu cầu SYSTEM_REQUEST_MANAGE">
                                                  <Lock size={10} />
                                                  <span>Không thể xử lý</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* TAB PREVIEW: BACKUP */}
                              {previewActiveTab === 'backup' && (
                                <div className="flex-grow flex flex-col space-y-4">
                                  {!previewCanReadBackups ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 gap-3 py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                      <Lock className="w-10 h-10 text-slate-300" />
                                      <h5 className="text-xs font-bold text-slate-600">TAB KHÔNG THỂ TRUY CẬP</h5>
                                      <p className="text-[11px] text-slate-400 max-w-xs text-center font-medium leading-relaxed">
                                        Không thể truy cập phân hệ sao lưu do thiếu quyền <code className="bg-slate-100 text-slate-600 px-1 rounded font-mono">DATABASE_BACKUP_READ</code>.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-100/60 p-3 rounded-xl">
                                        <div className="flex items-center gap-2">
                                          <Check className="w-4 h-4 text-emerald-600" />
                                          <span className="text-xs font-bold">Quyền hạn hợp lệ: DATABASE_BACKUP_READ</span>
                                        </div>
                                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black tracking-wider">CHO PHÉP XEM</span>
                                      </div>

                                      {/* Backup action panel mockup */}
                                      <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                                        <div className="flex flex-col">
                                          <span className="text-xs font-bold text-slate-800">Sao lưu dữ liệu tức thời</span>
                                          <span className="text-[9px] text-slate-400 mt-1 font-semibold">Khởi chạy sao lưu cơ sở dữ liệu</span>
                                        </div>
                                        {previewCanCreateBackup ? (
                                          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-xs">
                                            Khởi chạy sao lưu
                                          </button>
                                        ) : (
                                          <div className="flex items-center gap-1 text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                                            <Lock size={10} />
                                            <span>Khóa (Cần CREATE)</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Mockup Data table with actions simulation */}
                                      <div className="border border-slate-150 rounded-xl overflow-hidden text-[11px] bg-white">
                                        <div className="bg-slate-50 px-3 py-2.5 font-bold text-slate-500 grid grid-cols-4 border-b border-slate-150">
                                          <span className="col-span-2">Tên file</span>
                                          <span>Dung lượng</span>
                                          <span className="text-right">Hành động</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          <div className="px-3 py-3 grid grid-cols-4 text-slate-600 font-medium items-center">
                                            <div className="col-span-2 flex flex-col pr-4">
                                              <span className="font-bold text-slate-800">backup-2026-06-11.tar.gz</span>
                                              <span className="text-[9px] text-slate-400 mt-1">Trạng thái: Success</span>
                                            </div>
                                            <div>
                                              <span>4.5 MB</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-3 shrink-0">
                                              {/* Download Action */}
                                              {previewCanDownloadBackup ? (
                                                <span className="text-blue-600 font-black cursor-pointer flex items-center gap-0.5 hover:underline" title="Quyền nhạy cảm: Download">
                                                  Tải
                                                  <span className="text-[9px] bg-rose-500/10 text-rose-600 px-1 rounded shrink-0">⚠️</span>
                                                </span>
                                              ) : (
                                                <div className="flex items-center gap-0.5 text-slate-400" title="Cần DATABASE_BACKUP_DOWNLOAD">
                                                  <Lock size={10} />
                                                  <span>Tải</span>
                                                </div>
                                              )}
                                              
                                              {/* Delete Action */}
                                              {previewCanDeleteBackup ? (
                                                <span className="text-rose-600 font-black cursor-pointer flex items-center gap-0.5 hover:underline" title="Quyền nhạy cảm: Delete">
                                                  Xóa
                                                  <span className="text-[9px] bg-rose-500/10 text-rose-600 px-1 rounded shrink-0">⚠️</span>
                                                </span>
                                              ) : (
                                                <div className="flex items-center gap-0.5 text-slate-400" title="Cần DATABASE_BACKUP_DELETE">
                                                  <Lock size={10} />
                                                  <span>Xóa</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Other tabs dummy content */}
            {activeTab !== 'Người dùng' && activeTab !== 'Quyền hạn' && activeTab !== 'Vai trò' && activeTab !== 'Xem trước' && activeTab !== 'Cấu hình' && (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
                Nội dung tab {activeTab} đang được phát triển...
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Insert Modal Component here */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={deleteConfig?.title}
        message={deleteConfig?.message}
        variant="danger"
        onConfirm={async () => {
          if (deleteConfig?.onConfirm) {
            try {
              await deleteConfig.onConfirm();
            } catch (error: any) {
              toast.error('Lỗi: ' + error.message);
            }
          }
          setIsDeleteModalOpen(false);
        }}
      />

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isEditing={isEditingUser}
        initialData={editingUser}
        roles={roles}
        onSave={handleUserSave}
      />

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        isEditing={!!editingGroup}
        initialData={editingGroup}
        onSave={handleGroupSave}
      />

      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        isEditing={!!editingPermission}
        initialData={editingPermission}
        defaultGroupId={selectedGroup}
        groups={groups}
        onSave={handlePermissionSave}
      />

      <RoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        isEditing={!!editingRole}
        initialData={editingRole}
        allPermissions={allPermissions}
        groups={groups}
        onSave={handleRoleModalSave}
      />

      <RoutePermissionModal
        isOpen={isRoutePermModalOpen}
        onClose={() => setIsRoutePermModalOpen(false)}
        onSave={async (data) => {
          const token = tokenStorage.getAccessToken();
          if (!token) { toast.error('Hết phiên làm việc'); return; }
          if (editingRoutePerm) {
            await authApi.updateRoutePermission(editingRoutePerm._id, data, token);
            toast.success('Cập nhật cấu hình thành công');
          } else {
            await authApi.createRoutePermission(data, token);
            toast.success('Tạo cấu hình thành công');
          }
          invalidateRoutePermissionCache();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('route-permissions-updated'));
          }
          fetchData();
        }}
        initialData={editingRoutePerm}
        allPermissions={allPermissions}
      />
    </div>
  );
}

export default function PermissionsPage() {
  return (
    <RouteGuard
      requiredPermission="admin"
      useDynamicMapping={true}
      failClosed={true}
    >
      <PermissionsPageContent />
    </RouteGuard>
  );
}
