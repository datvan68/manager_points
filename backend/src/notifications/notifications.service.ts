import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  private isPrivilegedRole(roleName?: string): boolean {
    const role = (roleName || '').toLowerCase();
    return (
      role.includes('admin') ||
      role.includes('teacher') ||
      role.includes('supervisor') ||
      role.includes('giáo viên')
    );
  }

  async create(
    createDto: CreateNotificationDto,
    creatorId?: string,
  ): Promise<NotificationDocument> {
    if (creatorId && !Types.ObjectId.isValid(creatorId)) {
      throw new BadRequestException('Mã định dạng người tạo không hợp lệ');
    }
    if (
      createDto.recipientUserId &&
      !Types.ObjectId.isValid(createDto.recipientUserId)
    ) {
      throw new BadRequestException('Mã định dạng người nhận không hợp lệ');
    }

    const payload: any = {
      ...createDto,
      recipientUserId: createDto.recipientUserId
        ? new Types.ObjectId(createDto.recipientUserId)
        : null,
      createdBy: creatorId ? new Types.ObjectId(creatorId) : null,
      readByUserIds: [],
      targetRole: createDto.targetRole || 'all',
    };

    const created = new this.notificationModel(payload);
    return created.save();
  }

  async findAll(
    query: QueryNotificationDto,
    currentUserId?: string,
    currentUserRole?: string,
  ) {
    if (currentUserId && !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Mã định dạng người dùng không hợp lệ');
    }
    if (
      query.recipientUserId &&
      query.recipientUserId !== 'null' &&
      !Types.ObjectId.isValid(query.recipientUserId)
    ) {
      throw new BadRequestException('Mã định dạng người nhận không hợp lệ');
    }

    const filter: any = { deletedAt: null };

    // Apply role-based filtering
    const roleNameLower = (currentUserRole || '').toLowerCase();
    const isPrivileged = this.isPrivilegedRole(currentUserRole);

    if (roleNameLower.includes('admin')) {
      // Admins see everything, but can filter specifically by recipientUserId or targetRole
      if (query.recipientUserId) {
        filter.recipientUserId =
          query.recipientUserId === 'null'
            ? null
            : new Types.ObjectId(query.recipientUserId);
      }
      if (query.targetRole) {
        filter.targetRole = query.targetRole;
      }
    } else {
      // Non-admins (Student, Teacher, Supervisor) only see notifications targeted to their role or sent directly to them
      const allowedRoles = ['all'];
      if (roleNameLower.includes('student')) {
        allowedRoles.push('student');
      } else if (
        roleNameLower.includes('teacher') ||
        roleNameLower.includes('advisor') ||
        roleNameLower.includes('giảng viên') ||
        roleNameLower.includes('giang vien')
      ) {
        allowedRoles.push('teacher');
      } else if (
        roleNameLower.includes('supervisor') ||
        roleNameLower.includes('quản sinh') ||
        roleNameLower.includes('quan sinh')
      ) {
        allowedRoles.push('supervisor');
      }

      if (currentUserId) {
        filter.$or = [
          // Private notifications sent directly to this user
          { recipientUserId: new Types.ObjectId(currentUserId) },
          // Global or targeted notifications matching the user's role
          {
            recipientUserId: null,
            $or: [
              { targetRole: { $in: allowedRoles } },
              { targetRole: { $exists: false } },
              { targetRole: null },
            ],
          },
          // Fallback if recipientUserId is undefined
          {
            recipientUserId: { $exists: false },
            $or: [
              { targetRole: { $in: allowedRoles } },
              { targetRole: { $exists: false } },
              { targetRole: null },
            ],
          },
        ];
      }
    }

    // Apply type filter
    if (query.type) {
      filter.type = query.type;
    }

    // Apply isRead filter
    if (query.isRead !== undefined) {
      const isReadFilter = query.isRead === 'true';
      if (currentUserId) {
        if (isReadFilter) {
          filter.readByUserIds = new Types.ObjectId(currentUserId);
        } else {
          filter.readByUserIds = { $ne: new Types.ObjectId(currentUserId) };
        }
      }
    }

    // Apply search filter (title or description)
    if (query.search) {
      const escapedSearch = query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        '\\$&',
      );
      const searchRegex = { $regex: escapedSearch, $options: 'i' };
      if (filter.$or) {
        // If there's already an $or query (e.g. from role filtering), we must group it
        const originalOr = [...filter.$or];
        delete filter.$or;
        filter.$and = [
          { $or: originalOr },
          {
            $or: [{ title: searchRegex }, { description: searchRegex }],
          },
        ];
      } else {
        filter.$or = [{ title: searchRegex }, { description: searchRegex }];
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const total = await this.notificationModel.countDocuments(filter).exec();
    const items = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(total / limit) || 1;

    // Dynamic mapping of isRead based on currentUserId
    const mappedItems = items.map((item) => {
      const isRead = currentUserId
        ? item.readByUserIds?.some((id) => id.toString() === currentUserId) ||
          false
        : false;
      const plain = item.toObject();
      return {
        ...plain,
        id: plain._id.toString(),
        isRead,
      };
    });

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getUnreadCount(
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<{ count: number }> {
    if (currentUserId && !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Mã định dạng người dùng không hợp lệ');
    }
    const filter: any = { deletedAt: null };

    if (currentUserId) {
      filter.readByUserIds = { $ne: new Types.ObjectId(currentUserId) };
      const isPrivileged = this.isPrivilegedRole(currentUserRole);
      if (!isPrivileged) {
        filter.$or = [
          { recipientUserId: new Types.ObjectId(currentUserId) },
          { recipientUserId: null },
          { recipientUserId: { $exists: false } },
        ];
      }
    }

    const count = await this.notificationModel.countDocuments(filter).exec();
    return { count };
  }

  async getCountSummary(
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<{
    all: number;
    unread: number;
    warning: number;
    success: number;
    info: number;
    system: number;
  }> {
    if (currentUserId && !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Mã định dạng người dùng không hợp lệ');
    }
    const baseFilter: any = { deletedAt: null };

    // Visibility checks
    const isPrivileged = this.isPrivilegedRole(currentUserRole);
    if (!isPrivileged && currentUserId) {
      baseFilter.$or = [
        { recipientUserId: new Types.ObjectId(currentUserId) },
        { recipientUserId: null },
        { recipientUserId: { $exists: false } },
      ];
    }

    const userIdObj = currentUserId ? new Types.ObjectId(currentUserId) : null;

    const [all, unread, warning, success, info, system] = await Promise.all([
      this.notificationModel.countDocuments(baseFilter).exec(),
      userIdObj
        ? this.notificationModel
            .countDocuments({
              ...baseFilter,
              readByUserIds: { $ne: userIdObj },
            })
            .exec()
        : Promise.resolve(0),
      this.notificationModel
        .countDocuments({ ...baseFilter, type: 'warning' })
        .exec(),
      this.notificationModel
        .countDocuments({ ...baseFilter, type: 'success' })
        .exec(),
      this.notificationModel
        .countDocuments({ ...baseFilter, type: 'info' })
        .exec(),
      this.notificationModel
        .countDocuments({ ...baseFilter, type: 'system' })
        .exec(),
    ]);

    return { all, unread, warning, success, info, system };
  }

  async update(
    id: string,
    updateDto: UpdateNotificationDto,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã định dạng thông báo không hợp lệ');
    }

    const isPrivileged = this.isPrivilegedRole(currentUserRole);
    if (!isPrivileged) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa thông báo này',
      );
    }

    const notification = await this.notificationModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();
    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
    }

    const updated = await this.notificationModel
      .findByIdAndUpdate(id, { $set: updateDto }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
    }

    const plain = updated.toObject();
    const mappedIsRead = currentUserId
      ? plain.readByUserIds?.some((uid) => uid.toString() === currentUserId) ||
        false
      : false;

    return {
      ...plain,
      id: plain._id.toString(),
      isRead: mappedIsRead,
    };
  }

  async markRead(
    id: string,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã định dạng thông báo không hợp lệ');
    }
    if (currentUserId && !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Mã định dạng người dùng không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();
    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
    }

    // Ownership/access check
    const isPrivileged = this.isPrivilegedRole(currentUserRole);
    if (!isPrivileged && currentUserId) {
      const isRecipient =
        notification.recipientUserId &&
        notification.recipientUserId.toString() === currentUserId;
      const isGlobal = !notification.recipientUserId;
      if (!isRecipient && !isGlobal) {
        throw new ForbiddenException('Bạn không có quyền đọc thông báo này');
      }
    }

    if (currentUserId) {
      const updated = await this.notificationModel
        .findByIdAndUpdate(
          id,
          { $addToSet: { readByUserIds: new Types.ObjectId(currentUserId) } },
          { returnDocument: 'after' },
        )
        .exec();
      if (!updated) {
        throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
      }
      const plain = updated.toObject();
      return {
        ...plain,
        id: plain._id.toString(),
        isRead: true,
      };
    }

    const plain = notification.toObject();
    return {
      ...plain,
      id: plain._id.toString(),
      isRead: false,
    };
  }

  async markAllRead(
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<any> {
    if (currentUserId && !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Mã định dạng người dùng không hợp lệ');
    }
    const filter: any = { deletedAt: null };

    if (currentUserId) {
      filter.readByUserIds = { $ne: new Types.ObjectId(currentUserId) };
      const isPrivileged = this.isPrivilegedRole(currentUserRole);
      if (!isPrivileged) {
        filter.$or = [
          { recipientUserId: new Types.ObjectId(currentUserId) },
          { recipientUserId: null },
          { recipientUserId: { $exists: false } },
        ];
      }

      return this.notificationModel
        .updateMany(filter, {
          $addToSet: { readByUserIds: new Types.ObjectId(currentUserId) },
        })
        .exec();
    }

    return { modifiedCount: 0 };
  }

  async remove(
    id: string,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã định dạng thông báo không hợp lệ');
    }

    const isPrivileged = this.isPrivilegedRole(currentUserRole);
    if (!isPrivileged) {
      throw new ForbiddenException('Bạn không có quyền xóa thông báo này');
    }

    const notification = await this.notificationModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();
    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
    }

    const updated = await this.notificationModel
      .findByIdAndUpdate(
        id,
        { $set: { deletedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
    }

    const plain = updated.toObject();
    const mappedIsRead = currentUserId
      ? plain.readByUserIds?.some((uid) => uid.toString() === currentUserId) ||
        false
      : false;

    return {
      ...plain,
      id: plain._id.toString(),
      isRead: mappedIsRead,
    };
  }

  async removeBulk(
    ids: string[],
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<any> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Danh sách ID xóa không hợp lệ');
    }

    const isPrivileged = this.isPrivilegedRole(currentUserRole);
    if (!isPrivileged) {
      throw new ForbiddenException('Bạn không có quyền xóa các thông báo này');
    }

    const objectIds = ids.map((id) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(
          `Mã định dạng thông báo ${id} không hợp lệ`,
        );
      }
      return new Types.ObjectId(id);
    });

    const result = await this.notificationModel
      .updateMany(
        { _id: { $in: objectIds }, deletedAt: null },
        { $set: { deletedAt: new Date() } },
      )
      .exec();

    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  async getReaders(
    id: string,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<any[]> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã định dạng thông báo không hợp lệ');
    }

    const isPrivileged = this.isPrivilegedRole(currentUserRole);
    if (!isPrivileged) {
      throw new ForbiddenException(
        'Bạn không có quyền xem danh sách người đã đọc',
      );
    }

    const notification = await this.notificationModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .populate({
        path: 'readByUserIds',
        select: 'user_name email role',
        populate: {
          path: 'role',
          select: 'name role_code',
        },
      })
      .exec();

    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID ${id}`);
    }

    const readers = (notification.readByUserIds || [])
      .map((userObj: any) => {
        if (!userObj) return null;
        return {
          id: userObj._id?.toString(),
          user_name: userObj.user_name || 'N/A',
          email: userObj.email || 'N/A',
          roleName: userObj.role?.name || 'N/A',
        };
      })
      .filter(Boolean);

    return readers;
  }
}
