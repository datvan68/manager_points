import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ClubsService } from './clubs.service';
import { Club } from './schemas/club.schema';
import { ClubMember } from './schemas/club-member.schema';
import { ClubFavorite } from './schemas/club-favorite.schema';
import { Student } from '../students/schemas/student.schema';
import { User } from '../auth/schemas/user.schema';
import { Role } from '../auth/schemas/role.schema';
import { ClubMembershipTransfer } from './schemas/club-membership-transfer.schema';
import { ClubSchedule } from '../club-schedules/schemas/club-schedule.schema';

describe('ClubsService - Membership Policy & Auditing', () => {
  let service: ClubsService;

  // Mock Models as Classes
  class MockClubModel {
    static findById = jest.fn();
    static findOne = jest.fn();
    static find = jest.fn();
  }

  class MockClubMemberModel {
    _id: Types.ObjectId;
    constructor(data: any) {
      Object.assign(this, data);
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
    }
    save() {
      return Promise.resolve(this);
    }
    static findOne = jest.fn();
    static find = jest.fn();
    static countDocuments = jest.fn();
    static findOneAndUpdate = jest.fn();
  }

  class MockTransferModel {
    _id: Types.ObjectId;
    constructor(data: any) {
      Object.assign(this, data);
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
    }
    save() {
      return Promise.resolve(this);
    }
    static findOne = jest.fn();
    static countDocuments = jest.fn();
    static deleteMany = jest.fn();
  }

  class MockScheduleModel {
    static findOne = jest.fn();
  }

  class MockStudentModel {
    static findOne = jest.fn();
  }

  class MockUserModel {
    static findById = jest.fn();
  }

  let mockSession: any;
  let mockConnection: any;

  beforeEach(async () => {
    // Reset all mock functions
    MockClubModel.findById.mockReset();
    MockClubModel.findOne.mockReset();
    MockClubModel.find.mockReset();

    MockClubMemberModel.findOne.mockReset();
    MockClubMemberModel.find.mockReset();
    MockClubMemberModel.countDocuments.mockReset();
    MockClubMemberModel.findOneAndUpdate.mockReset();

    MockTransferModel.findOne.mockReset();
    MockTransferModel.countDocuments.mockReset();
    MockTransferModel.deleteMany.mockReset();

    MockScheduleModel.findOne.mockReset();
    MockStudentModel.findOne.mockReset();
    MockUserModel.findById.mockReset();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubsService,
        { provide: getModelToken(Club.name), useValue: MockClubModel },
        { provide: getModelToken(ClubMember.name), useValue: MockClubMemberModel },
        { provide: getModelToken(ClubFavorite.name), useValue: {} },
        { provide: getModelToken(Student.name), useValue: MockStudentModel },
        { provide: getModelToken(User.name), useValue: MockUserModel },
        { provide: getModelToken(Role.name), useValue: {} },
        { provide: getModelToken(ClubMembershipTransfer.name), useValue: MockTransferModel },
        { provide: getModelToken(ClubSchedule.name), useValue: MockScheduleModel },
        { provide: getConnectionToken(), useValue: mockConnection },
      ],
    }).compile();

    service = module.get<ClubsService>(ClubsService);
  });

  const mockQuery = (val: any) => {
    const query: any = {
      exec: jest.fn().mockResolvedValue(val),
      sort: jest.fn().mockReturnThis(),
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
    };
    query.then = (resolve: any, reject: any) => Promise.resolve(val).then(resolve, reject);
    return query;
  };

  beforeEach(() => {
    // Default mocks
    MockClubMemberModel.findOne.mockReturnValue(mockQuery(null));
    MockClubMemberModel.find.mockReturnValue(mockQuery([]));
    MockClubMemberModel.countDocuments.mockReturnValue(mockQuery(0));
    MockClubMemberModel.findOneAndUpdate.mockReturnValue(mockQuery(null));

    MockTransferModel.findOne.mockReturnValue(mockQuery(null));
    MockTransferModel.countDocuments.mockReturnValue(mockQuery(0));
    MockTransferModel.deleteMany.mockReturnValue(mockQuery({ deletedCount: 0 }));

    MockScheduleModel.findOne.mockReturnValue(mockQuery(null));
  });

  describe('resolveStudentId', () => {
    it('should resolve student ID for a normal student user', async () => {
      const userId = new Types.ObjectId().toString();
      const studentId = new Types.ObjectId().toString();

      MockStudentModel.findOne.mockReturnValue(mockQuery({ _id: studentId }));

      const resolved = await service['resolveStudentId'](userId);
      expect(resolved).toBe(studentId);
    });

    it('should fallback to test student for an admin user', async () => {
      const userId = new Types.ObjectId().toString();
      const testStudentId = new Types.ObjectId().toString();

      MockStudentModel.findOne
        .mockReturnValueOnce(mockQuery(null)) // user_id search
        .mockReturnValueOnce(mockQuery({ _id: testStudentId })); // test student fallback

      MockUserModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: userId,
          role: { role_code: 'ADMIN' },
        }),
      });

      const resolved = await service['resolveStudentId'](userId);
      expect(resolved).toBe(testStudentId);
    });
  });

  describe('joinClub', () => {
    const studentId = new Types.ObjectId();
    const semesterId = new Types.ObjectId();
    const clubId = new Types.ObjectId();

    beforeEach(() => {
      MockStudentModel.findOne.mockReturnValue(mockQuery({ _id: studentId }));
      MockClubModel.findById.mockResolvedValue({
        _id: clubId,
        status: 'active',
        settings: { allow_self_registration: true, require_approval: false },
      });
      MockClubMemberModel.countDocuments.mockReturnValue(mockQuery(0));
    });

    it('should succeed for initial join and not create transfer or increment changes count', async () => {
      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(null)) // findOccupiedMembership
        .mockReturnValueOnce(mockQuery(null)); // find existing membership
      MockTransferModel.countDocuments.mockReturnValue(mockQuery(0));

      const res = await service.joinClub(clubId.toString(), studentId.toString(), {
        semester_id: semesterId.toString(),
      });

      expect(res.membership.status).toBe('active');
      expect(res.transfer).toBeNull();
      expect(res.self_service_changes_used).toBe(0);
      expect(res.self_service_changes_remaining).toBe(3);
    });

    it('should reject join if student occupies another club in the same semester', async () => {
      const otherClubId = new Types.ObjectId();
      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(new MockClubMemberModel({
          club_id: otherClubId,
          student_id: studentId,
          semester_id: semesterId,
          occupies_slot: true,
        })))
        .mockReturnValueOnce(mockQuery(null));

      await expect(
        service.joinClub(clubId.toString(), studentId.toString(), {
          semester_id: semesterId.toString(),
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject join with ForbiddenException if membership status is rejected', async () => {
      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(null)) // findOccupiedMembership
        .mockReturnValueOnce(mockQuery(null)) // findLatestLeftMembership
        .mockReturnValueOnce(mockQuery(new MockClubMemberModel({
          club_id: clubId,
          student_id: studentId,
          semester_id: semesterId,
          status: 'rejected',
        })));

    });

    it('should delete old transfer records with the same to_membership_id when rejoining requires teacher approval', async () => {
      const previousMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: new Types.ObjectId(),
        student_id: studentId,
        semester_id: semesterId,
        status: 'left',
        occupies_slot: false,
      });

      const targetMemberId = new Types.ObjectId();
      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(null))
        .mockReturnValueOnce(mockQuery(previousMember))
        .mockReturnValueOnce(mockQuery(null));

      const startInPast = new Date();
      startInPast.setHours(startInPast.getHours() - 2);
      MockScheduleModel.findOne.mockReturnValue(mockQuery({
        start_time: startInPast,
        status: 'scheduled',
      }));

      MockTransferModel.countDocuments.mockReturnValue(mockQuery(0));

      const deleteManySpy = jest.spyOn(MockTransferModel, 'deleteMany');
      const saveSpy = jest.spyOn(MockClubMemberModel.prototype, 'save').mockImplementation(function (this: any) {
        this._id = targetMemberId;
        return Promise.resolve(this);
      });

      const res = await service.joinClub(clubId.toString(), studentId.toString(), {
        semester_id: semesterId.toString(),
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        to_membership_id: targetMemberId,
      });
      expect(res.requires_teacher_approval).toBe(true);
      expect(res.transfer).toBeDefined();

      saveSpy.mockRestore();
    });
  });

  describe('leaveClub', () => {
    it('should release occupies_slot and set status to left, and not change transfer count', async () => {
      const studentId = new Types.ObjectId();
      const semesterId = new Types.ObjectId();
      const clubId = new Types.ObjectId();

      MockStudentModel.findOne.mockReturnValue(mockQuery({ _id: studentId }));

      const mockMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: clubId,
        student_id: studentId,
        semester_id: semesterId,
        status: 'active',
        occupies_slot: true,
      });

      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));
      MockTransferModel.countDocuments.mockReturnValue(mockQuery(0));

      const res = await service.leaveClub(clubId.toString(), studentId.toString(), {
        semester_id: semesterId.toString(),
      });

      expect(mockMember.status).toBe('left');
      expect(mockMember.occupies_slot).toBe(false);
      expect(res.self_service_changes_used).toBe(0);
    });
  });

  describe('switchClub', () => {
    const studentId = new Types.ObjectId();
    const semesterId = new Types.ObjectId();
    const sourceClubId = new Types.ObjectId();
    const targetClubId = new Types.ObjectId();

    beforeEach(() => {
      MockStudentModel.findOne.mockReturnValue(mockQuery({ _id: studentId }));
      MockClubModel.findById.mockResolvedValue({
        _id: targetClubId,
        status: 'active',
        settings: { allow_self_registration: true },
      });
      MockClubMemberModel.countDocuments.mockReturnValue(mockQuery(0));
    });

    it('should complete switch successfully when changes count is less than 3 and activity has not started', async () => {
      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        student_id: studentId,
        semester_id: semesterId,
        status: 'active',
        occupies_slot: true,
      });

      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(sourceMember)) // findOccupiedMembership
        .mockReturnValueOnce(mockQuery(null)); // target membership in session

      const startInFuture = new Date();
      startInFuture.setHours(startInFuture.getHours() + 2);
      MockScheduleModel.findOne.mockReturnValue(mockQuery({
        start_time: startInFuture,
        status: 'scheduled',
      }));

      MockTransferModel.countDocuments.mockReturnValue(mockQuery(1)); // used 1 change

      const res = await service.switchClub(targetClubId.toString(), studentId.toString(), {
        semester_id: semesterId.toString(),
      });

      expect(sourceMember.status).toBe('left');
      expect(sourceMember.occupies_slot).toBe(false);
      expect(res.membership.status).toBe('active');
      expect(res.self_service_changes_used).toBe(2);
    });

    it('should reject switch with 403 when changes count is already 3', async () => {
      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        occupies_slot: true,
      });
      MockClubMemberModel.findOne.mockReturnValueOnce(mockQuery(sourceMember));

      const startInFuture = new Date();
      startInFuture.setHours(startInFuture.getHours() + 2);
      MockScheduleModel.findOne.mockReturnValue(mockQuery({
        start_time: startInFuture,
        status: 'scheduled',
      }));

      MockTransferModel.countDocuments.mockReturnValue(mockQuery(3));

      await expect(
        service.switchClub(targetClubId.toString(), studentId.toString(), {
          semester_id: semesterId.toString(),
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject switch with 403 when current club activity has started', async () => {
      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        occupies_slot: true,
      });
      MockClubMemberModel.findOne.mockReturnValueOnce(mockQuery(sourceMember));

      const startInPast = new Date();
      startInPast.setHours(startInPast.getHours() - 1);
      MockScheduleModel.findOne.mockReturnValue(mockQuery({
        start_time: startInPast,
        status: 'scheduled',
      }));

      MockTransferModel.countDocuments.mockReturnValue(mockQuery(0));

      await expect(
        service.switchClub(targetClubId.toString(), studentId.toString(), {
          semester_id: semesterId.toString(),
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject switch with 409 when no schedule exists for current club', async () => {
      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        occupies_slot: true,
      });
      MockClubMemberModel.findOne.mockReturnValueOnce(mockQuery(sourceMember));
      MockScheduleModel.findOne.mockReturnValue(mockQuery(null));

      await expect(
        service.switchClub(targetClubId.toString(), studentId.toString(), {
          semester_id: semesterId.toString(),
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should reject switch with ForbiddenException if target membership status is rejected', async () => {
      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        occupies_slot: true,
      });
      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(sourceMember))
        .mockReturnValueOnce(mockQuery(new MockClubMemberModel({
          club_id: targetClubId,
          student_id: studentId,
          semester_id: semesterId,
          status: 'rejected',
        })));

      const startInFuture = new Date();
      startInFuture.setHours(startInFuture.getHours() + 2);
      MockScheduleModel.findOne.mockReturnValue(mockQuery({
        start_time: startInFuture,
        status: 'scheduled',
      }));

      MockTransferModel.countDocuments.mockReturnValue(mockQuery(0));

      await expect(
        service.switchClub(targetClubId.toString(), studentId.toString(), {
          semester_id: semesterId.toString(),
        })
      ).rejects.toThrow(new ForbiddenException('Bạn đã bị từ chối gia nhập CLB này trong học kỳ hiện tại.'));
    });

    it('should delete old transfer records with the same to_membership_id to prevent E11000 before creating new transfer', async () => {
      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        student_id: studentId,
        semester_id: semesterId,
        status: 'active',
        occupies_slot: true,
      });

      const targetMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: targetClubId,
        student_id: studentId,
        semester_id: semesterId,
        status: 'left',
        occupies_slot: false,
      });

      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(sourceMember))
        .mockReturnValueOnce(mockQuery(targetMember))
        .mockReturnValueOnce(mockQuery(targetMember));

      const startInFuture = new Date();
      startInFuture.setHours(startInFuture.getHours() + 2);
      MockScheduleModel.findOne.mockReturnValue(mockQuery({
        start_time: startInFuture,
        status: 'scheduled',
      }));

      MockTransferModel.countDocuments.mockReturnValue(mockQuery(1));

      const deleteManySpy = jest.spyOn(MockTransferModel, 'deleteMany');

      const res = await service.switchClub(targetClubId.toString(), studentId.toString(), {
        semester_id: semesterId.toString(),
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        to_membership_id: targetMember._id,
      });
      expect(res.membership.status).toBe('active');
      expect(res.transfer).toBeDefined();
    });
  });

  describe('approveMember', () => {
    const advisorId = new Types.ObjectId();
    const otherTeacherId = new Types.ObjectId();
    const adminId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const clubId = new Types.ObjectId();
    const memberId = new Types.ObjectId();

    beforeEach(() => {
      MockClubModel.findById.mockResolvedValue({
        _id: clubId,
        advisor_id: advisorId,
      });

      MockUserModel.findById.mockImplementation((id: string) => {
        let val = null;
        if (id === adminId.toString()) {
          val = {
            _id: adminId,
            role: { role_code: 'ADMIN' },
          };
        } else if (id === advisorId.toString()) {
          val = {
            _id: advisorId,
            role: { role_code: 'TEACHER' },
          };
        } else if (id === otherTeacherId.toString()) {
          val = {
            _id: otherTeacherId,
            role: { role_code: 'TEACHER' },
          };
        } else if (id === studentId.toString()) {
          val = {
            _id: studentId,
            role: { role_code: 'STUDENT' },
          };
        }
        return {
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(val),
        };
      });
    });

    it('should complete approval successfully when requester is the assigned advisor', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const saveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));
      MockTransferModel.findOne.mockReturnValue(mockQuery(null));

      const res = await service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, advisorId.toString());

      expect(res.status).toBe('active');
      expect(res.approved_by.toString()).toBe(advisorId.toString());
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should complete approval successfully when requester is an administrator', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const saveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));
      MockTransferModel.findOne.mockReturnValue(mockQuery(null));

      const res = await service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, adminId.toString());

      expect(res.status).toBe('active');
      expect(res.approved_by.toString()).toBe(adminId.toString());
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should reject with ForbiddenException and not mutate when requester is an unassigned teacher', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const saveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));
      MockTransferModel.findOne.mockReturnValue(mockQuery(null));

      await expect(
        service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, otherTeacherId.toString())
      ).rejects.toThrow(ForbiddenException);

      expect(mockMember.status).toBe('pending');
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should reject with ForbiddenException and not mutate when requester is a student', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const saveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));
      MockTransferModel.findOne.mockReturnValue(mockQuery(null));

      await expect(
        service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, studentId.toString())
      ).rejects.toThrow(ForbiddenException);

      expect(mockMember.status).toBe('pending');
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should allow administrator to handle a pending teacher_approval transfer', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const memberSaveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));

      const mockTransfer = new MockTransferModel({
        _id: new Types.ObjectId(),
        status: 'pending',
        mode: 'teacher_approval',
        to_membership_id: memberId,
      });
      const transferSaveSpy = jest.spyOn(mockTransfer, 'save');
      MockTransferModel.findOne.mockReturnValue(mockQuery(mockTransfer));

      const res = await service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, adminId.toString());

      expect(res.status).toBe('active');
      expect(mockTransfer.status).toBe('completed');
      expect(mockTransfer.decided_by.toString()).toBe(adminId.toString());
      expect(memberSaveSpy).toHaveBeenCalled();
      expect(transferSaveSpy).toHaveBeenCalled();
    });

    it('should allow assigned advisor to handle a pending teacher_approval transfer', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const memberSaveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));

      const mockTransfer = new MockTransferModel({
        _id: new Types.ObjectId(),
        status: 'pending',
        mode: 'teacher_approval',
        to_membership_id: memberId,
      });
      const transferSaveSpy = jest.spyOn(mockTransfer, 'save');
      MockTransferModel.findOne.mockReturnValue(mockQuery(mockTransfer));

      const res = await service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, advisorId.toString());

      expect(res.status).toBe('active');
      expect(mockTransfer.status).toBe('completed');
      expect(mockTransfer.decided_by.toString()).toBe(advisorId.toString());
      expect(memberSaveSpy).toHaveBeenCalled();
      expect(transferSaveSpy).toHaveBeenCalled();
    });

    it('should reject transfer handling with ForbiddenException and not mutate when requester is unauthorized', async () => {
      const mockMember = new MockClubMemberModel({
        _id: memberId,
        club_id: clubId,
        status: 'pending',
      });
      const memberSaveSpy = jest.spyOn(mockMember, 'save');
      MockClubMemberModel.findOne.mockReturnValue(mockQuery(mockMember));

      const mockTransfer = new MockTransferModel({
        _id: new Types.ObjectId(),
        status: 'pending',
        mode: 'teacher_approval',
        to_membership_id: memberId,
      });
      const transferSaveSpy = jest.spyOn(mockTransfer, 'save');
      MockTransferModel.findOne.mockReturnValue(mockQuery(mockTransfer));

      await expect(
        service.approveMember(clubId.toString(), memberId.toString(), { status: 'active' }, studentId.toString())
      ).rejects.toThrow(ForbiddenException);

      expect(mockMember.status).toBe('pending');
      expect(mockTransfer.status).toBe('pending');
      expect(memberSaveSpy).not.toHaveBeenCalled();
      expect(transferSaveSpy).not.toHaveBeenCalled();
    });
  });

  describe('adminTransferClub', () => {
    const studentId = new Types.ObjectId();
    const semesterId = new Types.ObjectId();
    const sourceClubId = new Types.ObjectId();
    const targetClubId = new Types.ObjectId();
    const adminId = new Types.ObjectId();

    beforeEach(() => {
      MockClubModel.findById.mockResolvedValue({
        _id: targetClubId,
        status: 'active',
      });
      MockClubMemberModel.countDocuments.mockReturnValue(mockQuery(0));
    });

    it('should complete direct transfer if requester is ADMIN', async () => {
      MockUserModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: adminId,
          role: { role_code: 'ADMIN' },
        }),
      });

      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        status: 'active',
        occupies_slot: true,
      });

      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(sourceMember))
        .mockReturnValueOnce(mockQuery(null));

      const res = await service.adminTransferClub(targetClubId.toString(), adminId.toString(), {
        student_id: studentId.toString(),
        semester_id: semesterId.toString(),
      });

      expect(sourceMember.status).toBe('left');
      expect(res.membership.status).toBe('active');
    });

    it('should reject direct transfer if requester is not ADMIN', async () => {
      const nonAdminId = new Types.ObjectId();
      MockUserModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: nonAdminId,
          role: { role_code: 'STUDENT' },
        }),
      });

      await expect(
        service.adminTransferClub(targetClubId.toString(), nonAdminId.toString(), {
          student_id: studentId.toString(),
          semester_id: semesterId.toString(),
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reactivate a rejected target membership if requester is ADMIN', async () => {
      MockUserModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: adminId,
          role: { role_code: 'ADMIN' },
        }),
      });

      const sourceMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: sourceClubId,
        status: 'active',
        occupies_slot: true,
      });

      const rejectedTargetMember = new MockClubMemberModel({
        _id: new Types.ObjectId(),
        club_id: targetClubId,
        student_id: studentId,
        semester_id: semesterId,
        status: 'rejected',
        occupies_slot: false,
      });
      const saveSpy = jest.spyOn(rejectedTargetMember, 'save');

      MockClubMemberModel.findOne
        .mockReturnValueOnce(mockQuery(sourceMember))
        .mockReturnValueOnce(mockQuery(rejectedTargetMember));

      const res = await service.adminTransferClub(targetClubId.toString(), adminId.toString(), {
        student_id: studentId.toString(),
        semester_id: semesterId.toString(),
      });

      expect(sourceMember.status).toBe('left');
      expect(rejectedTargetMember.status).toBe('active');
      expect(rejectedTargetMember.occupies_slot).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
      expect(res.membership.status).toBe('active');
    });
  });
});
