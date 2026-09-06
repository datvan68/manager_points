import {
  Injectable,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import {
  PermissionGroup,
  PermissionGroupDocument,
} from '../schemas/permission-group.schema';
import { User, UserDocument } from '../schemas/user.schema';
import type { TokenService } from './token.service';
import {
  RoutePermission,
  RoutePermissionDocument,
} from '../schemas/route-permission.schema';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  CreatePermissionDto,
  UpdatePermissionDto,
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
  CreateRoutePermissionDto,
  UpdateRoutePermissionDto,
} from '../dto/auth.dto';
import { getPermissionPolicy } from '../permissions.registry';

@Injectable()
export class RbacService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(PermissionGroup.name)
    private permissionGroupModel: Model<PermissionGroupDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RoutePermission.name)
    private routePermissionModel: Model<RoutePermissionDocument>,
    @Inject('TOKEN_REVOCATION') private tokenService: TokenService,
  ) {}

  private async resolvePermissionSelection(permissionIds?: string[]) {
    if (permissionIds === undefined) return undefined;

    const uniqueIds = [...new Set(permissionIds.map(String))];
    const invalidId = uniqueIds.find((id) => !Types.ObjectId.isValid(id));
    if (invalidId) throw new BadRequestException(`ID quyền không hợp lệ: ${invalidId}`);

    const finder = (this.permissionModel as any).find;
    let permissions: any[] = [];
    if (typeof finder === 'function') {
      const query = finder.call(this.permissionModel, { _id: { $in: uniqueIds } });
      permissions = (query?.exec ? await query.exec() : await query) || [];
    } else if (typeof (this.permissionModel as any).findById === 'function') {
      permissions = (await Promise.all(uniqueIds.map((id) => (this.permissionModel as any).findById(id))))
        .filter(Boolean);
    }

    const byId = new Map(permissions.map((permission) => [String(permission._id), permission]));
    const unknownIds = uniqueIds.filter((id) => !byId.has(id));
    if (unknownIds.length) {
      throw new BadRequestException(`Quyền không tồn tại: ${unknownIds.join(', ')}`);
    }

    const codes = uniqueIds.map((id) => String(byId.get(id).code));
    const codeSet = new Set(codes);
    if (!codeSet.has('ADMIN_FULL')) {
      const missing = new Set<string>();
      const visited = new Set<string>();
      const collectDependencies = (code: string) => {
        if (visited.has(code)) return;
        visited.add(code);

        const policy = getPermissionPolicy(code);
        if (!policy) return;

        for (const dependency of policy.requires) {
          if (!codeSet.has(dependency)) missing.add(dependency);
          collectDependencies(dependency);
        }
      };

      for (const code of codes) {
        const policy = getPermissionPolicy(code);
        if (!policy || !['action', 'scope modifier'].includes(policy.kind)) continue;
        collectDependencies(code);
      }
      if (missing.size) {
        throw new BadRequestException({
          message: 'Thiếu quyền cha hoặc quyền đọc bắt buộc',
          missingPermissions: [...missing],
        });
      }
    }

    return { ids: uniqueIds, codes, documents: permissions };
  }

  async getRoles() {
    const roles = await this.roleModel.find().populate('permissions').exec();
    return roles.map((role) => {
      const rObj = role.toObject();
      if (rObj.permissions && Array.isArray(rObj.permissions)) {
        const seenCodes = new Set<string>();
        rObj.permissions = rObj.permissions.filter((p: any) => {
          if (!p || !p.code) return false;
          if (seenCodes.has(p.code)) return false;
          seenCodes.add(p.code);
          return true;
        });
      }
      return rObj;
    });
  }

  async getPermissions() {
    return this.permissionModel.find();
  }

  async createPermission(dto: CreatePermissionDto) {
    const codeUpper = (dto.code || '').toUpperCase();
    const existing = await this.permissionModel.findOne({ code: codeUpper });
    if (existing) throw new ConflictException('Mã quyền này đã tồn tại');

    const permission = await this.permissionModel.create({
      ...dto,
      code: codeUpper,
    });

    if (dto.groupId && Types.ObjectId.isValid(dto.groupId)) {
      await this.permissionGroupModel.findByIdAndUpdate(dto.groupId, {
        $addToSet: { permissions: permission._id as any },
      });
    }

    return permission;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const permission = await this.permissionModel.findById(id);
    if (!permission) throw new BadRequestException('Quyền không tồn tại');

    if (dto.code) {
      const codeUpper = dto.code.toUpperCase();
      const existing = await this.permissionModel.findOne({
        code: codeUpper,
        _id: { $ne: id },
      });
      if (existing) throw new ConflictException('Mã quyền này đã tồn tại');
      permission.code = codeUpper;
    }

    if (dto.name) permission.name = dto.name;
    if (dto.module) permission.module = dto.module;
    if (dto.description !== undefined) permission.description = dto.description;

    if (dto.groupId && Types.ObjectId.isValid(dto.groupId)) {
      // Remove from other groups first
      await this.permissionGroupModel.updateMany(
        { permissions: permission._id as any },
        { $pull: { permissions: permission._id as any } },
      );
      await this.permissionGroupModel.findByIdAndUpdate(dto.groupId, {
        $addToSet: { permissions: permission._id as any },
      });
    }

    return permission.save();
  }

  async deletePermission(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const rolesUsing = await this.roleModel.countDocuments({
      permissions: id as any,
    });
    if (rolesUsing > 0) {
      throw new BadRequestException(
        'Không thể xóa quyền đang được gán cho vai trò',
      );
    }

    await this.permissionGroupModel.updateMany(
      { permissions: id as any },
      { $pull: { permissions: id as any } },
    );

    const result = await this.permissionModel.deleteOne({ _id: id });
    if (result.deletedCount === 0)
      throw new BadRequestException('Quyền không tồn tại');

    return { message: 'Xóa quyền thành công' };
  }

  async getPermissionGroups() {
    const groups = await this.permissionGroupModel
      .find()
      .populate('permissions')
      .exec();
    return groups.map((group) => {
      const gObj = group.toObject();
      if (gObj.permissions && Array.isArray(gObj.permissions)) {
        const seenCodes = new Set<string>();
        gObj.permissions = gObj.permissions.filter((p: any) => {
          if (!p || !p.code) return false;
          if (seenCodes.has(p.code)) return false;
          seenCodes.add(p.code);
          return true;
        });
      }
      return gObj;
    });
  }

  async createPermissionGroup(dto: CreatePermissionGroupDto) {
    const existingName = await this.permissionGroupModel.findOne({
      name: dto.name,
    });
    if (existingName)
      throw new ConflictException('Tên nhóm quyền này đã tồn tại');

    const existingCode = await this.permissionGroupModel.findOne({
      code: dto.code,
    });
    if (existingCode)
      throw new ConflictException('Mã nhóm quyền này đã tồn tại');

    return this.permissionGroupModel.create({
      ...dto,
      permissions:
        (dto.permissions?.map((id) => new Types.ObjectId(id)) as any) || [],
    });
  }

  async updatePermissionGroup(id: string, dto: UpdatePermissionGroupDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const group = await this.permissionGroupModel.findById(id);
    if (!group) throw new BadRequestException('Nhóm quyền không tồn tại');

    if (dto.name) {
      const existing = await this.permissionGroupModel.findOne({
        name: dto.name,
        _id: { $ne: id },
      });
      if (existing)
        throw new ConflictException('Tên nhóm quyền này đã tồn tại');
      group.name = dto.name;
    }

    if (dto.code) {
      const existing = await this.permissionGroupModel.findOne({
        code: dto.code,
        _id: { $ne: id },
      });
      if (existing) throw new ConflictException('Mã nhóm quyền này đã tồn tại');
      group.code = dto.code;
    }

    if (dto.description !== undefined) group.description = dto.description;
    if (dto.status) group.status = dto.status;
    if (dto.permissions) {
      group.permissions = dto.permissions.map(
        (p_id) => new Types.ObjectId(p_id),
      ) as any;
    }

    return group.save();
  }

  async deletePermissionGroup(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    const result = await this.permissionGroupModel.deleteOne({ _id: id });
    if (result.deletedCount === 0)
      throw new BadRequestException('Nhóm quyền không tồn tại');

    return { message: 'Xóa nhóm quyền thành công' };
  }

  async addPermissionToGroup(groupId: string, permissionId: string) {
    if (
      !Types.ObjectId.isValid(groupId) ||
      !Types.ObjectId.isValid(permissionId)
    ) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const group = await this.permissionGroupModel.findById(groupId);
    if (!group) throw new BadRequestException('Nhóm quyền không tồn tại');

    const permission = await this.permissionModel.findById(permissionId);
    if (!permission) throw new BadRequestException('Quyền không tồn tại');

    if (!group.permissions.some((p) => p.toString() === permissionId)) {
      group.permissions.push(permission._id as any);
      await group.save();
    }

    return group;
  }

  async createRole(dto: CreateRoleDto) {
    const existingRole = await this.roleModel.findOne({ name: dto.name });
    if (existingRole) {
      throw new ConflictException('Tên vai trò này đã tồn tại');
    }

    const roleCodeUpper = (dto.role_code || '').trim().toUpperCase();
    if (!roleCodeUpper) {
      throw new BadRequestException('Mã vai trò không được để trống');
    }

    const existingCode = await this.roleModel.findOne({
      role_code: roleCodeUpper,
    });
    if (existingCode) {
      throw new ConflictException('Mã vai trò này đã tồn tại');
    }

    const selection = await this.resolvePermissionSelection(dto.permissions);
    return this.roleModel.create({
      name: dto.name,
      role_code: roleCodeUpper,
      description: dto.description,
      permissions:
        (selection?.ids.map((id) => new Types.ObjectId(id)) as any) || [],
    } as any);
  }

  async updateRole(roleId: string, dto: UpdateRoleDto) {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('ID vai trò không hợp lệ');
    }
    const role = await this.roleModel.findById(roleId);
    if (!role) throw new BadRequestException('Vai trò không tồn tại');

    if (dto.name) {
      const existingRole = await this.roleModel.findOne({
        name: dto.name,
        _id: { $ne: roleId },
      });
      if (existingRole)
        throw new ConflictException('Tên vai trò này đã tồn tại');
      role.name = dto.name;
    }

    if (dto.role_code) {
      const roleCodeUpper = dto.role_code.trim().toUpperCase();
      const existingCode = await this.roleModel.findOne({
        role_code: roleCodeUpper,
        _id: { $ne: roleId },
      });
      if (existingCode)
        throw new ConflictException('Mã vai trò này đã tồn tại');
      (role as any).role_code = roleCodeUpper;
    }

    if (dto.description !== undefined) role.description = dto.description;

    const previousPermissionCodes = new Set(
      (role.permissions || []).map((permission: any) =>
        typeof permission === 'string'
          ? permission
          : permission?.code || permission?.toString?.(),
      ),
    );
    const selection = await this.resolvePermissionSelection(dto.permissions);
    if (selection)
      role.permissions = selection.ids.map((id) => new Types.ObjectId(id)) as any;

    const savedRole = await role.save();

    if (dto.permissions !== undefined) {
      const permissionIds = new Set(selection?.ids || []);
      const permissionCodes = new Set(selection?.codes || []);
      const removedPermission = [...previousPermissionCodes].some(
        (permission) => permission && !permissionIds.has(String(permission)) && !permissionCodes.has(String(permission)),
      );
      if (removedPermission) {
        const affectedUsers = await this.userModel.find({
          $or: [{ role: role._id }, { roles: role._id }],
        });
        await Promise.all(
          affectedUsers.map((user) =>
            this.tokenService.revokeAllUserTokens(user._id.toString()),
          ),
        );
      }
    }

    return savedRole;
  }

  async deleteRole(roleId: string) {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('ID vai trò không hợp lệ');
    }
    const usersCount = await this.userModel.countDocuments({
      $or: [{ role: roleId }, { roles: roleId }],
    });
    if (usersCount > 0) {
      throw new BadRequestException(
        'Không thể xóa vai trò đang có người dùng sử dụng',
      );
    }

    const result = await this.roleModel.deleteOne({ _id: roleId });
    if (result.deletedCount === 0)
      throw new BadRequestException('Vai trò không tồn tại');

    return { message: 'Xóa vai trò thành công' };
  }

  async assignRole(userId: string, dto: AssignRoleDto) {
    const roleIds = [...new Set((dto.role_ids?.length ? dto.role_ids : [dto.role_id]).filter(Boolean))];
    const primaryRoleId = dto.primary_role_id || roleIds[0];
    if (!Types.ObjectId.isValid(userId) || roleIds.some((id) => !Types.ObjectId.isValid(id))) {
      throw new BadRequestException(
        'ID người dùng hoặc ID vai trò không hợp lệ',
      );
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('Người dùng không tồn tại');

    if (!roleIds.includes(primaryRoleId)) throw new BadRequestException('Vai trò chính phải thuộc danh sách vai trò');
    const roles = await this.roleModel.find({ _id: { $in: roleIds } });
    if (roles.length !== roleIds.length) throw new BadRequestException('Vai trò không tồn tại');
    if (roles.some((role) => role.role_code === 'ADMIN') && roles.find((role) => role._id.toString() === primaryRoleId)?.role_code !== 'ADMIN') {
      throw new BadRequestException('Vai trò ADMIN phải là vai trò chính');
    }
    const role = roles.find((item) => item._id.toString() === primaryRoleId)!;

    user.role = role._id;
    user.roles = roleIds.map((id) => roles.find((item) => item._id.toString() === id)!._id) as any;
    await user.save();

    return {
      message: `Đã gán ${roles.length} vai trò cho người dùng ${user.user_name}`,
    };
  }

  // ─── ROUTE PERMISSION MANAGEMENT ──────────────────

  async getRoutePermissions() {
    return this.routePermissionModel.find().populate('permissions');
  }

  async getRoutePermissionByRoute(routePath: string) {
    return this.routePermissionModel
      .findOne({ route_path: routePath, is_active: true })
      .populate('permissions');
  }

  async createRoutePermission(dto: CreateRoutePermissionDto) {
    const existing = await this.routePermissionModel.findOne({
      route_path: dto.route_path,
    });
    if (existing)
      throw new ConflictException(`Route '${dto.route_path}' đã được cấu hình`);
    return this.routePermissionModel.create(dto as any);
  }

  async updateRoutePermission(id: string, dto: UpdateRoutePermissionDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');

    if (dto.route_path) {
      const existing = await this.routePermissionModel.findOne({
        route_path: dto.route_path,
        _id: { $ne: id },
      });
      if (existing)
        throw new ConflictException(`Route '${dto.route_path}' đã tồn tại`);
    }

    const updated = await this.routePermissionModel
      .findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after' })
      .populate('permissions');
    if (!updated)
      throw new BadRequestException('Route permission không tồn tại');
    return updated;
  }

  async deleteRoutePermission(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID không hợp lệ');
    const result = await this.routePermissionModel.deleteOne({ _id: id });
    if (result.deletedCount === 0)
      throw new BadRequestException('Route permission không tồn tại');
    return { message: 'Xóa cấu hình route thành công' };
  }
}
