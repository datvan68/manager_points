import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  RoomFeeInvoice,
  RoomFeeInvoiceDocument,
} from '../schemas/room-fee-invoice.schema';
import {
  RoomFeeConfig,
  RoomFeeConfigDocument,
} from '../schemas/room-fee-config.schema';
import {
  DormitoryRosterEntry,
  DormitoryRosterEntryDocument,
} from '../schemas/dormitory-roster-entry.schema';
import { Room, RoomDocument } from '../schemas/room.schema';
import {
  UpdateRoomFeeConfigDto,
  PreviewRoomFeePeriodDto,
  CreateRoomFeePeriodDto,
  PayRoomFeeInvoiceDto,
  UpdateRoomFeeProofDto,
  QueryRoomFeeInvoiceDto,
} from '../dto/room-fee-invoice.dto';

@Injectable()
export class RoomFeeInvoicesService {
  constructor(
    @InjectModel(RoomFeeInvoice.name)
    private roomFeeInvoiceModel: Model<RoomFeeInvoiceDocument>,
    @InjectModel(RoomFeeConfig.name)
    private roomFeeConfigModel: Model<RoomFeeConfigDocument>,
    @InjectModel(DormitoryRosterEntry.name)
    private rosterModel: Model<DormitoryRosterEntryDocument>,
    @InjectModel(Room.name)
    private roomModel: Model<RoomDocument>,
  ) {}

  /**
   * Tính toán tháng kết thúc từ start_month ('YYYY-MM') và số tháng thu
   */
  calculatePeriodEnd(startMonth: string, monthsCount: number): string {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) {
      throw new BadRequestException(
        'Kỳ bắt đầu phải có định dạng YYYY-MM (ví dụ: 2026-03)',
      );
    }
    if (!monthsCount || monthsCount < 1) {
      throw new BadRequestException('Số tháng thu phải lớn hơn hoặc bằng 1');
    }

    const [yearStr, monthStr] = startMonth.split('-');
    const startYear = parseInt(yearStr, 10);
    const startMonthNum = parseInt(monthStr, 10);

    const totalMonths = startYear * 12 + (startMonthNum - 1) + (monthsCount - 1);
    const endYear = Math.floor(totalMonths / 12);
    const endMonthNum = (totalMonths % 12) + 1;

