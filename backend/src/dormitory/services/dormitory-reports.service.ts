import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { Room, RoomDocument } from '../schemas/room.schema';
import { Bed, BedDocument } from '../schemas/bed.schema';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { Invoice, InvoiceDocument } from '../schemas/invoice.schema';
import { Violation, ViolationDocument } from '../schemas/violation.schema';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from '../schemas/maintenance-request.schema';
import {
  Registration,
  RegistrationDocument,
} from '../schemas/registration.schema';

@Injectable()
export class DormitoryReportsService {
  constructor(
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Violation.name)
    private violationModel: Model<ViolationDocument>,
    @InjectModel(MaintenanceRequest.name)
    private maintenanceModel: Model<MaintenanceRequestDocument>,
    @InjectModel(Registration.name)
    private registrationModel: Model<RegistrationDocument>,
  ) {}

  /**
   * UC13/FR13: Occupancy report by building
   */
  async getOccupancyReport() {
      const buildings = await this.buildingModel.find({ status: 'Trống' }).exec();

    const roomCounts = await this.bedModel.aggregate([
      { $match: { status: { $ne: 'Đã nghỉ' } } },
      { $lookup: { from: 'rooms', localField: 'room_id', foreignField: '_id', as: 'room' } },
      { $unwind: '$room' },
      { $group: { _id: '$room.building_id', totalBeds: { $sum: 1 }, availableBeds: { $sum: { $cond: [{ $eq: ['$status', 'Trống'] }, 1, 0] } }, usedBeds: { $sum: { $cond: [{ $eq: ['$status', 'Đang sử dụng'] }, 1, 0] } } } },
    ]);
    const byBuilding = new Map(roomCounts.map((item: any) => [String(item._id), item]));
    const report = buildings.map((building) => {
        const counts: any = byBuilding.get(String(building._id)) || { totalBeds: 0, availableBeds: 0, usedBeds: 0 };
        const totalBeds = counts.totalBeds;
        const availableBeds = counts.availableBeds;
        const usedBeds = counts.usedBeds;
        const occupancyRate = totalBeds > 0 ? Math.round((usedBeds / totalBeds) * 100) : 0;

        return {
          building_id: building._id,
          building_code: building.building_code,
          name: building.name,
          total_rooms: 0,
          total_beds: totalBeds,
          used_beds: usedBeds,
          available_beds: availableBeds,
          occupancy_rate: occupancyRate,
        };
      });

    const totalAll = report.reduce((sum, b) => sum + b.total_beds, 0);
    const usedAll = report.reduce((sum, b) => sum + b.used_beds, 0);

    return {
      buildings: report,
      summary: {
        total_buildings: report.length,
        total_beds: totalAll,
        used_beds: usedAll,
        available_beds: totalAll - usedAll,
        overall_occupancy_rate: totalAll > 0 ? Math.round((usedAll / totalAll) * 100) : 0,
      },
    };
  }

  /**
   * FR14: Revenue and debt report
   */
  async getRevenueReport(query?: { billing_period?: string }) {
    const filter: any = {};
    if (query?.billing_period) filter.billing_period = query.billing_period;

    const invoices = await this.invoiceModel.find(filter).exec();

    const paid = invoices.filter((i) => i.status === 'Đã thanh toán');
    const unpaid = invoices.filter((i) => i.status === 'Chưa thanh toán');
    const overdue = invoices.filter((i) => i.status === 'Quá hạn');

    return {
      total_invoices: invoices.length,
      total_revenue: paid.reduce((sum, i) => sum + i.total_amount, 0),
      total_unpaid: unpaid.reduce((sum, i) => sum + i.total_amount, 0),
      total_overdue: overdue.reduce((sum, i) => sum + i.total_amount, 0),
      paid_count: paid.length,
      unpaid_count: unpaid.length,
      overdue_count: overdue.length,
    };
  }

  /**
   * FR15: Violation and maintenance report
   */
  async getViolationMaintenanceReport() {
    const [violations, maintenance] = await Promise.all([
      this.violationModel.find().exec(),
      this.maintenanceModel.find().exec(),
    ]);

    const violationByLevel = {
      nhe: violations.filter((v) => v.severity === 'Nhẹ').length,
      trung_binh: violations.filter((v) => v.severity === 'Trung bình').length,
      nghiem_trong: violations.filter((v) => v.severity === 'Nghiêm trọng').length,
    };

    const maintenanceByStatus = {
      moi: maintenance.filter((m) => m.status === 'Mới').length,
      dang_xu_ly: maintenance.filter((m) => m.status === 'Đang xử lý').length,
      hoan_tat: maintenance.filter((m) => m.status === 'Hoàn tất').length,
      tu_choi: maintenance.filter((m) => m.status === 'Từ chối').length,
    };

    return {
      violations: {
        total: violations.length,
        by_level: violationByLevel,
        pending: violations.filter((v) => v.status === 'Mới').length,
      },
      maintenance: {
        total: maintenance.length,
        by_status: maintenanceByStatus,
      },
    };
  }

  /**
   * Dashboard overview stats
   */
  async getDashboardStats() {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { date, month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` };
    });
    const monthly = months.map(({ month }) => ({ month, registrations: 0, move_ins: 0, dormitory_fee_paid: 0, dormitory_fee_unpaid: 0, utility_paid: 0, utility_unpaid: 0 }));
    const [rooms, beds, contracts, registrations, invoices, pendingMaintenance, totalRooms, availableRooms] = await Promise.all([
      this.roomModel.find({ status: { $ne: 'Khóa' } }).lean().exec(),
      this.bedModel.find({ status: { $ne: 'Đã nghỉ' } }).lean().exec(),
      this.contractModel.find({ status: 'Hiệu lực' }).lean().exec(),
      this.registrationModel.find().lean().exec(),
      this.invoiceModel.find().lean().exec(),
      this.maintenanceModel.countDocuments({ status: { $in: ['Mới', 'Đang xử lý'] } }),
      this.roomModel.countDocuments({ status: { $ne: 'Khóa' } }),
      this.roomModel.countDocuments({ available_bed_count: { $gt: 0 }, status: 'Trống' }),
    ]);
    const roomList: any[] = rooms as any[];
    const bedList: any[] = beds as any[];
    const invoiceList: any[] = invoices as any[];
    const category = (type: string) => type === 'Phí phòng' ? 'fee' : type === 'Điện' || type === 'Nước' ? 'utility' : null;
    const summary = { fee: { paid: 0, unpaid: 0 }, utility: { paid: 0, unpaid: 0 } };
    for (const registration of registrations as any[]) {
      const created = new Date(registration.createdAt);
      const bucket = monthly.find(item => item.month === `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`);
      if (bucket) bucket.registrations++;
    }
    for (const contract of contracts as any[]) {
      const date = new Date(contract.start_date);
      const bucket = monthly.find(item => item.month === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      if (bucket) bucket.move_ins++;
    }
    for (const invoice of invoiceList) {
      const paid = invoice.status === 'Đã thanh toán';
      for (const item of invoice.items || []) { const group = category(item.type); if (!group) continue; summary[group][paid ? 'paid' : 'unpaid']++; const raw = /^T(\d{2})\/(\d{4})$/.exec(String(invoice.billing_period || '')); const bucket = raw ? monthly.find(row => row.month === `${raw[2]}-${raw[1]}`) : undefined; if (bucket) bucket[`${group === 'fee' ? 'dormitory_fee' : 'utility'}_${paid ? 'paid' : 'unpaid'}`]++; }
    }
    const occupiedRooms = new Set((contracts as any[]).map(contract => String(contract.room_id))).size;
    const air = roomList.filter(room => (room.amenities || []).includes('Điều hòa')).length;
    return { total_rooms: totalRooms, available_rooms: availableRooms, active_contracts: contracts.length, pending_registrations: (registrations as any[]).filter(item => item.status === 'Chờ duyệt').length, unpaid_invoices: invoiceList.filter(item => item.status !== 'Đã thanh toán').length, pending_maintenance: pendingMaintenance, rooms: { occupied: occupiedRooms, available: roomList.filter(room => room.available_bed_count > 0).length, air_conditioned: air, standard: Math.max(0, roomList.length - air) }, beds: { used: bedList.filter(bed => bed.status === 'Đang sử dụng').length, free: bedList.filter(bed => bed.status === 'Trống').length }, students: { registered: (registrations as any[]).length, residing: contracts.length }, dormitory_fees: summary.fee, utilities: summary.utility, monthly };
  }
}
