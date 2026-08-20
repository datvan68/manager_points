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
  UtilityConfig,
  UtilityConfigDocument,
} from '../schemas/utility-config.schema';
import {
  CreateInvoiceDto,
  PayInvoiceDto,
  UpdatePaymentProofDto,
  BulkCreateInvoiceDto,
  CreateMonthlyInvoiceDto,
  UpdateMonthlyInvoiceDto,
  UtilityInputDto,
} from '../dto/create-invoice.dto';
import { UpdateUtilityConfigDto } from '../dto/utility-config.dto';
import { BulkMeterReadingsDto } from '../dto/bulk-meter-readings.dto';
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
    @InjectModel(UtilityConfig.name)
    private utilityConfigModel: Model<UtilityConfigDocument>,
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
   * Cập nhật chứng từ thanh toán cho hóa đơn
   */
  async updatePaymentProof(
    id: string,
    dto: UpdatePaymentProofDto,
    user: any,
  ): Promise<Invoice> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }
    if (dto.payment_method) {
      invoice.payment_method = dto.payment_method;
    }
    if (dto.notes !== undefined) {
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
    } else if (dto.proof_url) {
      invoice.payment_proof = {
        url: dto.proof_url,
        uploaded_at: new Date(),
      };
    }
    if (user?._id || user?.userId) {
      invoice.confirmed_by_id = user._id || user.userId;
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

  /**
   * Lấy cấu hình dùng chung điện - nước và hạn thu tự động
   */
  async getUtilityConfig(): Promise<UtilityConfigDocument> {
    let config = await this.utilityConfigModel.findOne().exec();
    if (!config) {
      config = new this.utilityConfigModel({
        electricity: {
          quota_per_person: 15,
          unit_price: 2500,
          unit: 'kWh',
        },
        water: {
          quota_per_person: 4,
          unit_price: 10000,
          unit: 'm³',
        },
        configured_collection_days: 10,
      });
      await config.save();
    }
    return config;
  }

  /**
   * Cập nhật cấu hình dùng chung điện - nước và hạn thu tự động
   */
  async updateUtilityConfig(
    dto: UpdateUtilityConfigDto,
    user: any,
  ): Promise<UtilityConfigDocument> {
    let config = await this.utilityConfigModel.findOne().exec();
    if (!config) {
      config = new this.utilityConfigModel();
    }
    config.electricity = {
      quota_per_person: Number(dto.electricity.quota_per_person),
      unit_price: Number(dto.electricity.unit_price),
      unit: dto.electricity.unit || 'kWh',
    };
    config.water = {
      quota_per_person: Number(dto.water.quota_per_person),
      unit_price: Number(dto.water.unit_price),
      unit: dto.water.unit || 'm³',
    };
    config.configured_collection_days = Number(dto.configured_collection_days);
    if (user?._id || user?.userId) {
      config.updated_by_id = user._id || user.userId;
    }
    return config.save();
  }

  /**
   * Lấy danh sách toàn bộ phòng cho kỳ thu kèm chỉ số cũ
   */
  async getMeterReadings(billingMonth: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
      throw new BadRequestException(
        'Kỳ thu phải có định dạng YYYY-MM (ví dụ: 2026-03)',
      );
    }

    const config = await this.getUtilityConfig();

    // Lấy toàn bộ danh sách phòng trong hệ thống kèm thông tin tòa nhà
    const allRooms = await this.roomModel
      .find()
      .populate({ path: 'building_id', select: 'building_code name' })
      .exec();

    // Lấy danh sách roster entries có gắn phòng để tính số người ở
    const rosterEntries = await this.rosterModel
      .find({ room_id: { $ne: null } })
      .exec();

    // Nhóm roster entries theo room_id
    const rosterMap = new Map<
      string,
      { occupantCount: number; rosterEntryIds: Types.ObjectId[] }
    >();
    for (const entry of rosterEntries) {
      if (!entry.room_id) continue;
      const roomIdStr = String(
        (entry.room_id as any)?._id || entry.room_id,
      );
      if (!rosterMap.has(roomIdStr)) {
        rosterMap.set(roomIdStr, {
          occupantCount: 0,
          rosterEntryIds: [],
        });
      }
      const group = rosterMap.get(roomIdStr)!;
      group.occupantCount += 1;
      group.rosterEntryIds.push(entry._id);
    }

    const roomsData: any[] = [];
    for (const room of allRooms) {
      const roomIdStr = String(room._id);
      const rosterInfo = rosterMap.get(roomIdStr) || {
        occupantCount: 0,
        rosterEntryIds: [],
      };

      // Hóa đơn hiện tại trong kỳ này
      const currentInvoice = await this.invoiceModel
        .findOne({
          room_id: roomIdStr,
          billing_month: billingMonth,
        })
        .exec();

      // Hóa đơn gần nhất trước kỳ này
      const lastInvoice = await this.invoiceModel
        .findOne({
          room_id: roomIdStr,
          billing_month: { $ne: billingMonth },
        })
        .sort({ billing_month: -1, reading_date: -1, createdAt: -1 })
        .exec();

      let previousElectricity = 0;
      let previousWater = 0;

      if (currentInvoice?.electricity?.previous_reading !== undefined) {
        previousElectricity = currentInvoice.electricity.previous_reading;
      } else if (lastInvoice?.electricity?.current_reading !== undefined) {
        previousElectricity = lastInvoice.electricity.current_reading;
      }

      if (currentInvoice?.water?.previous_reading !== undefined) {
        previousWater = currentInvoice.water.previous_reading;
      } else if (lastInvoice?.water?.current_reading !== undefined) {
        previousWater = lastInvoice.water.current_reading;
      }

      roomsData.push({
        room_id: roomIdStr,
        room: room,
        occupant_count: rosterInfo.occupantCount,
        status: currentInvoice ? 'recorded' : 'unrecorded',
        invoice_id: currentInvoice?._id,
        invoice_status: currentInvoice?.status,
        invoice_code: currentInvoice?.invoice_code,
        previous_readings: {
          electricity: previousElectricity,
          water: previousWater,
        },
        current_readings: currentInvoice
          ? {
              electricity: currentInvoice.electricity?.current_reading,
              water: currentInvoice.water?.current_reading,
            }
          : undefined,
        total_amount: currentInvoice?.total_amount,
        is_exempt: currentInvoice?.is_exempt,
        notes: currentInvoice?.notes,
        payment_start_date: currentInvoice?.payment_start_date,
        due_date: currentInvoice?.due_date,
      });
    }

    // Sắp xếp phòng theo tên / mã phòng
    roomsData.sort((a, b) => {
      const nameA = a.room?.room_name || a.room?.room_code || '';
      const nameB = b.room?.room_name || b.room?.room_code || '';
      return nameA.localeCompare(nameB, 'vi', { numeric: true });
    });

    return {
      config,
      billing_month: billingMonth,
      rooms: roomsData,
    };
  }

  /**
   * Lưu chỉ số điện - nước hàng loạt theo phòng (Idempotent per room)
   */
  async saveBulkMeterReadings(dto: BulkMeterReadingsDto, user: any) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dto.billing_month)) {
      throw new BadRequestException(
        'Kỳ thu phải có định dạng YYYY-MM (ví dụ: 2026-03)',
      );
    }

    const config = await this.getUtilityConfig();
    const results: Array<{
      room_id: string;
      success: boolean;
      invoice?: any;
      error?: string;
    }> = [];

    const now = new Date();
    const collectionDays = config.configured_collection_days || 10;
    const dueDate = new Date(
      now.getTime() + collectionDays * 24 * 60 * 60 * 1000,
    );

    for (const item of dto.readings || []) {
      try {
        if (!Types.ObjectId.isValid(item.room_id)) {
          throw new BadRequestException('Mã phòng không hợp lệ');
        }

        const room = await this.roomModel.findById(item.room_id).exec();
        if (!room) {
          throw new NotFoundException(`Không tìm thấy phòng: ${item.room_id}`);
        }

        const rosterEntries = await this.rosterModel
          .find({ room_id: item.room_id })
          .exec();
        const rosterEntryIds = rosterEntries.map((r) => r._id);
        const occupantCount = rosterEntries.length;

        // Tìm hóa đơn hiện tại trong kỳ nếu có
        const existingInvoice = await this.invoiceModel
          .findOne({
            room_id: item.room_id,
            billing_month: dto.billing_month,
          })
          .exec();

        let prevElec = 0;
        let prevWater = 0;

        if (existingInvoice) {
          if (
            existingInvoice.status === 'Đã thu' ||
            existingInvoice.status === 'Đã thanh toán'
          ) {
            throw new BadRequestException(
              'Không thể chỉnh sửa hóa đơn đã thu',
            );
          }
          prevElec = existingInvoice.electricity?.previous_reading ?? 0;
          prevWater = existingInvoice.water?.previous_reading ?? 0;
        } else {
          const lastInvoice = await this.invoiceModel
            .findOne({
              room_id: item.room_id,
              billing_month: { $ne: dto.billing_month },
            })
            .sort({ billing_month: -1, reading_date: -1, createdAt: -1 })
            .exec();

          prevElec = lastInvoice?.electricity?.current_reading ?? 0;
          prevWater = lastInvoice?.water?.current_reading ?? 0;
        }

        const currElec = Number(item.electricity_reading);
        const currWater = Number(item.water_reading);

        if (isNaN(currElec) || isNaN(currWater)) {
          throw new BadRequestException(
            'Chỉ số điện và nước phải là số hợp lệ',
          );
        }
        if (currElec < 0 || currWater < 0) {
          throw new BadRequestException('Chỉ số không được là số âm');
        }
        if (currElec < prevElec) {
          throw new BadRequestException(
            'Chỉ số điện mới không được nhỏ hơn chỉ số cũ',
          );
        }
        if (currWater < prevWater) {
          throw new BadRequestException(
            'Chỉ số nước mới không được nhỏ hơn chỉ số cũ',
          );
        }

        const isExempt = Boolean(item.is_exempt);
        const electricity = this.calculateUtility(
          occupantCount,
          {
            previous_reading: prevElec,
            current_reading: currElec,
            quota_per_person: config.electricity.quota_per_person,
            unit_price: config.electricity.unit_price,
          },
          isExempt,
        );

        const water = this.calculateUtility(
          occupantCount,
          {
            previous_reading: prevWater,
            current_reading: currWater,
            quota_per_person: config.water.quota_per_person,
            unit_price: config.water.unit_price,
          },
          isExempt,
        );

        const total_amount = isExempt ? 0 : electricity.amount + water.amount;

        if (existingInvoice) {
          existingInvoice.reading_date = now;
          existingInvoice.payment_start_date = now;
          existingInvoice.due_date = dueDate;
          existingInvoice.occupant_count = occupantCount;
          existingInvoice.roster_entry_ids = rosterEntryIds;
          existingInvoice.electricity = electricity;
          existingInvoice.water = water;
          existingInvoice.total_amount = total_amount;
          existingInvoice.is_exempt = isExempt;
          if (item.notes !== undefined) {
            existingInvoice.notes = item.notes;
          }
          const saved = await existingInvoice.save();
          results.push({
            room_id: item.room_id,
            success: true,
            invoice: saved,
          });
        } else {
          const invoice = new this.invoiceModel({
            invoice_code: `INV-${randomUUID().substring(0, 8).toUpperCase()}`,
            room_id: item.room_id,
            billing_month: dto.billing_month,
            reading_date: now,
            occupant_count: occupantCount,
            roster_entry_ids: rosterEntryIds,
            electricity,
            water,
            is_exempt: isExempt,
            payment_start_date: now,
            due_date: dueDate,
            total_amount,
            status: 'Chưa thu',
            notes: item.notes,
          });
          const saved = await invoice.save();
          results.push({
            room_id: item.room_id,
            success: true,
            invoice: saved,
          });
        }
      } catch (err: any) {
        results.push({
          room_id: item.room_id,
          success: false,
          error: err?.message || 'Lỗi khi lưu chỉ số phòng',
        });
      }
    }

    return { results };
  }

  /**
   * Xóa nhiều hóa đơn theo danh sách ID
   */
  async bulkDelete(ids: string[], user: any) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Danh sách ID hóa đơn không được rỗng');
    }

    // Normalize and deduplicate IDs
    const uniqueIds = Array.from(
      new Set(ids.map((id) => (id ? String(id).trim() : '')).filter(Boolean)),
    );

    if (uniqueIds.length === 0) {
      throw new BadRequestException('Danh sách ID hóa đơn không hợp lệ');
    }

    const validObjectIds: Types.ObjectId[] = [];
    const rejected: Array<{ id: string; invoice_code?: string; reason: string }> = [];
    const not_found: string[] = [];

    for (const idStr of uniqueIds) {
      if (Types.ObjectId.isValid(idStr)) {
        validObjectIds.push(new Types.ObjectId(idStr));
      } else {
        rejected.push({
          id: idStr,
          reason: 'Mã hóa đơn không hợp lệ',
        });
      }
    }

    const deletableIds: Types.ObjectId[] = [];
    const deletedIdStrings: string[] = [];

    if (validObjectIds.length > 0) {
      const existingInvoices = await this.invoiceModel
        .find({ _id: { $in: validObjectIds } })
        .exec();

      const existingMap = new Map<string, any>();
      for (const inv of existingInvoices) {
        existingMap.set(String(inv._id), inv);
      }

      for (const objId of validObjectIds) {
        const idStr = String(objId);
        const inv = existingMap.get(idStr);

        if (!inv) {
          not_found.push(idStr);
        } else if (inv.status === 'Đã thu' || inv.status === 'Đã thanh toán') {
          rejected.push({
            id: idStr,
            invoice_code: inv.invoice_code,
            reason: 'Không thể xóa hóa đơn đã thanh toán',
          });
        } else {
          deletableIds.push(objId);
          deletedIdStrings.push(idStr);
        }
      }

      if (deletableIds.length > 0) {
        await this.invoiceModel
          .deleteMany({ _id: { $in: deletableIds } })
          .exec();
      }
    }

    return {
      requested: uniqueIds.length,
      deleted: deletedIdStrings,
      not_found,
      rejected,
    };
  }
}

