import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Club, ClubDocument } from './schemas/club.schema';
import { ClubMember, ClubMemberDocument } from './schemas/club-member.schema';
import {
  ClubFavorite,
  ClubFavoriteDocument,
} from './schemas/club-favorite.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Role, RoleDocument } from '../auth/schemas/role.schema';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import {
  AddClubMemberDto,
  UpdateClubMemberDto,
  ApproveMemberDto,
  JoinClubDto,
  SwitchClubDto,
  LeaveClubDto,
  AdminTransferClubDto,
} from './dto/club-member.dto';
import { isAdminUser } from '../auth/utils/role.util';
import {
  ClubMembershipTransfer,
  ClubMembershipTransferDocument,
} from './schemas/club-membership-transfer.schema';
import {
  ClubSchedule,
  ClubScheduleDocument,
} from '../club-schedules/schemas/club-schedule.schema';

@Injectable()
export class ClubsService {
  constructor(
    @InjectModel(Club.name) private clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private memberModel: Model<ClubMemberDocument>,
    @InjectModel(ClubFavorite.name)
    private favoriteModel: Model<ClubFavoriteDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(ClubMembershipTransfer.name)
    private transferModel: Model<ClubMembershipTransferDocument>,
    @InjectModel(ClubSchedule.name)
    private scheduleModel: Model<ClubScheduleDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private async resolveStudentId(userId: string): Promise<string> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('User ID không hợp lệ');
    }
    const student = await this.studentModel
      .findOne({ user_id: new Types.ObjectId(userId) })
      .exec();
    if (student) {
      return student._id.toString();
    }
    const user = await this.userModel.findById(userId).populate('role').exec();
    if (user && isAdminUser(user)) {
      const testStudent = await this.studentModel.findOne().exec();
      if (testStudent) {
        return testStudent._id.toString();
      }
      throw new BadRequestException('Không tìm thấy sinh viên nào trong hệ thống để test');
    }
    throw new BadRequestException('Người dùng không phải là sinh viên hoặc không có hồ sơ sinh viên');
  }

  private async findOccupiedMembership(
    studentId: string,
    semesterId: string,
  ): Promise<ClubMemberDocument | null> {
    return this.memberModel
      .findOne({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        occupies_slot: true,
      })
      .exec();
  }

  private async findLatestLeftMembership(
    studentId: string,
    semesterId: string,
  ): Promise<ClubMemberDocument | null> {
    return this.memberModel
      .findOne({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        status: 'left',
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  private async getFirstNonCancelledSchedule(
    clubId: string,
    semesterId: string,
  ): Promise<ClubScheduleDocument | null> {
    return this.scheduleModel
      .findOne({
        club_id: new Types.ObjectId(clubId),
        semester_id: new Types.ObjectId(semesterId),
        status: { $ne: 'cancelled' },
      })
      .sort({ start_time: 1, _id: 1 })
      .exec();
  }

  private async countCompletedSelfServiceTransfers(
    studentId: string,
    semesterId: string,
  ): Promise<number> {
    return this.transferModel.countDocuments({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      mode: 'self_service',
      status: 'completed',
    }).exec();
  }

  private async validateTargetClub(
    clubId: string,
    semesterId: string,
    studentId: string,
  ): Promise<ClubDocument> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException('Không tìm thấy CLB');
    }
    if (club.status !== 'active') {
      throw new BadRequestException('CLB hiện không hoạt động');
    }
    if (club.max_members) {
      const activeCount = await this.memberModel.countDocuments({
        club_id: new Types.ObjectId(clubId),
        status: 'active',
        semester_id: new Types.ObjectId(semesterId),
      });
      if (activeCount >= club.max_members) {
        throw new BadRequestException('CLB đã đạt giới hạn thành viên');
      }
    }
    return club;
  }

  private async validateAdvisor(advisorId: string): Promise<void> {
    const user = await this.userModel.findById(advisorId).populate('role').exec();
    if (!user) {
      throw new BadRequestException('Cố vấn được chọn không tồn tại trong hệ thống');
    }
    const userRole = user.role as any;
    if (!userRole || userRole.role_code !== 'TEACHER') {
      throw new BadRequestException('Người dùng được chọn làm cố vấn phải có vai trò Giảng viên (TEACHER)');
    }
  }

  async create(dto: CreateClubDto, userId: string): Promise<ClubDocument> {
    const existing = await this.clubModel.findOne({
      code: dto.code.toUpperCase(),
    });
    if (existing) {
      throw new BadRequestException(`CLB với mã "${dto.code}" đã tồn tại`);
    }
    if (!dto.classroom || dto.classroom.trim() === '') {
      throw new BadRequestException('Phòng học/phòng hoạt động mặc định không được để trống');
    }
    if (dto.activity_start_date && dto.activity_end_date) {
      if (new Date(dto.activity_end_date) < new Date(dto.activity_start_date)) {
        throw new BadRequestException(
          'Ngày kết thúc hoạt động không thể trước ngày bắt đầu',
        );
      }
    }

    if (dto.advisor_id) {
      await this.validateAdvisor(dto.advisor_id);
    }

    const club = new this.clubModel({
      ...dto,
      code: dto.code.toUpperCase(),
      activity_type: dto.activity_type || 'club',
      participation_status: dto.participation_status || 'published',
    });
    return club.save();
  }

  async findAll(
    user?: any,
    activityType?: string,
  ): Promise<ClubDocument[]> {
    const query: any = {};
    if (activityType) {
      query.activity_type = activityType;
    }

    if (user && !isAdminUser(user)) {
      // Non-admin: show active clubs or clubs they advise
      query.$or = [
        { status: 'active' },
        { advisor_id: new Types.ObjectId(user._id || user.id) },
      ];
    }

    return this.clubModel
      .find(query)
      .populate('advisor_id', 'user_name email')
      .populate('president_id', 'full_name student_code')
      .populate('semester_id', 'name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<ClubDocument> {
    const club = await this.clubModel
      .findById(id)
      .populate('advisor_id', 'user_name email phone_number')
      .populate('president_id', 'full_name student_code email')
      .populate('vice_president_ids', 'full_name student_code')
      .populate('semester_id', 'name')
      .exec();

    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
    }
    return club;
  }

  async update(id: string, dto: UpdateClubDto, user?: any): Promise<ClubDocument> {
    const currentClub = await this.clubModel.findById(id);
    if (!currentClub) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
    }

    if (user && !isAdminUser(user)) {
      const userId = user.userId || user._id || user.id;
      const isAdvisor = currentClub.advisor_id?.toString() === userId?.toString();
      
      let isPresident = false;
      if (userId && Types.ObjectId.isValid(userId)) {
        const student = await this.studentModel
          .findOne({ user_id: new Types.ObjectId(userId) })
          .exec();
        if (student && currentClub.president_id?.toString() === student._id.toString()) {
          isPresident = true;
        }
      }

      if (!isAdvisor && !isPresident) {
        throw new ForbiddenException('Bạn không có quyền chỉnh sửa câu lạc bộ này');
      }
    }

    if (dto.classroom !== undefined && dto.classroom.trim() === '') {
      throw new BadRequestException('Phòng học/phòng hoạt động mặc định không được để trống');
    }

    const start =
      dto.activity_start_date !== undefined
        ? dto.activity_start_date
        : currentClub.activity_start_date;
    const end =
      dto.activity_end_date !== undefined
        ? dto.activity_end_date
        : currentClub.activity_end_date;

    if (start && end && new Date(end) < new Date(start)) {
      throw new BadRequestException(
        'Ngày kết thúc hoạt động không thể trước ngày bắt đầu',
      );
    }

    if (dto.advisor_id) {
      await this.validateAdvisor(dto.advisor_id);
    }

    const club = await this.clubModel
      .findByIdAndUpdate(
        id,
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .populate('advisor_id', 'user_name email')
      .populate('president_id', 'full_name student_code')
      .exec();

    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
    }
    return club;
  }

  async remove(id: string, user?: any): Promise<{ message: string }> {
    const club = await this.clubModel.findById(id);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
    }

    if (user && !isAdminUser(user)) {
      const userId = user.userId || user._id || user.id;
      const isAdvisor = club.advisor_id?.toString() === userId?.toString();
      if (!isAdvisor) {
        throw new ForbiddenException('Bạn không có quyền xóa câu lạc bộ này');
      }
    }

    // Soft delete: set status to inactive
    club.status = 'inactive';
    await club.save();

    return { message: `Đã vô hiệu hóa CLB "${club.name}"` };
  }

  // ── Member Management ──

  async findMembers(
    clubId: string,
    query?: { status?: string; semester_id?: string },
  ): Promise<any[]> {
    const filter: any = { club_id: new Types.ObjectId(clubId) };
    if (query?.status) filter.status = query.status;
    if (query?.semester_id)
      filter.semester_id = new Types.ObjectId(query.semester_id);

    const members = await this.memberModel
      .find(filter)
      .populate('student_id', 'full_name student_code email sex status')
      .populate('approved_by', 'user_name')
      .sort({ role: 1, createdAt: -1 })
      .lean()
      .exec();

    // Attach transfer info if exists
    const memberIds = members.map(m => m._id);
    const transfers = await this.transferModel.find({
      to_membership_id: { $in: memberIds },
    }).lean().exec();

    return members.map(m => {
      const t = transfers.find(tr => tr.to_membership_id.toString() === m._id.toString());
      return {
        ...m,
        transfer: t || null,
      };
    });
  }

  async addMember(
    clubId: string,
    dto: AddClubMemberDto,
  ): Promise<ClubMemberDocument> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB`);
    }

    // Check max members
    if (club.max_members) {
      const activeCount = await this.memberModel.countDocuments({
        club_id: new Types.ObjectId(clubId),
        status: 'active',
        semester_id: new Types.ObjectId(dto.semester_id),
      });
      if (activeCount >= club.max_members) {
        throw new BadRequestException(
          `CLB đã đạt giới hạn ${club.max_members} thành viên`,
        );
      }
    }

    // Check duplicate
    const existing = await this.memberModel.findOne({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(dto.student_id),
      semester_id: new Types.ObjectId(dto.semester_id),
    });
    if (existing) {
      throw new BadRequestException(
        'Sinh viên đã là thành viên CLB trong học kỳ này',
      );
    }

    const member = new this.memberModel({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(dto.student_id),
      role: dto.role || 'member',
      status: 'active', // Admin/advisor adds directly as active
      joined_at: new Date(),
      semester_id: new Types.ObjectId(dto.semester_id),
    });

    return member.save();
  }

  async joinClub(
    clubId: string,
    studentIdOrUserId: string,
    dto: JoinClubDto,
  ): Promise<any> {
    const studentId = await this.resolveStudentId(studentIdOrUserId);
    const userId = studentIdOrUserId;

    // Validate target club early
    const club = await this.validateTargetClub(clubId, dto.semester_id, studentId);
    if (['draft', 'completed', 'cancelled'].includes(club.participation_status)) {
      throw new BadRequestException('Không thể đăng ký tham gia hoạt động ở trạng thái nháp, đã hoàn thành hoặc đã hủy');
    }

    if (!club.settings?.allow_self_registration) {
      throw new ForbiddenException('CLB không cho phép tự đăng ký');
    }

    const isClub = !club.activity_type || club.activity_type === 'club';
    let occupiesSlot = false;
    let requiresTeacherApproval = false;
    let firstSchedule: ClubScheduleDocument | null = null;
    let previousMember: ClubMemberDocument | null = null;

    if (isClub) {
      occupiesSlot = true;

      // Check occupied membership in other clubs
      const occupied = await this.findOccupiedMembership(studentId, dto.semester_id);
      if (occupied) {
        if (occupied.club_id.toString() === clubId) {
          throw new BadRequestException('Bạn đã đăng ký CLB này trong học kỳ hiện tại');
        } else {
          throw new BadRequestException('Bạn đã có câu lạc bộ hoạt động trong học kỳ này. Vui lòng sử dụng chức năng chuyển câu lạc bộ.');
        }
      }

      // Find previous left membership in this semester
      previousMember = await this.findLatestLeftMembership(studentId, dto.semester_id);

      if (previousMember) {
        firstSchedule = await this.getFirstNonCancelledSchedule(
          previousMember.club_id.toString(),
          dto.semester_id,
        );
        if (firstSchedule && new Date() >= new Date(firstSchedule.start_time)) {
          requiresTeacherApproval = true;
        }
      }
    }

    // Check duplicate/existing membership record for this target club
    let member = await this.memberModel.findOne({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(dto.semester_id),
    });

    let transferRecord: ClubMembershipTransferDocument | null = null;

    if (member) {
      if (member.status === 'rejected') {
        throw new ForbiddenException('Bạn đã bị từ chối gia nhập CLB này trong học kỳ hiện tại.');
      }
      if (member.status !== 'left') {
        throw new BadRequestException('Bạn đã đăng ký CLB này trong học kỳ hiện tại');
      }
      
      // Rejoining a club they left
      member.status = (requiresTeacherApproval || club.settings?.require_approval)
        ? 'pending'
        : 'active';
      member.joined_at = (requiresTeacherApproval || club.settings?.require_approval)
        ? undefined
        : new Date();
      member.left_at = undefined;
      member.occupies_slot = occupiesSlot;
      await member.save();
    } else {
      // First time registering for this target club
      member = new this.memberModel({
        club_id: new Types.ObjectId(clubId),
        student_id: new Types.ObjectId(studentId),
        role: 'member',
        status: (requiresTeacherApproval || club.settings?.require_approval) ? 'pending' : 'active',
        joined_at: (requiresTeacherApproval || club.settings?.require_approval) ? undefined : new Date(),
        semester_id: new Types.ObjectId(dto.semester_id),
        occupies_slot: occupiesSlot,
      });
      await member.save();
    }

    // Create a transfer record if activity started for the previous club (only for 'club' type)
    if (isClub && requiresTeacherApproval && previousMember) {
      await this.transferModel.deleteMany({
        to_membership_id: member._id,
      });
      transferRecord = new this.transferModel({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(dto.semester_id),
        from_club_id: previousMember.club_id,
        to_club_id: new Types.ObjectId(clubId),
        from_membership_id: previousMember._id,
        to_membership_id: member._id,
        mode: 'teacher_approval',
        status: 'pending',
        requested_by: new Types.ObjectId(userId),
        requested_at: new Date(),
      });
      await transferRecord.save();
    }

    const completedChanges = isClub
      ? await this.countCompletedSelfServiceTransfers(studentId, dto.semester_id)
      : 0;

    return {
      membership: member,
      transfer: transferRecord || null,
      self_service_changes_used: completedChanges,
      self_service_changes_remaining: isClub ? Math.max(0, 3 - completedChanges) : 0,
      requires_teacher_approval: requiresTeacherApproval,
      first_schedule_start_time: firstSchedule ? firstSchedule.start_time : null,
    };
  }

  async approveMember(
    clubId: string,
    memberId: string,
    dto: ApproveMemberDto,
    userId: string,
  ): Promise<ClubMemberDocument> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException('Không tìm thấy CLB');
    }

    const member = await this.memberModel.findOne({
      _id: new Types.ObjectId(memberId),
      club_id: new Types.ObjectId(clubId),
    }).exec();

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    if (member.status !== 'pending') {
      throw new BadRequestException('Chỉ có thể duyệt đăng ký đang chờ');
    }

    // Check if there is a pending teacher approval transfer request for this membership
    const transfer = await this.transferModel.findOne({
      to_membership_id: member._id,
      status: 'pending',
      mode: 'teacher_approval',
    }).exec();

    const requester = await this.userModel.findById(userId).populate('role').exec();
    const isAdminApprover = requester ? isAdminUser(requester) : false;
    const isAssignedAdvisor = club.advisor_id?.toString() === userId.toString();

    if (!isAdminApprover && !isAssignedAdvisor) {
      throw new ForbiddenException('Chỉ giáo viên cố vấn được phân công hoặc quản trị viên mới có quyền phê duyệt hoặc từ chối thành viên.');
    }

    if (dto.status === 'active') {
      member.status = 'active';
      member.approved_by = new Types.ObjectId(userId);
      member.joined_at = new Date();
      await member.save();

      if (transfer) {
        transfer.status = 'completed';
        transfer.decided_by = new Types.ObjectId(userId);
        transfer.decided_at = new Date();
        await transfer.save();
      }
    } else if (dto.status === 'rejected') {
      member.status = 'rejected';
      member.approved_by = new Types.ObjectId(userId);
      member.occupies_slot = false;
      await member.save();

      if (transfer) {
        transfer.status = 'rejected';
        transfer.decided_by = new Types.ObjectId(userId);
        transfer.decided_at = new Date();
        await transfer.save();
      }
    }

    return member;
  }

  async leaveClub(
    clubId: string,
    studentIdOrUserId: string,
    dto: LeaveClubDto,
  ): Promise<any> {
    const studentId = await this.resolveStudentId(studentIdOrUserId);
    
    // Find the student's membership in this club for the given semester
    const member = await this.memberModel.findOne({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(dto.semester_id),
      status: { $in: ['active', 'pending'] },
    }).exec();

    if (!member) {
      throw new NotFoundException('Không tìm thấy tư cách thành viên đang hoạt động hoặc đang chờ duyệt');
    }

    member.status = 'left';
    member.left_at = new Date();
    member.occupies_slot = false;
    await member.save();

    const completedChanges = await this.countCompletedSelfServiceTransfers(studentId, dto.semester_id);

    return {
      membership: member,
      transfer: null,
      self_service_changes_used: completedChanges,
      self_service_changes_remaining: Math.max(0, 3 - completedChanges),
      requires_teacher_approval: false,
      first_schedule_start_time: null,
    };
  }

  async switchClub(
    targetClubId: string,
    studentIdOrUserId: string,
    dto: SwitchClubDto,
  ): Promise<any> {
    const studentId = await this.resolveStudentId(studentIdOrUserId);
    const userId = studentIdOrUserId;

    // Find the current occupied membership
    const sourceMember = await this.findOccupiedMembership(studentId, dto.semester_id);
    if (!sourceMember) {
      throw new BadRequestException('Bạn chưa có câu lạc bộ hoạt động để thực hiện chuyển đổi.');
    }

    const sourceClubId = sourceMember.club_id.toString();
    if (sourceClubId === targetClubId) {
      throw new BadRequestException('Câu lạc bộ đích trùng với câu lạc bộ hiện tại.');
    }

    // Resolve source club's first non-cancelled schedule
    const firstSchedule = await this.getFirstNonCancelledSchedule(sourceClubId, dto.semester_id);
    if (!firstSchedule) {
      throw new ConflictException('Không thể tự chuyển câu lạc bộ do câu lạc bộ hiện tại chưa cấu hình lịch hoạt động.');
    }

    // Check if activity has started
    if (new Date() >= new Date(firstSchedule.start_time)) {
      throw new ForbiddenException('Thời gian hoạt động của câu lạc bộ hiện tại đã bắt đầu. Vui lòng liên hệ Giảng viên cố vấn CLB mới để duyệt yêu cầu.');
    }

    // Check self-service changes count
    const completedChanges = await this.countCompletedSelfServiceTransfers(studentId, dto.semester_id);
    if (completedChanges >= 3) {
      throw new ForbiddenException('Bạn đã dùng hết 3 lượt tự chuyển câu lạc bộ trong học kỳ này. Vui lòng liên hệ Admin để chuyển đổi trực tiếp.');
    }

    const targetClub = await this.validateTargetClub(targetClubId, dto.semester_id, studentId);

    const existingTargetMember = await this.memberModel.findOne({
      club_id: new Types.ObjectId(targetClubId),
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(dto.semester_id),
    });
    if (existingTargetMember && existingTargetMember.status === 'rejected') {
      throw new ForbiddenException('Bạn đã bị từ chối gia nhập CLB này trong học kỳ hiện tại.');
    }

    // Perform transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    let targetMember: ClubMemberDocument | null = null;
    let transferRecord: ClubMembershipTransferDocument | null = null;

    try {
      // 1. Release source membership
      sourceMember.status = 'left';
      sourceMember.left_at = new Date();
      sourceMember.occupies_slot = false;
      await sourceMember.save({ session });

      // 2. Reactivate or create target membership
      targetMember = await this.memberModel.findOne({
        club_id: new Types.ObjectId(targetClubId),
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(dto.semester_id),
      }).session(session).exec();

      if (targetMember) {
        targetMember.status = 'active'; // switch is immediate pre-activity
        targetMember.joined_at = new Date();
        targetMember.left_at = undefined;
        targetMember.occupies_slot = true;
        await targetMember.save({ session });
      } else {
        targetMember = new this.memberModel({
          club_id: new Types.ObjectId(targetClubId),
          student_id: new Types.ObjectId(studentId),
          role: 'member',
          status: 'active',
          joined_at: new Date(),
          semester_id: new Types.ObjectId(dto.semester_id),
          occupies_slot: true,
        });
        await targetMember.save({ session });
      }

      // 3. Create transfer record
      await this.transferModel.deleteMany({
        to_membership_id: targetMember._id,
      }).session(session);
      transferRecord = new this.transferModel({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(dto.semester_id),
        from_club_id: sourceMember.club_id,
        to_club_id: new Types.ObjectId(targetClubId),
        from_membership_id: sourceMember._id,
        to_membership_id: targetMember._id,
        mode: 'self_service',
        status: 'completed',
        requested_by: new Types.ObjectId(userId),
        decided_by: new Types.ObjectId(userId),
        requested_at: new Date(),
        decided_at: new Date(),
      });
      await transferRecord.save({ session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      if (error.code === 11000) {
        throw new ConflictException('Có lỗi xung đột vị trí câu lạc bộ (slot conflict) xảy ra.');
      }
      throw error;
    } finally {
      await session.endSession();
    }

    const updatedChanges = completedChanges + 1;

    return {
      membership: targetMember,
      transfer: transferRecord,
      self_service_changes_used: updatedChanges,
      self_service_changes_remaining: Math.max(0, 3 - updatedChanges),
      requires_teacher_approval: false,
      first_schedule_start_time: firstSchedule.start_time,
    };
  }

  async adminTransferClub(
    targetClubId: string,
    requesterUserId: string,
    dto: AdminTransferClubDto,
  ): Promise<any> {
    // Repeated admin check
    const requester = await this.userModel.findById(requesterUserId).populate('role').exec();
    if (!requester || !isAdminUser(requester)) {
      throw new ForbiddenException('Chỉ quản trị viên mới được phép thực hiện thao tác này.');
    }

    const studentId = dto.student_id;
    const semesterId = dto.semester_id;

    // Check current occupied membership
    const sourceMember = await this.findOccupiedMembership(studentId, semesterId);
    if (!sourceMember) {
      throw new BadRequestException('Sinh viên chưa đăng ký câu lạc bộ nào hoạt động trong học kỳ này.');
    }

    const sourceClubId = sourceMember.club_id.toString();
    if (sourceClubId === targetClubId) {
      throw new BadRequestException('Câu lạc bộ đích trùng với câu lạc bộ hiện tại.');
    }

    const targetClub = await this.validateTargetClub(targetClubId, semesterId, studentId);

    // Perform transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    let targetMember: ClubMemberDocument | null = null;
    let transferRecord: ClubMembershipTransferDocument | null = null;

    try {
      // 1. Release source membership
      sourceMember.status = 'left';
      sourceMember.left_at = new Date();
      sourceMember.occupies_slot = false;
      await sourceMember.save({ session });

      // 2. Reactivate or create target membership
      targetMember = await this.memberModel.findOne({
        club_id: new Types.ObjectId(targetClubId),
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
      }).session(session).exec();

      if (targetMember) {
        targetMember.status = 'active';
        targetMember.joined_at = new Date();
        targetMember.left_at = undefined;
        targetMember.occupies_slot = true;
        await targetMember.save({ session });
      } else {
        targetMember = new this.memberModel({
          club_id: new Types.ObjectId(targetClubId),
          student_id: new Types.ObjectId(studentId),
          role: 'member',
          status: 'active',
          joined_at: new Date(),
          semester_id: new Types.ObjectId(semesterId),
          occupies_slot: true,
        });
        await targetMember.save({ session });
      }

      // 3. Create transfer record
      await this.transferModel.deleteMany({
        to_membership_id: targetMember._id,
      }).session(session);
      transferRecord = new this.transferModel({
        student_id: new Types.ObjectId(studentId),
        semester_id: new Types.ObjectId(semesterId),
        from_club_id: sourceMember.club_id,
        to_club_id: new Types.ObjectId(targetClubId),
        from_membership_id: sourceMember._id,
        to_membership_id: targetMember._id,
        mode: 'admin_direct',
        status: 'completed',
        requested_by: new Types.ObjectId(requesterUserId),
        decided_by: new Types.ObjectId(requesterUserId),
        requested_at: new Date(),
        decided_at: new Date(),
      });
      await transferRecord.save({ session });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      if (error.code === 11000) {
        throw new ConflictException('Có lỗi xung đột vị trí câu lạc bộ (slot conflict) xảy ra.');
      }
      throw error;
    } finally {
      await session.endSession();
    }

    const completedChanges = await this.countCompletedSelfServiceTransfers(studentId, semesterId);

    return {
      membership: targetMember,
      transfer: transferRecord,
      self_service_changes_used: completedChanges,
      self_service_changes_remaining: Math.max(0, 3 - completedChanges),
      requires_teacher_approval: false,
      first_schedule_start_time: null,
    };
  }

  async updateMember(
    clubId: string,
    memberId: string,
    dto: UpdateClubMemberDto,
  ): Promise<ClubMemberDocument> {
    const member = await this.memberModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(memberId),
        club_id: new Types.ObjectId(clubId),
      },
      { $set: dto },
      { returnDocument: 'after' },
    );

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return member;
  }

  async removeMember(
    clubId: string,
    memberId: string,
  ): Promise<{ message: string }> {
    const member = await this.memberModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(memberId),
        club_id: new Types.ObjectId(clubId),
      },
      { $set: { status: 'left', left_at: new Date() } },
      { returnDocument: 'after' },
    );

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return { message: 'Đã xóa thành viên khỏi CLB' };
  }

  async getMyTransferPolicy(userId: string, semesterId: string): Promise<any> {
    const studentId = await this.resolveStudentId(userId);
    const completedChanges = await this.countCompletedSelfServiceTransfers(studentId, semesterId);
    const occupied = await this.findOccupiedMembership(studentId, semesterId);
    
    let firstSchedule: ClubScheduleDocument | null = null;
    if (occupied) {
      firstSchedule = await this.getFirstNonCancelledSchedule(occupied.club_id.toString(), semesterId);
    }

    return {
      self_service_changes_used: completedChanges,
      self_service_changes_remaining: Math.max(0, 3 - completedChanges),
      occupied_club_id: occupied ? occupied.club_id.toString() : null,
      first_schedule_start_time: firstSchedule ? firstSchedule.start_time : null,
    };
  }

  async getMyClubs(studentIdOrUserId: string): Promise<any[]> {
    let studentId = studentIdOrUserId;
    if (studentIdOrUserId && Types.ObjectId.isValid(studentIdOrUserId)) {
      const student = await this.studentModel
        .findOne({ user_id: new Types.ObjectId(studentIdOrUserId) })
        .exec();
      if (student) {
        studentId = student._id.toString();
      } else {
        const user = await this.userModel.findById(studentIdOrUserId).populate('role').exec();
        if (user && isAdminUser(user)) {
          const testStudent = await this.studentModel.findOne().exec();
          if (testStudent) {
            studentId = testStudent._id.toString();
          }
        }
      }
    }

    const memberships = await this.memberModel
      .find({
        student_id: new Types.ObjectId(studentId),
        status: { $in: ['active', 'pending'] },
      })
      .populate({
        path: 'club_id',
        populate: [
          { path: 'advisor_id', select: 'user_name email' },
          { path: 'president_id', select: 'full_name student_code' },
        ],
      })
      .populate('semester_id', 'name')
      .lean()
      .exec();

    return memberships;
  }

  async getClubStats(clubId: string): Promise<any> {
    const [club, memberStats, favoriteCount] = await Promise.all([
      this.clubModel.findById(clubId).lean(),
      this.memberModel.aggregate([
        { $match: { club_id: new Types.ObjectId(clubId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      this.favoriteModel.countDocuments({
        club_id: new Types.ObjectId(clubId),
      }),
    ]);

    if (!club) {
      throw new NotFoundException('Không tìm thấy CLB');
    }

    const stats: any = {
      club_name: club.name,
      total_members: 0,
      active_members: 0,
      pending_members: 0,
      favorite_count: favoriteCount,
    };

    memberStats.forEach((s: any) => {
      stats[`${s._id}_members`] = s.count;
      stats.total_members += s.count;
    });

    return stats;
  }

  async favoriteClub(
    clubId: string,
    userId: string,
  ): Promise<{
    club_id: string;
    is_favorited: boolean;
    favorite_count: number;
  }> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${clubId}`);
    }

    const existing = await this.favoriteModel.findOne({
      club_id: new Types.ObjectId(clubId),
      user_id: new Types.ObjectId(userId),
    });

    if (!existing) {
      try {
        await new this.favoriteModel({
          club_id: new Types.ObjectId(clubId),
          user_id: new Types.ObjectId(userId),
        }).save();
      } catch (error: any) {
        if (error.code !== 11000) {
          throw error;
        }
        // Concurrent duplicate — treat as idempotent success
      }
    }

    const favoriteCount = await this.favoriteModel.countDocuments({
      club_id: new Types.ObjectId(clubId),
    });

    return {
      club_id: clubId,
      is_favorited: true,
      favorite_count: favoriteCount,
    };
  }

  async unfavoriteClub(
    clubId: string,
    userId: string,
  ): Promise<{
    club_id: string;
    is_favorited: boolean;
    favorite_count: number;
  }> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${clubId}`);
    }

    await this.favoriteModel
      .findOneAndDelete({
        club_id: new Types.ObjectId(clubId),
        user_id: new Types.ObjectId(userId),
      })
      .exec();

    const favoriteCount = await this.favoriteModel.countDocuments({
      club_id: new Types.ObjectId(clubId),
    });

    return {
      club_id: clubId,
      is_favorited: false,
      favorite_count: favoriteCount,
    };
  }

  async getMyFavoriteClubIds(userId: string): Promise<{ club_ids: string[] }> {
    const favorites = await this.favoriteModel
      .find({
        user_id: new Types.ObjectId(userId),
      })
      .lean()
      .exec();

    return {
      club_ids: favorites.map((f) => f.club_id.toString()),
    };
  }

  async isAdvisorOrPresident(clubId: string, userId: string): Promise<boolean> {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) return false;

    const advisorId = club.advisor_id?.toString();
    return advisorId === userId;
  }
}