    return `${endYear}-${String(endMonthNum).padStart(2, '0')}`;
  }

  /**
   * Lấy cấu hình thu phí phòng
   */
  async getConfig(): Promise<RoomFeeConfigDocument> {
    let config = await this.roomFeeConfigModel.findOne().exec();
    if (!config) {
      config = new this.roomFeeConfigModel({
        standard_monthly_rate: 500000,
        air_conditioned_monthly_rate: 700000,
        months_to_collect: 5,
      });
      await config.save();
    }
    return config;
  }

  /**
   * Cập nhật cấu hình thu phí phòng
   */
  async updateConfig(
    dto: UpdateRoomFeeConfigDto,
    user: any,
  ): Promise<RoomFeeConfigDocument> {
    let config = await this.roomFeeConfigModel.findOne().exec();
    if (!config) {
      config = new this.roomFeeConfigModel();
    }

    config.standard_monthly_rate = Number(dto.standard_monthly_rate);
    config.air_conditioned_monthly_rate = Number(
      dto.air_conditioned_monthly_rate,
    );
    config.months_to_collect = Number(dto.months_to_collect);

    if (dto.transfer_qr_image) {
      config.transfer_qr_image = {
        url: dto.transfer_qr_image.url,
        file_name: dto.transfer_qr_image.file_name,
        mime_type: dto.transfer_qr_image.mime_type,
        size: dto.transfer_qr_image.size,
        uploaded_at: new Date(),
      };
    }

    if (user?._id || user?.userId) {
      config.updated_by_id = user._id || user.userId;
    }

    return config.save();
  }

  /**
   * Xem trước kết quả lập đợt thu phí phòng
   */
  async previewPeriod(dto: PreviewRoomFeePeriodDto) {
    const config = await this.getConfig();
    const monthsCount = dto.months_count || config.months_to_collect || 5;
    const endMonth = this.calculatePeriodEnd(dto.start_month, monthsCount);

    // Lấy tất cả thành viên trong Roster có gắn phòng
    const rosterEntries = await this.rosterModel
      .find({ room_id: { $ne: null } })
      .populate('room_id')
      .exec();

    // Tìm các hóa đơn phí phòng đã tạo cho đợt này
    const existingInvoices = await this.roomFeeInvoiceModel
      .find({
        start_month: dto.start_month,
        end_month: endMonth,
      })
      .select('roster_entry_id')
      .exec();

    const existingRosterIds = new Set(
      existingInvoices.map((inv) => String(inv.roster_entry_id)),
    );

    let eligibleCount = 0;
    let standardCount = 0;
    let acCount = 0;
    let skippedExistingCount = 0;
    let invalidAssignmentCount = 0;
    let expectedTotalAmount = 0;

    for (const entry of rosterEntries) {
      const room = entry.room_id as any;
      if (!room || !room._id) {
        invalidAssignmentCount++;
        continue;
      }

      const roomType = room.room_type;
      if (roomType !== 'Thường' && roomType !== 'Máy lạnh') {
        invalidAssignmentCount++;
        continue;
      }

      if (existingRosterIds.has(String(entry._id))) {
        skippedExistingCount++;
        continue;
      }

      const rate =
        roomType === 'Máy lạnh'
          ? config.air_conditioned_monthly_rate
          : config.standard_monthly_rate;

      const itemTotal = rate * monthsCount;

      eligibleCount++;
      if (roomType === 'Máy lạnh') {
        acCount++;
      } else {
        standardCount++;
      }
      expectedTotalAmount += itemTotal;
    }

    return {
      start_month: dto.start_month,
      end_month: endMonth,
      months_count: monthsCount,
      standard_monthly_rate: config.standard_monthly_rate,
      air_conditioned_monthly_rate: config.air_conditioned_monthly_rate,
      total_assigned: rosterEntries.length,
      eligible_count: eligibleCount,
      eligible_standard_count: standardCount,
      eligible_ac_count: acCount,
      skipped_existing_count: skippedExistingCount,
      invalid_assignment_count: invalidAssignmentCount,
      expected_total_amount: expectedTotalAmount,
    };
  }

  /**
   * Lập đợt thu phí phòng cho toàn bộ thành viên đang được xếp phòng
   */
  async createPeriod(dto: CreateRoomFeePeriodDto, user: any) {
    const config = await this.getConfig();
    const monthsCount = dto.months_count || config.months_to_collect || 5;
    const endMonth = this.calculatePeriodEnd(dto.start_month, monthsCount);
    const dueDate = dto.due_date ? new Date(dto.due_date) : undefined;
    const creatorId = user?._id || user?.userId;

    const rosterEntries = await this.rosterModel
      .find({ room_id: { $ne: null } })
      .populate('room_id')
      .exec();

    let createdCount = 0;
    let skippedCount = 0;
    let invalidCount = 0;
    let totalAmount = 0;
    const createdIds: string[] = [];

    for (const entry of rosterEntries) {
      const room = entry.room_id as any;
      if (!room || !room._id) {
        invalidCount++;
        continue;
      }

      const roomType = room.room_type;
      if (roomType !== 'Thường' && roomType !== 'Máy lạnh') {
        invalidCount++;
        continue;
      }

      const rate =
        roomType === 'Máy lạnh'
          ? config.air_conditioned_monthly_rate
          : config.standard_monthly_rate;

      const itemTotal = rate * monthsCount;
      const invoiceCode = `RFI-${randomUUID().substring(0, 8).toUpperCase()}`;

      try {
        const invoice = new this.roomFeeInvoiceModel({
          invoice_code: invoiceCode,
          roster_entry_id: entry._id,
          student_id: entry.student_id,
          room_id: room._id,
          semester_id: entry.semester_id,
          member_name: entry.full_name,
          member_code: entry.student_code,
          room_code: room.room_code,
          room_name: room.room_name,
          room_type: roomType,
          monthly_rate: rate,
          start_month: dto.start_month,
          end_month: endMonth,
          months_count: monthsCount,
          line_description: `Phí phòng ${roomType} (${monthsCount} tháng: ${dto.start_month} - ${endMonth})`,
          total_amount: itemTotal,
          status: 'Chưa thu',
          due_date: dueDate,
          notes: dto.notes,
          created_by_id: creatorId,
        });

        await invoice.save();
        createdCount++;
        totalAmount += itemTotal;
        createdIds.push(String(invoice._id));
      } catch (err: any) {
        // Nếu vi phạm unique index (roster_entry_id + start_month + end_month)
        if (err.code === 11000) {
          skippedCount++;
        } else {
          throw err;
        }
      }
    }

    return {
      start_month: dto.start_month,
      end_month: endMonth,
      months_count: monthsCount,
      created_count: createdCount,
      skipped_count: skippedCount,
      invalid_count: invalidCount,
      total_amount: totalAmount,
      created_ids: createdIds,
    };
  }

  /**
   * Danh sách hóa đơn phí phòng có phân trang và bộ lọc
   */
  async findAll(query: QueryRoomFeeInvoiceDto) {
    const filter: any = {};

    if (query.room_id) {
      filter.room_id = query.room_id;
    }
    if (query.start_month) {
      filter.start_month = query.start_month;
    }
    if (query.end_month) {
      filter.end_month = query.end_month;
    }

    if (query.status) {
      if (query.status === 'Chưa thu') {
        filter.status = { $in: ['Chưa thu', 'Chưa thanh toán', 'Quá hạn'] };
      } else if (query.status === 'Đã thu') {
        filter.status = { $in: ['Đã thu', 'Đã thanh toán'] };
      } else {
        filter.status = query.status;
      }
    }

    if (query.search) {
      const searchRegex = { $regex: query.search, $options: 'i' };
      filter.$or = [
        { invoice_code: searchRegex },
        { member_name: searchRegex },
        { member_code: searchRegex },
        { room_code: searchRegex },
        { room_name: searchRegex },
        { start_month: searchRegex },
        { end_month: searchRegex },
      ];
    }

    const page = query.page ? Math.max(1, Number(query.page)) : 1;
    const limit = query.limit ? Math.max(1, Number(query.limit)) : 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.roomFeeInvoiceModel
        .find(filter)
        .populate({
          path: 'room_id',
          populate: { path: 'building_id', select: 'building_code name' },
        })
        .populate('roster_entry_id')
        .populate('student_id', 'student_code full_name')
        .populate('confirmed_by_id', 'user_name full_name')
        .populate('created_by_id', 'user_name full_name')
        .populate('payment_review.reviewed_by_id', 'user_name full_name')
        .populate('payment_review.revoked_by_id', 'user_name full_name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.roomFeeInvoiceModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Chi tiết một hóa đơn phí phòng
   */
  async findOne(id: string): Promise<RoomFeeInvoice> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID hóa đơn không hợp lệ');
    }

    const invoice = await this.roomFeeInvoiceModel
      .findById(id)
      .populate({
        path: 'room_id',
        populate: { path: 'building_id', select: 'building_code name' },
      })
      .populate('roster_entry_id')
      .populate('student_id', 'student_code full_name')
      .populate('confirmed_by_id', 'user_name full_name email')
      .populate('created_by_id', 'user_name full_name')
      .populate('payment_review.reviewed_by_id', 'user_name full_name')
      .populate('payment_review.revoked_by_id', 'user_name full_name')
      .exec();

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn phí phòng: ${id}`);
    }

    return invoice;
  }

  /**
   * Thanh toán hóa đơn phí phòng (Tiền mặt hoặc Chuyển khoản kèm chứng từ)
   */
  async pay(
    id: string,
    dto: PayRoomFeeInvoiceDto,
    user: any,
  ): Promise<RoomFeeInvoice> {
    const invoice = await this.roomFeeInvoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }

    if (invoice.status === 'Đã thu' || invoice.status === 'Đã thanh toán') {
      throw new BadRequestException('Hóa đơn đã được thanh toán');
    }

    const hasTransferProof =
      dto.payment_method === 'Chuyển khoản' &&
      !!(dto.payment_proof || dto.proof_url);

    const now = new Date();
    const userId = user?._id || user?.userId;

    invoice.status = hasTransferProof ? 'Chưa thu' : 'Đã thu';
    invoice.payment_method = dto.payment_method;
    invoice.paid_at = hasTransferProof ? undefined : now;
    invoice.confirmed_by_id = hasTransferProof ? undefined : userId;
    invoice.notes = dto.notes || invoice.notes;

    if (dto.payment_proof) {
      invoice.payment_proof = {
        url: dto.payment_proof.url,
        file_name: dto.payment_proof.file_name,
        mime_type: dto.payment_proof.mime_type,
        size: dto.payment_proof.size,
        uploaded_at: now,
      };
    } else if (dto.proof_url) {
      invoice.payment_proof = {
        url: dto.proof_url,
        uploaded_at: now,
      };
    }

    if (hasTransferProof) {
      invoice.payment_review = {
        status: 'pending',
        submitted_at: now,
      };
    }

    return invoice.save();
  }

  /**
   * Cập nhật chứng từ thanh toán cho hóa đơn phí phòng
   */
  async updatePaymentProof(
    id: string,
    dto: UpdateRoomFeeProofDto,
    user: any,
  ): Promise<RoomFeeInvoice> {
    const invoice = await this.roomFeeInvoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }

    const originalStatus = invoice.status;
    const originalReviewStatus = invoice.payment_review?.status;
    const update: any = { $set: {}, $unset: {} };

    if (dto.payment_method) {
      update.$set.payment_method = dto.payment_method;
      invoice.payment_method = dto.payment_method;
    }
    if (dto.notes !== undefined) {
      update.$set.notes = dto.notes;
      invoice.notes = dto.notes;
    }

    if (dto.payment_proof) {
      invoice.payment_proof = {
        url: dto.payment_proof.url,
        file_name: dto.payment_proof.file_name,
        mime_type: dto.payment_proof.mime_type,
        size: dto.payment_proof.size,
        uploaded_at: new Date(),
      };
      update.$set.payment_proof = invoice.payment_proof;
    } else if (dto.proof_url) {
      invoice.payment_proof = {
        url: dto.proof_url,
        uploaded_at: new Date(),
      };
      update.$set.payment_proof = invoice.payment_proof;
    }

    if (dto.payment_proof || dto.proof_url) {
      const submittedAt = new Date();
      invoice.payment_review = {
        ...invoice.payment_review,
        status: 'pending',
        submitted_at: submittedAt,
      };
      update.$set['payment_review.status'] = 'pending';
      update.$set['payment_review.submitted_at'] = submittedAt;
      update.$unset['payment_review.reviewed_by_id'] = 1;
      update.$unset['payment_review.reviewed_at'] = 1;
      update.$unset['payment_review.revoked_by_id'] = 1;
      update.$unset['payment_review.revoked_at'] = 1;

      if (invoice.status === 'Đã thu' || invoice.status === 'Đã thanh toán') {
        invoice.status = 'Chưa thu';
        invoice.paid_at = undefined;
        invoice.confirmed_by_id = undefined;
        update.$set.status = 'Chưa thu';
        update.$unset.paid_at = 1;
        update.$unset.confirmed_by_id = 1;
      }
    }

    if (!Object.keys(update.$unset).length) {
      delete update.$unset;
    }

    const updateResult = await this.roomFeeInvoiceModel
      .updateOne(
        {
          _id: id,
          status: originalStatus,
          'payment_review.status': originalReviewStatus,
        },
        update,
      )
      .exec();

    if (updateResult.modifiedCount !== 1) {
      throw new BadRequestException(
        'Hóa đơn đã thay đổi, vui lòng tải lại trước khi cập nhật chứng từ',
      );
    }

    return invoice;
  }

  /**
   * Duyệt / Không duyệt / Bỏ duyệt chứng từ thanh toán
   */
  async reviewPaymentProof(
    id: string,
    decision: 'approved' | 'rejected' | 'revoked',
    user: any,
    requestId = `${decision}-${id}-${Date.now()}`,
  ): Promise<RoomFeeInvoice> {
    const invoice = await this.roomFeeInvoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }

    if (invoice.payment_method !== 'Chuyển khoản' || !invoice.payment_proof) {
      throw new BadRequestException('Hóa đơn chưa có chứng từ chuyển khoản');
    }

    const now = new Date();
    const userId = user?._id || user?.userId;

    if (decision === 'revoked') {
      if (
        invoice.payment_review?.status !== 'approved' ||
        invoice.status !== 'Đã thu'
      ) {
        throw new BadRequestException('Chứng từ không ở trạng thái đã duyệt');
      }

      const updateResult = await this.roomFeeInvoiceModel
        .updateOne(
          {
            _id: id,
            payment_method: 'Chuyển khoản',
            'payment_review.status': 'approved',
            status: 'Đã thu',
            payment_proof: { $exists: true },
          },
          {
            $set: {
              'payment_review.status': 'pending',
              'payment_review.revoked_by_id': userId,
              'payment_review.revoked_at': now,
              status: 'Chưa thu',
            },
            $unset: { paid_at: 1, confirmed_by_id: 1 },
          },
        )
        .exec();

      if (updateResult.modifiedCount !== 1) {
        throw new BadRequestException('Chứng từ không ở trạng thái đã duyệt');
      }

      invoice.payment_review = {
        ...invoice.payment_review,
        status: 'pending',
        revoked_by_id: userId,
        revoked_at: now,
      };
      invoice.status = 'Chưa thu';
      invoice.paid_at = undefined;
      invoice.confirmed_by_id = undefined;
      return invoice;
    }

    if (invoice.payment_review?.status !== 'pending') {
      throw new BadRequestException('Chứng từ không ở trạng thái chờ duyệt');
    }

    if (decision === 'approved') {
      const updateResult = await this.roomFeeInvoiceModel
        .updateOne(
          {
            _id: id,
            payment_method: 'Chuyển khoản',
            'payment_review.status': 'pending',
            status: { $in: ['Chưa thu', 'Chưa thanh toán'] },
            payment_proof: { $exists: true },
          },
          {
            $set: {
              'payment_review.status': 'approved',
              'payment_review.reviewed_by_id': userId,
              'payment_review.reviewed_at': now,
              status: 'Đã thu',
              paid_at: now,
              confirmed_by_id: userId,
            },
          },
        )
        .exec();

      if (updateResult.modifiedCount !== 1) {
        throw new BadRequestException('Chứng từ không ở trạng thái chờ duyệt');
      }

      invoice.payment_review = {
        ...invoice.payment_review,
        status: 'approved',
        reviewed_by_id: userId,
        reviewed_at: now,
      };
      invoice.status = 'Đã thu';
      invoice.paid_at = now;
      invoice.confirmed_by_id = userId;
    } else {
      // rejected
      const attempt = {
        decision: 'rejected' as const,
        reviewed_by_id: userId,
        reviewed_at: now,
        request_id: requestId,
      };

      const updateResult = await this.roomFeeInvoiceModel
        .updateOne(
          {
            _id: id,
            payment_method: 'Chuyển khoản',
            'payment_review.status': 'pending',
            'payment_review.attempts.request_id': { $ne: requestId },
            status: { $in: ['Chưa thu', 'Chưa thanh toán'] },
            payment_proof: { $exists: true },
          },
          {
            $push: { 'payment_review.attempts': attempt },
            $set: { status: 'Chưa thu' },
            $unset: { paid_at: 1, confirmed_by_id: 1 },
          },
        )
        .exec();

      if (updateResult.modifiedCount !== 1) {
        throw new BadRequestException('Chứng từ không ở trạng thái chờ duyệt');
      }

      invoice.payment_review = {
        ...invoice.payment_review,
        status: 'pending',
        attempts: [...(invoice.payment_review?.attempts || []), attempt],
      };
      invoice.status = 'Chưa thu';
      invoice.paid_at = undefined;
      invoice.confirmed_by_id = undefined;
    }

    return invoice;
  }

  /**
   * Duyệt hàng loạt chứng từ thanh toán
   */
  async bulkReviewPaymentProof(
    ids: string[],
    decision: 'approved' | 'rejected',
    user: any,
    requestId: string,
  ) {
    const uniqueIds = [
      ...new Set(
        (ids || [])
          .map(String)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    if (!uniqueIds.length) {
      throw new BadRequestException('Danh sách ID hóa đơn không được rỗng');
    }

    const results = await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const invoice = await this.reviewPaymentProof(
            id,
            decision,
            user,
            `${requestId}:${id}`,
          );
          return { id, outcome: 'approved' as const, invoice };
        } catch (error: any) {
          const outcome =
            error?.status === 404
              ? ('skipped' as const)
              : ('failed' as const);
          return {
            id,
            outcome,
            error: error?.message || 'Không thể duyệt chứng từ',
          };
        }
      }),
    );

    return { requested: uniqueIds.length, results };
  }

  /**
   * Xóa nhiều hóa đơn chưa thu
   */
  async bulkDelete(ids: string[], user: any) {
    const uniqueIds = [
      ...new Set(
        (ids || [])
          .map(String)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    if (!uniqueIds.length) {
      throw new BadRequestException('Danh sách ID hóa đơn không được rỗng');
    }

    const invoices = await this.roomFeeInvoiceModel
      .find({ _id: { $in: uniqueIds } })
      .exec();

    const deleted: string[] = [];
    const not_found: string[] = [];
    const rejected: Array<{ id: string; invoice_code?: string; reason: string }> =
      [];

    const invoiceMap = new Map(invoices.map((inv) => [String(inv._id), inv]));

    for (const id of uniqueIds) {
      const inv = invoiceMap.get(id);
      if (!inv) {
        not_found.push(id);
        continue;
      }

      if (inv.status === 'Đã thu' || inv.status === 'Đã thanh toán') {
        rejected.push({
          id,
          invoice_code: inv.invoice_code,
          reason: 'Không thể xóa hóa đơn đã thanh toán',
        });
        continue;
      }

      await this.roomFeeInvoiceModel.deleteOne({ _id: id }).exec();
      deleted.push(id);
    }

    return {
      requested: uniqueIds.length,
      deleted,
      not_found,
      rejected,
    };
  }
}
