import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice, InvoiceDocument } from '../schemas/invoice.schema';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { Room, RoomDocument } from '../schemas/room.schema';
import {
  CreateInvoiceDto,
  PayInvoiceDto,
  BulkCreateInvoiceDto,
} from '../dto/create-invoice.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  async create(dto: CreateInvoiceDto, user: any): Promise<Invoice> {
    // Calculate total
    const total_amount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    const invoice = new this.invoiceModel({
      ...dto,
      invoice_code: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
      total_amount,
      status: 'Chưa thanh toán',
    });

    return invoice.save();
  }

  /**
   * UC07: Bulk generate invoices for all active contracts
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
      // Check if invoice already exists for this period
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
        invoice_code: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
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
        status: 'Chưa thanh toán',
        due_date: new Date(dto.due_date),
      });

      await invoice.save();
      created++;
    }

    return { created, skipped };
  }

  async findAll(query: {
    student_id?: string;
    contract_id?: string;
    status?: string;
    billing_period?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.student_id) filter.student_id = query.student_id;
    if (query.contract_id) filter.contract_id = query.contract_id;
    if (query.status) filter.status = query.status;
    if (query.billing_period) filter.billing_period = query.billing_period;
    if (query.search) {
      filter.$or = [
        { invoice_code: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
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
      .populate('student_id')
      .populate('contract_id')
      .populate('confirmed_by_id', 'user_name')
      .exec();
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }
    return invoice;
  }

  /**
   * UC08: Confirm payment
   */
  async pay(id: string, dto: PayInvoiceDto, user: any): Promise<Invoice> {
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Không tìm thấy hóa đơn: ${id}`);
    }
    if (invoice.status === 'Đã thanh toán') {
      throw new BadRequestException('Hóa đơn đã được thanh toán');
    }

    invoice.status = 'Đã thanh toán';
    invoice.payment_method = dto.payment_method;
    invoice.paid_at = new Date();
    invoice.confirmed_by_id = user._id || user.userId;
    invoice.notes = dto.notes || invoice.notes;

    return invoice.save();
  }

  /**
   * FR09: Get overdue summary
   */
  async getOverdueSummary() {
    const overdue = await this.invoiceModel
      .find({ status: 'Chưa thanh toán', due_date: { $lt: new Date() } })
      .populate('student_id', 'student_code full_name')
      .sort({ due_date: 1 })
      .exec();

    // Mark as overdue
    const ids = overdue.map((inv) => inv._id);
    if (ids.length > 0) {
      await this.invoiceModel.updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'Quá hạn' } },
      );
    }

    return {
      total_overdue: overdue.length,
      total_amount: overdue.reduce((sum, inv) => sum + inv.total_amount, 0),
      invoices: overdue,
    };
  }
}
