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
    const buildings = await this.buildingModel.find({ status: 'Active' }).exec();

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
    const [
      totalRooms,
      availableRooms,
      activeContracts,
      pendingRegistrations,
      unpaidInvoices,
      pendingMaintenance,
    ] = await Promise.all([
      this.roomModel.countDocuments({ status: { $ne: 'Khóa' } }),
      this.roomModel.countDocuments({ available_bed_count: { $gt: 0 }, status: 'Trống' }),
      this.contractModel.countDocuments({ status: 'Hiệu lực' }),
      this.registrationModel.countDocuments({ status: 'Chờ duyệt' }),
      this.invoiceModel.countDocuments({
        status: { $in: ['Chưa thanh toán', 'Quá hạn'] },
      }),
      this.maintenanceModel.countDocuments({
        status: { $in: ['Mới', 'Đang xử lý'] },
      }),
    ]);

    return {
      total_rooms: totalRooms,
      available_rooms: availableRooms,
      active_contracts: activeContracts,
      pending_registrations: pendingRegistrations,
      unpaid_invoices: unpaidInvoices,
      pending_maintenance: pendingMaintenance,
    };
  }
}
