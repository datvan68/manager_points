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
    const buildings = await this.buildingModel.find({ trang_thai: 'Active' }).exec();

    const report = await Promise.all(
      buildings.map(async (building) => {
        const rooms = await this.roomModel.find({ building_id: building._id }).exec();
        const totalBeds = rooms.reduce((sum, r) => sum + r.so_giuong, 0);
        const availableBeds = rooms.reduce((sum, r) => sum + r.so_giuong_trong, 0);
        const usedBeds = totalBeds - availableBeds;
        const occupancyRate = totalBeds > 0 ? Math.round((usedBeds / totalBeds) * 100) : 0;

        return {
          building_id: building._id,
          ma_toa_nha: building.ma_toa_nha,
          ten: building.ten,
          total_rooms: rooms.length,
          total_beds: totalBeds,
          used_beds: usedBeds,
          available_beds: availableBeds,
          occupancy_rate: occupancyRate,
        };
      }),
    );

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
  async getRevenueReport(query?: { ky_thu?: string }) {
    const filter: any = {};
    if (query?.ky_thu) filter.ky_thu = query.ky_thu;

    const invoices = await this.invoiceModel.find(filter).exec();

    const paid = invoices.filter((i) => i.trang_thai === 'Đã thanh toán');
    const unpaid = invoices.filter((i) => i.trang_thai === 'Chưa thanh toán');
    const overdue = invoices.filter((i) => i.trang_thai === 'Quá hạn');

    return {
      total_invoices: invoices.length,
      total_revenue: paid.reduce((sum, i) => sum + i.tong_tien, 0),
      total_unpaid: unpaid.reduce((sum, i) => sum + i.tong_tien, 0),
      total_overdue: overdue.reduce((sum, i) => sum + i.tong_tien, 0),
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
      nhe: violations.filter((v) => v.muc_do === 'Nhẹ').length,
      trung_binh: violations.filter((v) => v.muc_do === 'Trung bình').length,
      nghiem_trong: violations.filter((v) => v.muc_do === 'Nghiêm trọng').length,
    };

    const maintenanceByStatus = {
      moi: maintenance.filter((m) => m.trang_thai === 'Mới').length,
      dang_xu_ly: maintenance.filter((m) => m.trang_thai === 'Đang xử lý').length,
      hoan_tat: maintenance.filter((m) => m.trang_thai === 'Hoàn tất').length,
      tu_choi: maintenance.filter((m) => m.trang_thai === 'Từ chối').length,
    };

    return {
      violations: {
        total: violations.length,
        by_level: violationByLevel,
        pending: violations.filter((v) => v.trang_thai === 'Mới').length,
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
      this.roomModel.countDocuments({ trang_thai: { $ne: 'Khóa' } }),
      this.roomModel.countDocuments({ so_giuong_trong: { $gt: 0 }, trang_thai: 'Trống' }),
      this.contractModel.countDocuments({ trang_thai: 'Hiệu lực' }),
      this.registrationModel.countDocuments({ trang_thai: 'Chờ duyệt' }),
      this.invoiceModel.countDocuments({
        trang_thai: { $in: ['Chưa thanh toán', 'Quá hạn'] },
      }),
      this.maintenanceModel.countDocuments({
        trang_thai: { $in: ['Mới', 'Đang xử lý'] },
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
