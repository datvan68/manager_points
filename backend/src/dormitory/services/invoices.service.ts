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
    const tong_tien = dto.chi_tiet.reduce((sum, item) => sum + item.so_tien, 0);

    const invoice = new this.invoiceModel({
      ...dto,
      ma_hoa_don: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
      tong_tien,
      trang_thai: 'Chưa thanh toán',
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
      .find({ trang_thai: 'Hiệu lực' })
      .populate('room_id', 'gia_phong')
      .exec();

    let created = 0;
    let skipped = 0;

    for (const contract of activeContracts) {
      // Check if invoice already exists for this period
      const existing = await this.invoiceModel.findOne({
        contract_id: contract._id,
        ky_thu: dto.ky_thu,
      });
      if (existing) {
        skipped++;
        continue;
      }

      const room = contract.room_id as any;
      const giaPhong = room?.gia_phong || 0;

      const invoice = new this.invoiceModel({
        ma_hoa_don: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
        contract_id: contract._id,
        student_id: contract.student_id,
        ky_thu: dto.ky_thu,
        chi_tiet: [
          {
            loai: 'Phí phòng',
            mo_ta: `Phí phòng kỳ ${dto.ky_thu}`,
            so_tien: giaPhong,
          },
        ],
        tong_tien: giaPhong,
        trang_thai: 'Chưa thanh toán',
        han_thanh_toan: new Date(dto.han_thanh_toan),
      });

      await invoice.save();
      created++;
    }

    return { created, skipped };
  }

  async findAll(query: {
    student_id?: string;
    contract_id?: string;
    trang_thai?: string;
    ky_thu?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.student_id) filter.student_id = query.student_id;
    if (query.contract_id) filter.contract_id = query.contract_id;
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.ky_thu) filter.ky_thu = query.ky_thu;
    if (query.search) {
      filter.$or = [
        { ma_hoa_don: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .populate('student_id', 'student_code full_name')
        .populate('contract_id', 'ma_hd')
        .populate('nguoi_xac_nhan_id', 'user_name')
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
      .populate('nguoi_xac_nhan_id', 'user_name')
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
    if (invoice.trang_thai === 'Đã thanh toán') {
      throw new BadRequestException('Hóa đơn đã được thanh toán');
    }

    invoice.trang_thai = 'Đã thanh toán';
    invoice.phuong_thuc = dto.phuong_thuc;
    invoice.ngay_thanh_toan = new Date();
    invoice.nguoi_xac_nhan_id = user._id || user.userId;
    invoice.ghi_chu = dto.ghi_chu || invoice.ghi_chu;

    return invoice.save();
  }

  /**
   * FR09: Get overdue summary
   */
  async getOverdueSummary() {
    const overdue = await this.invoiceModel
      .find({ trang_thai: 'Chưa thanh toán', han_thanh_toan: { $lt: new Date() } })
      .populate('student_id', 'student_code full_name')
      .sort({ han_thanh_toan: 1 })
      .exec();

    // Mark as overdue
    const ids = overdue.map((inv) => inv._id);
    if (ids.length > 0) {
      await this.invoiceModel.updateMany(
        { _id: { $in: ids } },
        { $set: { trang_thai: 'Quá hạn' } },
      );
    }

    return {
      total_overdue: overdue.length,
      total_amount: overdue.reduce((sum, inv) => sum + inv.tong_tien, 0),
      invoices: overdue,
    };
  }
}
