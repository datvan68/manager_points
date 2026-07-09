import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PublicRegistration,
  PublicRegistrationDocument,
} from '../schemas/public-registration.schema';
import {
  Registration,
  RegistrationDocument,
} from '../schemas/registration.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service to auto-link public QR registrations with actual students.
 *
 * When a user registers via QR (as non-student), a PublicRegistration is created.
 * Later, when they become a student (enrolled + assigned to a class), this service
 * matches the public registration and converts it to a formal Registration.
 *
 * Matching criteria (priority order):
 * 1. student_code (exact match)
 * 2. email (exact match)
 * 3. full_name + phone (fuzzy)
 */
@Injectable()
export class PublicRegistrationLinkService {
  private readonly logger = new Logger(PublicRegistrationLinkService.name);

  constructor(
    @InjectModel(PublicRegistration.name)
    private publicRegModel: Model<PublicRegistrationDocument>,
    @InjectModel(Registration.name)
    private registrationModel: Model<RegistrationDocument>,
    @InjectModel(Student.name)
    private studentModel: Model<StudentDocument>,
  ) {}

  /**
   * Auto-link: find pending public registrations that match existing students.
   * Can be called:
   * - By admin via API (manual trigger)
   * - By a scheduled job (cron)
   * - After student creation/import
   *
   * Returns count of converted registrations.
   */
  async autoLinkPendingRegistrations(): Promise<{
    matched: number;
    converted: number;
    details: { ma_dk_public: string; student_code: string; ho_ten: string }[];
  }> {
    // Get all pending public registrations
    const pendingRegs = await this.publicRegModel.find({
      trang_thai: 'Chờ xác nhận',
    });

    if (pendingRegs.length === 0) {
      return { matched: 0, converted: 0, details: [] };
    }

    const details: { ma_dk_public: string; student_code: string; ho_ten: string }[] = [];
    let converted = 0;

    for (const pubReg of pendingRegs) {
      let student: StudentDocument | null = null;

      // Priority 1: Match by student_code
      if (pubReg.ma_sinh_vien) {
        student = await this.studentModel.findOne({
          student_code: pubReg.ma_sinh_vien,
          status: 'Studying',
        });
      }

      // Priority 2: Match by email
      if (!student && pubReg.email) {
        student = await this.studentModel.findOne({
          email: pubReg.email,
          status: 'Studying',
        });
      }

      if (!student) continue;

      // Check student has a class (is enrolled)
      if (!student.class_id) continue;

      // Check if student already has an active formal registration
      const existingReg = await this.registrationModel.findOne({
        student_id: (student as any)._id,
        trang_thai: { $in: ['Chờ duyệt', 'Đã duyệt'] },
      });

      if (existingReg) {
        // Already has a formal registration — just mark public reg as linked
        pubReg.trang_thai = 'Đã xác nhận';
        (pubReg as any).linked_student_id = (student as any)._id;
        (pubReg as any).linked_registration_id = existingReg._id;
        await pubReg.save();
        continue;
      }

      // Convert public registration → formal registration
      const formalReg = new this.registrationModel({
        ma_dk: `DK-${uuidv4().substring(0, 8).toUpperCase()}`,
        student_id: (student as any)._id,
        ky_hoc: pubReg.ky_hoc,
        nam_hoc: pubReg.nam_hoc,
        nguyen_vong: {
          loai_phong: pubReg.loai_phong || undefined,
          ghi_chu: `Tự động chuyển từ đăng ký QR (${pubReg.ma_dk_public}). SĐT: ${pubReg.so_dien_thoai}`,
        },
        doi_tuong_uu_tien: pubReg.doi_tuong_uu_tien || 'Không',
        trang_thai: 'Chờ duyệt',
      });
      await formalReg.save();

      // Update public registration status
      pubReg.trang_thai = 'Đã xác nhận';
      (pubReg as any).linked_student_id = (student as any)._id;
      (pubReg as any).linked_registration_id = formalReg._id;
      await pubReg.save();

      converted++;
      details.push({
        ma_dk_public: pubReg.ma_dk_public,
        student_code: student.student_code,
        ho_ten: student.full_name,
      });

      this.logger.log(
        `Auto-linked: ${pubReg.ma_dk_public} → ${student.student_code} (${student.full_name})`,
      );
    }

    return {
      matched: details.length,
      converted,
      details,
    };
  }

  /**
   * Check a single student against pending public registrations.
   * Call this when a student is newly created or assigned to a class.
   */
  async checkStudentLink(studentId: string): Promise<boolean> {
    const student = await this.studentModel.findById(studentId);
    if (!student || !student.class_id || student.status !== 'Studying') {
      return false;
    }

    // Find matching public registration
    const conditions: any[] = [];
    if (student.email) {
      conditions.push({ email: student.email });
    }
    conditions.push({ ma_sinh_vien: student.student_code });

    const pubReg = await this.publicRegModel.findOne({
      trang_thai: 'Chờ xác nhận',
      $or: conditions,
    });

    if (!pubReg) return false;

    // Check if already has formal registration
    const existingReg = await this.registrationModel.findOne({
      student_id: (student as any)._id,
      trang_thai: { $in: ['Chờ duyệt', 'Đã duyệt'] },
    });

    if (existingReg) {
      pubReg.trang_thai = 'Đã xác nhận';
      await pubReg.save();
      return true;
    }

    // Create formal registration
    const formalReg = new this.registrationModel({
      ma_dk: `DK-${uuidv4().substring(0, 8).toUpperCase()}`,
      student_id: (student as any)._id,
      ky_hoc: pubReg.ky_hoc,
      nam_hoc: pubReg.nam_hoc,
      nguyen_vong: {
        loai_phong: pubReg.loai_phong || undefined,
        ghi_chu: `Tự động từ đăng ký QR (${pubReg.ma_dk_public})`,
      },
      doi_tuong_uu_tien: pubReg.doi_tuong_uu_tien || 'Không',
      trang_thai: 'Chờ duyệt',
    });
    await formalReg.save();

    pubReg.trang_thai = 'Đã xác nhận';
    await pubReg.save();

    this.logger.log(
      `Single link: ${pubReg.ma_dk_public} → ${student.student_code}`,
    );
    return true;
  }

  /**
   * Get all public registrations for admin review.
   */
  async getAllPublicRegistrations(query: {
    trang_thai?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.trang_thai) filter.trang_thai = query.trang_thai;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await Promise.all([
      this.publicRegModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('room_id', 'ma_phong')
        .lean(),
      this.publicRegModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
