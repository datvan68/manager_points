import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from '../schemas/invoice.schema';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { Room, RoomDocument } from '../schemas/room.schema';
import {
  DormitoryRosterEntry,
  DormitoryRosterEntryDocument,
} from '../schemas/dormitory-roster-entry.schema';
import {
  CreateInvoiceDto,
  PayInvoiceDto,
  BulkCreateInvoiceDto,
  CreateMonthlyInvoiceDto,
  UpdateMonthlyInvoiceDto,
  UtilityInputDto,
} from '../dto/create-invoice.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(DormitoryRosterEntry.name)
    private rosterModel: Model<DormitoryRosterEntryDocument>,
  ) {}

  /**
   * Tính toán thông số điện / nước ở server
   */
  calculateUtility(
    occupantCount: number,
    input: UtilityInputDto,
    isExempt = false,
  ) {
    const prev = Number(input.previous_reading);
    const curr = Number(input.current_reading);
    const quotaPerPerson = Number(input.quota_per_person);
    const unitPrice = Number(input.unit_price);

    if (
      isNaN(prev) ||
      isNaN(curr) ||
      isNaN(quotaPerPerson) ||
      isNaN(unitPrice)
    ) {
      throw new BadRequestException('Thông số điện/nước phải là số hợp lệ');
    }

    if (prev < 0 || curr < 0 || quotaPerPerson < 0 || unitPrice < 0) {
      throw new BadRequestException('Thông số điện/nước không được là số âm');
    }

    if (curr < prev) {
      throw new BadRequestException(
        'Chỉ số mới không được nhỏ hơn chỉ số cũ',
      );
    }

    const consumption = curr - prev;
    const quota_total = (occupantCount || 0) * quotaPerPerson;
    const excess_consumption = Math.max(consumption - quota_total, 0);
    const amount = isExempt ? 0 : excess_consumption * unitPrice;

    return {
      previous_reading: prev,
      current_reading: curr,
      consumption,
      quota_per_person: quotaPerPerson,
      quota_total,
      excess_consumption,
      unit_price: unitPrice,
      amount,
    };
  }

  /**
   * Tạo hóa đơn điện - nước hàng tháng cho phòng
   */
  async createMonthly(
    dto: CreateMonthlyInvoiceDto,
    user: any,
  ): Promise<Invoice> {
    if (!Types.ObjectId.isValid(dto.room_id)) {
      throw new BadRequestException('Mã phòng không hợp lệ');
    }

    const room = await this.roomModel.findById(dto.room_id).exec();
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dto.billing_month)) {
      throw new BadRequestException(
        'Kỳ thu phải có định dạng YYYY-MM (ví dụ: 2026-03)',
      );
    }

    const readingDate = new Date(dto.reading_date);
    if (isNaN(readingDate.getTime())) {
      throw new BadRequestException('Ngày chốt chỉ số không hợp lệ');
    }

    const dueDate = new Date(dto.due_date);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestException('Hạn kết thúc thu không hợp lệ');
    }

    let paymentStartDate: Date | undefined;
    if (dto.payment_start_date) {
      paymentStartDate = new Date(dto.payment_start_date);
      if (isNaN(paymentStartDate.getTime())) {
        throw new BadRequestException('Thời gian bắt đầu thu không hợp lệ');
      }
      if (dueDate < paymentStartDate) {
        throw new BadRequestException(
          'Hạn kết thúc thu phải sau hoặc bằng ngày bắt đầu thu',
        );
      }
    }

    // Kiểm tra trùng kỳ thu theo phòng
    const existing = await this.invoiceModel
      .findOne({
        room_id: dto.room_id,
        billing_month: dto.billing_month,
      })
      .exec();
    if (existing) {
      throw new ConflictException(
        `Hóa đơn cho phòng này trong kỳ ${dto.billing_month} đã tồn tại`,
      );
    }

    // Lấy snapshot danh sách người ở từ DormitoryRosterEntry
    const rosterEntries = await this.rosterModel
      .find({
        room_id: dto.room_id,
      })
      .exec();
    const rosterEntryIds = rosterEntries.map((r) => r._id);
    const occupantCount =
      dto.occupant_count !== undefined
        ? Number(dto.occupant_count)
        : rosterEntries.length;

    if (occupantCount < 0 || isNaN(occupantCount)) {
      throw new BadRequestException('Số người ở không hợp lệ');
    }

    const isExempt = Boolean(dto.is_exempt);
    const electricity = this.calculateUtility(
      occupantCount,
      dto.electricity,
      isExempt,
    );
    const water = this.calculateUtility(
      occupantCount,
      dto.water,
      isExempt,
    );
    const total_amount = isExempt ? 0 : electricity.amount + water.amount;

    const invoice = new this.invoiceModel({
      invoice_code: `INV-${randomUUID().substring(0, 8).toUpperCase()}`,
      room_id: dto.room_id,
      billing_month: dto.billing_month,
      reading_date: readingDate,
      occupant_count: occupantCount,
      roster_entry_ids: rosterEntryIds,
      electricity,
      water,
      is_exempt: isExempt,
      payment_start_date: paymentStartDate,
      due_date: dueDate,
      total_amount,
      status: 'Chưa thu',
      notes: dto.notes,
    });

    return invoice.save();
  }

  /**
   * Cập nhật thông số hóa đơn điện - nước trong modal Nâng cao
   */
  async updateMonthly(
    id: string,
    dto: UpdateMonthlyInvoiceDto,
    user: any,
  ): Promise<Invoice> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }

    if (invoice.status === 'Đã thu' || invoice.status === 'Đã thanh toán') {
      throw new BadRequestException('Không thể chỉnh sửa hóa đơn đã thu');
    }

    let readingDate = invoice.reading_date;
    if (dto.reading_date) {
      readingDate = new Date(dto.reading_date);
      if (isNaN(readingDate.getTime())) {
        throw new BadRequestException('Ngày chốt chỉ số không hợp lệ');
      }
    }

    let paymentStartDate = invoice.payment_start_date;
    if (dto.payment_start_date !== undefined) {
      if (dto.payment_start_date) {
        paymentStartDate = new Date(dto.payment_start_date);
        if (isNaN(paymentStartDate.getTime())) {
          throw new BadRequestException(
            'Thời gian bắt đầu thu không hợp lệ',
          );
        }
      } else {
        paymentStartDate = undefined;
      }
    }

    let dueDate = invoice.due_date;
    if (dto.due_date) {
      dueDate = new Date(dto.due_date);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Hạn kết thúc thu không hợp lệ');
      }
    }

    if (paymentStartDate && dueDate && dueDate < paymentStartDate) {
      throw new BadRequestException(
        'Hạn kết thúc thu phải sau hoặc bằng ngày bắt đầu thu',
      );
    }

    const occupantCount =
      dto.occupant_count !== undefined
        ? Number(dto.occupant_count)
        : invoice.occupant_count || 0;

    if (occupantCount < 0 || isNaN(occupantCount)) {
      throw new BadRequestException('Số người ở không hợp lệ');
    }

    const isExempt =
      dto.is_exempt !== undefined
        ? Boolean(dto.is_exempt)
        : Boolean(invoice.is_exempt);

    const electricityInput: UtilityInputDto = dto.electricity || {
      previous_reading: invoice.electricity?.previous_reading || 0,
      current_reading: invoice.electricity?.current_reading || 0,
      quota_per_person: invoice.electricity?.quota_per_person || 0,
      unit_price: invoice.electricity?.unit_price || 0,
    };

    const waterInput: UtilityInputDto = dto.water || {
      previous_reading: invoice.water?.previous_reading || 0,
      current_reading: invoice.water?.current_reading || 0,
      quota_per_person: invoice.water?.quota_per_person || 0,
      unit_price: invoice.water?.unit_price || 0,
    };

    const electricity = this.calculateUtility(
      occupantCount,
      electricityInput,
      isExempt,
    );
    const water = this.calculateUtility(
      occupantCount,
      waterInput,
      isExempt,
    );
    const total_amount = isExempt ? 0 : electricity.amount + water.amount;

    invoice.reading_date = readingDate;
    invoice.payment_start_date = paymentStartDate;
    invoice.due_date = dueDate;
    invoice.occupant_count = occupantCount;
    invoice.is_exempt = isExempt;
    invoice.electricity = electricity;
    invoice.water = water;
    invoice.total_amount = total_amount;
    if (dto.notes !== undefined) {
      invoice.notes = dto.notes;
    }

    return invoice.save();
  }

  /**
   * Lấy thông tin phòng, số người ở từ Danh sách KTX và chỉ số tháng trước
   */
  async getRoomInfo(roomId: string, billingMonth?: string) {
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('Mã phòng không hợp lệ');
    }

    const room = await this.roomModel
      .findById(roomId)
      .populate('building_id', 'building_code name')
      .exec();

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }

    const rosterEntries = await this.rosterModel
      .find({ room_id: roomId })
      .populate('student_id', 'student_code full_name')
      .exec();

    // Tìm hóa đơn gần nhất của phòng để lấy chỉ số cũ
    const lastInvoice = await this.invoiceModel
      .findOne({ room_id: roomId })
      .sort({ reading_date: -1, createdAt: -1 })
      .exec();

    return {
      room,
      occupant_count: rosterEntries.length,
      occupants: rosterEntries.map((r) => ({
        _id: r._id,
        student_id: r.student_id,
        full_name: r.full_name,
        student_code: r.student_code,
      })),
      last_readings: {
        electricity: lastInvoice?.electricity?.current_reading || 0,
        water: lastInvoice?.water?.current_reading || 0,
      },
    };
  }

  async create(dto: CreateInvoiceDto, user: any): Promise<Invoice> {
    const total_amount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    const invoice = new this.invoiceModel({
      ...dto,
      invoice_code: `INV-${randomUUID().substring(0, 8).toUpperCase()}`,
      total_amount,
      status: 'Chưa thu',
    });

    return invoice.save();
  }

  /**
   * UC07: Bulk generate invoices for all active contracts (legacy)
   */
  async bulkCreate(
    dto: BulkCreateInvoiceDto,
    user: any,
  ): Promise<{ created: number; skipped: number }> {
    const activeContracts = await this.contractModel
      .find({ status: 'Hiệu lực' })
      .populate('room_id', 'room_price')
      .exec();

    let created = 0;
    let skipped = 0;

    for (const contract of activeContracts) {
      const existing = await this.invoiceModel.findOne({
        contract_id: contract._id,
        billing_period: dto.billing_period,
      });
      if (existing) {
        skipped++;
        continue;
      }

      const room = contract.room_id as any;
      const giaPhong = room?.room_price || 0;

      const invoice = new this.invoiceModel({
        invoice_code: `INV-${randomUUID().substring(0, 8).toUpperCase()}`,
        contract_id: contract._id,
        student_id: contract.student_id,
        billing_period: dto.billing_period,
        items: [
          {
            type: 'Phí phòng',
            description: `Phí phòng kỳ ${dto.billing_period}`,
            amount: giaPhong,
          },
        ],
        total_amount: giaPhong,
        status: 'Chưa thu',
        due_date: new Date(dto.due_date),
      });

      await invoice.save();
      created++;
    }

    return { created, skipped };
  }

  async findAll(query: {
    room_id?: string;
    billing_month?: string;
    student_id?: string;
    contract_id?: string;
    status?: string;
    billing_period?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.room_id) filter.room_id = query.room_id;
    if (query.billing_month) filter.billing_month = query.billing_month;
    if (query.student_id) filter.student_id = query.student_id;
    if (query.contract_id) filter.contract_id = query.contract_id;
    if (query.billing_period) filter.billing_period = query.billing_period;

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
      // Tìm phòng theo mã phòng / tên phòng
      const matchingRooms = await this.roomModel
        .find({
          $or: [{ room_code: searchRegex }, { room_name: searchRegex }],
        })
        .select('_id')
        .exec();
      const roomIds = matchingRooms.map((r) => r._id);

      filter.$or = [
        { invoice_code: searchRegex },
        { billing_month: searchRegex },
        { billing_period: searchRegex },
        ...(roomIds.length > 0 ? [{ room_id: { $in: roomIds } }] : []),
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .populate({
          path: 'room_id',
          populate: { path: 'building_id', select: 'building_code name' },
        })
        .populate('student_id', 'student_code full_name')
        .populate('contract_id', 'contract_code')
        .populate('confirmed_by_id', 'user_name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.invoiceModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceModel
      .findById(id)
      .populate({
        path: 'room_id',
        populate: { path: 'building_id', select: 'building_code name' },
      })
      .populate('roster_entry_ids')
      .populate('student_id', 'student_code full_name')
      .populate('contract_id', 'contract_code')
      .populate('confirmed_by_id', 'user_name full_name email')
      .exec();

    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }
    return invoice;
  }

  /**
   * UC08: Confirm payment with proof
   */
  async pay(id: string, dto: PayInvoiceDto, user: any): Promise<Invoice> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }
    if (invoice.status === 'Đã thu' || invoice.status === 'Đã thanh toán') {
      throw new BadRequestException('Hóa đơn đã được thanh toán');
    }

    invoice.status = 'Đã thu';
    invoice.payment_method = dto.payment_method;
    invoice.paid_at = new Date();
    invoice.confirmed_by_id = user._id || user.userId;
    invoice.notes = dto.notes || invoice.notes;

    if (dto.payment_proof) {
      invoice.payment_proof = {
        url: dto.payment_proof.url,
        file_name: dto.payment_proof.file_name,
        mime_type: dto.payment_proof.mime_type,
        size: dto.payment_proof.size,
        uploaded_at: new Date(),
      };
    } else if (dto.proof_url) {
      invoice.payment_proof = {
        url: dto.proof_url,
        uploaded_at: new Date(),
      };
    }

    return invoice.save();
  }

  /**
   * FR09: Get overdue summary
   */
  async getOverdueSummary() {
    const overdue = await this.invoiceModel
      .find({
        status: { $in: ['Chưa thu', 'Chưa thanh toán'] },
        due_date: { $lt: new Date() },
      })
      .populate('student_id', 'student_code full_name')
      .populate('room_id', 'room_code room_name')
      .sort({ due_date: 1 })
      .exec();

    return {
      total_overdue: overdue.length,
      total_amount: overdue.reduce((sum, inv) => sum + inv.total_amount, 0),
      invoices: overdue,
    };
  }
}
