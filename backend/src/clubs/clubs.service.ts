import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Club, ClubDocument } from './schemas/club.schema';
import { ClubMember, ClubMemberDocument } from './schemas/club-member.schema';
import { ClubFavorite, ClubFavoriteDocument } from './schemas/club-favorite.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import {
  AddClubMemberDto,
  UpdateClubMemberDto,
  ApproveMemberDto,
  JoinClubDto,
} from './dto/club-member.dto';
import { isAdminUser } from '../auth/utils/role.util';

@Injectable()
export class ClubsService {
  constructor(
    @InjectModel(Club.name) private clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name) private memberModel: Model<ClubMemberDocument>,
    @InjectModel(ClubFavorite.name) private favoriteModel: Model<ClubFavoriteDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
  ) {}

  async create(dto: CreateClubDto, userId: string): Promise<ClubDocument> {
    const existing = await this.clubModel.findOne({ code: dto.code.toUpperCase() });
    if (existing) {
      throw new BadRequestException(`CLB với mã "${dto.code}" đã tồn tại`);
    }
    if (dto.activity_start_date && dto.activity_end_date) {
      if (new Date(dto.activity_end_date) < new Date(dto.activity_start_date)) {
        throw new BadRequestException('Ngày kết thúc hoạt động không thể trước ngày bắt đầu');
      }
    }
    const club = new this.clubModel({ ...dto, code: dto.code.toUpperCase() });
    return club.save();
  }

  async findAll(user?: any): Promise<ClubDocument[]> {
    const query: any = {};

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

  async update(id: string, dto: UpdateClubDto): Promise<ClubDocument> {
    const currentClub = await this.clubModel.findById(id);
    if (!currentClub) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
    }

    const start = dto.activity_start_date !== undefined ? dto.activity_start_date : currentClub.activity_start_date;
    const end = dto.activity_end_date !== undefined ? dto.activity_end_date : currentClub.activity_end_date;

    if (start && end && new Date(end) < new Date(start)) {
      throw new BadRequestException('Ngày kết thúc hoạt động không thể trước ngày bắt đầu');
    }

    const club = await this.clubModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .populate('advisor_id', 'user_name email')
      .populate('president_id', 'full_name student_code')
      .exec();

    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
    }
    return club;
  }

  async remove(id: string): Promise<{ message: string }> {
    const club = await this.clubModel.findById(id);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${id}`);
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
  ): Promise<ClubMemberDocument[]> {
    const filter: any = { club_id: new Types.ObjectId(clubId) };
    if (query?.status) filter.status = query.status;
    if (query?.semester_id) filter.semester_id = new Types.ObjectId(query.semester_id);

    return this.memberModel
      .find(filter)
      .populate('student_id', 'full_name student_code email sex status')
      .populate('approved_by', 'user_name')
      .sort({ role: 1, createdAt: -1 })
      .lean()
      .exec();
  }

  async addMember(clubId: string, dto: AddClubMemberDto): Promise<ClubMemberDocument> {
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
        throw new BadRequestException(`CLB đã đạt giới hạn ${club.max_members} thành viên`);
      }
    }

    // Check duplicate
    const existing = await this.memberModel.findOne({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(dto.student_id),
      semester_id: new Types.ObjectId(dto.semester_id),
    });
    if (existing) {
      throw new BadRequestException('Sinh viên đã là thành viên CLB trong học kỳ này');
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
  ): Promise<ClubMemberDocument> {
    let studentId = studentIdOrUserId;
    if (studentIdOrUserId && Types.ObjectId.isValid(studentIdOrUserId)) {
      const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(studentIdOrUserId) }).exec();
      if (student) {
        studentId = student._id.toString();
      }
    }

    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB`);
    }
    if (club.status !== 'active') {
      throw new BadRequestException('CLB hiện không hoạt động');
    }
    if (!club.settings?.allow_self_registration) {
      throw new ForbiddenException('CLB không cho phép tự đăng ký');
    }

    // Check max members
    if (club.max_members) {
      const activeCount = await this.memberModel.countDocuments({
        club_id: new Types.ObjectId(clubId),
        status: 'active',
        semester_id: new Types.ObjectId(dto.semester_id),
      });
      if (activeCount >= club.max_members) {
        throw new BadRequestException(`CLB đã đạt giới hạn thành viên`);
      }
    }

    // Check duplicate
    const existing = await this.memberModel.findOne({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(dto.semester_id),
    });
    if (existing) {
      if (existing.status === 'rejected' || existing.status === 'left') {
        // Allow re-join
        existing.status = club.settings?.require_approval ? 'pending' : 'active';
        existing.joined_at = new Date();
        existing.left_at = undefined;
        return existing.save();
      }
      throw new BadRequestException('Bạn đã đăng ký CLB này trong học kỳ hiện tại');
    }

    const member = new this.memberModel({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(studentId),
      role: 'member',
      status: club.settings?.require_approval ? 'pending' : 'active',
      joined_at: club.settings?.require_approval ? undefined : new Date(),
      semester_id: new Types.ObjectId(dto.semester_id),
    });

    return member.save();
  }

  async approveMember(
    clubId: string,
    memberId: string,
    dto: ApproveMemberDto,
    userId: string,
  ): Promise<ClubMemberDocument> {
    const member = await this.memberModel.findOne({
      _id: new Types.ObjectId(memberId),
      club_id: new Types.ObjectId(clubId),
    });

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    if (member.status !== 'pending') {
      throw new BadRequestException('Chỉ có thể duyệt đăng ký đang chờ');
    }

    member.status = dto.status;
    member.approved_by = new Types.ObjectId(userId);
    if (dto.status === 'active') {
      member.joined_at = new Date();
    }

    return member.save();
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
      { new: true },
    );

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return member;
  }

  async removeMember(clubId: string, memberId: string): Promise<{ message: string }> {
    const member = await this.memberModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(memberId),
        club_id: new Types.ObjectId(clubId),
      },
      { $set: { status: 'left', left_at: new Date() } },
      { new: true },
    );

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return { message: 'Đã xóa thành viên khỏi CLB' };
  }

  async getMyClubs(studentIdOrUserId: string): Promise<any[]> {
    let studentId = studentIdOrUserId;
    if (studentIdOrUserId && Types.ObjectId.isValid(studentIdOrUserId)) {
      const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(studentIdOrUserId) }).exec();
      if (student) {
        studentId = student._id.toString();
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
      this.favoriteModel.countDocuments({ club_id: new Types.ObjectId(clubId) }),
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

  async favoriteClub(clubId: string, userId: string): Promise<{ club_id: string; is_favorited: boolean; favorite_count: number }> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${clubId}`);
    }

    const existing = await this.favoriteModel.findOne({
      club_id: new Types.ObjectId(clubId),
      user_id: new Types.ObjectId(userId),
    });

    if (!existing) {
      await new this.favoriteModel({
        club_id: new Types.ObjectId(clubId),
        user_id: new Types.ObjectId(userId),
      }).save();
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

  async unfavoriteClub(clubId: string, userId: string): Promise<{ club_id: string; is_favorited: boolean; favorite_count: number }> {
    const club = await this.clubModel.findById(clubId);
    if (!club) {
      throw new NotFoundException(`Không tìm thấy CLB với ID: ${clubId}`);
    }

    await this.favoriteModel.findOneAndDelete({
      club_id: new Types.ObjectId(clubId),
      user_id: new Types.ObjectId(userId),
    }).exec();

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
    const favorites = await this.favoriteModel.find({
      user_id: new Types.ObjectId(userId),
    }).lean().exec();

    return {
      club_ids: favorites.map(f => f.club_id.toString()),
    };
  }

  async isAdvisorOrPresident(clubId: string, userId: string): Promise<boolean> {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) return false;

    const advisorId = club.advisor_id?.toString();
    return advisorId === userId;
  }
}
