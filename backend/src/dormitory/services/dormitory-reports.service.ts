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
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';

const ROOM_TYPES = ['Thường', 'Máy lạnh'] as const;
const ROOM_STATES = ['Trống', 'Còn chỗ', 'Đầy', 'Bảo trì', 'Khóa', 'Chưa cấu hình'] as const;

export function idOf(value: unknown, seen = new WeakSet<object>()): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);

    const objectId = value as { toHexString?: unknown };
    if (typeof objectId.toHexString === 'function') {
      const valueAsString = objectId.toHexString();
      return valueAsString || null;
    }

    const candidate = value as { _id?: unknown; $oid?: unknown };
    if (candidate._id !== undefined) return idOf(candidate._id, seen);
    if (candidate.$oid !== undefined) return idOf(candidate.$oid, seen);
  }
  const valueAsString = String(value);
  return valueAsString && valueAsString !== '[object Object]' ? valueAsString : null;
}

function numberOf(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function asPlain<T>(value: T): T {
  return typeof (value as any)?.toObject === 'function' ? (value as any).toObject() : value;
}

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
    @InjectModel(DormitoryRosterEntry.name)
    private rosterModel: Model<DormitoryRosterEntryDocument>,
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
      {
        $group: {
          _id: '$room.building_id',
          totalBeds: { $sum: 1 },
          availableBeds: { $sum: { $cond: [{ $eq: ['$status', 'Trống'] }, 1, 0] } },
          usedBeds: { $sum: { $cond: [{ $eq: ['$status', 'Đang sử dụng'] }, 1, 0] } },
        },
      },
    ]);
    const byBuilding = new Map(roomCounts.map((item: any) => [String(item._id), item]));
    const report = buildings.map((building) => {
      const counts: any = byBuilding.get(String(building._id)) || {
        totalBeds: 0,
        availableBeds: 0,
        usedBeds: 0,
      };
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
   * Dashboard overview stats. The legacy top-level fields remain available;
   * the structured summaries are the source for the room-first overview.
   */
  async getDashboardStats() {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        date,
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      };
    });
    const monthly = months.map(({ month }) => ({
      month,
      registrations: 0,
      move_ins: 0,
      dormitory_fee_paid: 0,
      dormitory_fee_unpaid: 0,
      utility_paid: 0,
      utility_unpaid: 0,
    }));

    const [buildings, rooms, beds, contracts, rosterEntries, invoices, pendingMaintenance] =
      await Promise.all([
        this.buildingModel.find().lean().exec(),
        this.roomModel.find().lean().exec(),
        this.bedModel.find({ status: { $ne: 'Đã nghỉ' } }).lean().exec(),
        this.contractModel.find().lean().exec(),
        this.rosterModel
          .find()
          .populate({
            path: 'student_id',
            select: 'full_name class_id',
            populate: { path: 'class_id', select: 'class_name' },
          })
          .lean()
          .exec(),
        this.invoiceModel.find().lean().exec(),
        this.maintenanceModel.countDocuments({ status: { $in: ['Mới', 'Đang xử lý'] } }),
      ]);

    const buildingList: any[] = buildings as any[];
    const roomList: any[] = rooms as any[];
    const bedList: any[] = beds as any[];
    const contractList: any[] = contracts as any[];
    const rosterList: any[] = rosterEntries as any[];
    const invoiceList: any[] = invoices as any[];
    const buildingById = new Map(buildingList.map((building) => [idOf(building._id), building]));
    const roomById = new Map(roomList.map((room) => [idOf(room._id), room]));
    const bedsByRoom = new Map<string, any[]>();

    for (const bed of bedList) {
      const roomId = idOf(bed.room_id);
      if (!roomId) continue;
      const roomBeds = bedsByRoom.get(roomId) || [];
      roomBeds.push(bed);
      bedsByRoom.set(roomId, roomBeds);
    }

    const activeContractRoomsByRosterId = new Map<string, Set<string>>();
    for (const contract of contractList) {
      if (contract.status === 'Hiệu lực' && contract.roster_entry_id && contract.room_id) {
        const rosterId = idOf(contract.roster_entry_id);
        const roomId = idOf(contract.room_id);
        if (rosterId && roomId) {
          if (!activeContractRoomsByRosterId.has(rosterId)) {
            activeContractRoomsByRosterId.set(rosterId, new Set());
          }
          activeContractRoomsByRosterId.get(rosterId)!.add(roomId);
        }
      }
    }

    const membersByRoom = new Map<string, Array<{ full_name: string; class_name: string }>>();
    const seenRosterByRoom = new Map<string, Set<string>>();

    for (const roster of rosterList) {
      const rosterId = idOf(roster._id);
      const student = roster.student_id && typeof roster.student_id === 'object' ? roster.student_id : null;
      const fullName = (student?.full_name || roster.full_name || 'Chưa cập nhật').trim() || 'Chưa cập nhật';
      let className = 'Chưa cập nhật';
      if (student?.class_id) {
        if (
          typeof student.class_id === 'object' &&
          student.class_id.class_name &&
          typeof student.class_id.class_name === 'string' &&
          student.class_id.class_name.trim()
        ) {
          className = student.class_id.class_name.trim();
        } else if (typeof student.class_id === 'string' && student.class_id.trim()) {
          className = student.class_id.trim();
        }
      }

      const member = { full_name: fullName, class_name: className };

      const targetRoomIds = new Set<string>();
      const directRoomId = idOf(roster.room_id);
      if (directRoomId) {
        targetRoomIds.add(directRoomId);
      }
      if (rosterId && activeContractRoomsByRosterId.has(rosterId)) {
        for (const cRoomId of activeContractRoomsByRosterId.get(rosterId)!) {
          targetRoomIds.add(cRoomId);
        }
      }

      for (const roomId of targetRoomIds) {
        if (!membersByRoom.has(roomId)) {
          membersByRoom.set(roomId, []);
          seenRosterByRoom.set(roomId, new Set());
        }
        const seenSet = seenRosterByRoom.get(roomId)!;
        const dedupeKey = rosterId || `${fullName}-${className}`;
        if (!seenSet.has(dedupeKey)) {
          seenSet.add(dedupeKey);
          membersByRoom.get(roomId)!.push(member);
        }
      }
    }

    const roomRows = roomList.map((rawRoom) => {
      const room = asPlain(rawRoom) as any;
      const roomId = idOf(room._id) || '';
      const roomBeds = bedsByRoom.get(roomId) || [];
      const totalBeds = numberOf(room.bed_count, roomBeds.length);
      const occupiedBeds = roomBeds.filter((bed) => bed.status === 'Đang sử dụng').length;
      const freeBeds = roomBeds.length === 0
        ? Math.max(0, totalBeds - occupiedBeds)
        : roomBeds.filter((bed) => bed.status === 'Trống').length;
      const buildingRef = asPlain(room.building_id) as any;
      const buildingId = idOf(buildingRef);
      const building = (buildingId && buildingById.get(buildingId)) || buildingRef || {};
      const roomType = ROOM_TYPES.includes(room.room_type) ? room.room_type : 'Chưa xác định';
      let state: (typeof ROOM_STATES)[number];
      if (room.status === 'Bảo trì') state = 'Bảo trì';
      else if (room.status === 'Khóa') state = 'Khóa';
      else if (totalBeds === 0) state = 'Chưa cấu hình';
      else if (occupiedBeds === 0) state = 'Trống';
      else if (freeBeds > 0) state = 'Còn chỗ';
      else state = 'Đầy';

      return {
        room_id: roomId,
        room_code: room.room_code || roomId,
        room_name: room.room_name || room.room_code || roomId,
        building_id: buildingId,
        building_code: building.building_code || '',
        building_name: building.name || building.building_name || 'Chưa xác định',
        room_type: roomType,
        total_beds: totalBeds,
        occupied_beds: occupiedBeds,
        free_beds: freeBeds,
        state,
        members: membersByRoom.get(roomId) || [],
      };
    });

    const roomSummary = {
      total_rooms: roomRows.length,
      total_beds: roomRows.reduce((sum, room) => sum + room.total_beds, 0),
      occupied_beds: roomRows.reduce((sum, room) => sum + room.occupied_beds, 0),
      free_beds: roomRows.reduce((sum, room) => sum + room.free_beds, 0),
      by_type: {
        thuong: roomRows.filter((room) => room.room_type === 'Thường').length,
        may_lanh: roomRows.filter((room) => room.room_type === 'Máy lạnh').length,
        unknown: roomRows.filter((room) => room.room_type === 'Chưa xác định').length,
      },
      by_state: {
        trong: roomRows.filter((room) => room.state === 'Trống').length,
        con_cho: roomRows.filter((room) => room.state === 'Còn chỗ').length,
        day: roomRows.filter((room) => room.state === 'Đầy').length,
        bao_tri: roomRows.filter((room) => room.state === 'Bảo trì').length,
        khoa: roomRows.filter((room) => room.state === 'Khóa').length,
        chua_cau_hinh: roomRows.filter((room) => room.state === 'Chưa cấu hình').length,
      },
    };

    const contractById = new Map(contractList.map((contract) => [idOf(contract._id), contract]));
    const invoiceRows = new Map<string, any>();
    let invoiceAnomalyCount = 0;
    let outstandingInvoiceCount = 0;
    let unpaidInvoiceCount = 0;
    let overdueInvoiceCount = 0;
    let outstandingAmount = 0;
    let anomalyAmount = 0;

    for (const invoice of invoiceList) {
      if (invoice.status !== 'Chưa thanh toán' && invoice.status !== 'Quá hạn') continue;
      outstandingInvoiceCount++;
      if (invoice.status === 'Chưa thanh toán') unpaidInvoiceCount++;
      else overdueInvoiceCount++;
      const invoiceAmount = numberOf(invoice.total_amount);
      outstandingAmount += invoiceAmount;

      const contract = contractById.get(idOf(invoice.contract_id));
      const roomId = idOf(contract?.room_id);
      if (!contract || !roomId || !roomById.has(roomId)) {
        invoiceAnomalyCount++;
        anomalyAmount += invoiceAmount;
        continue;
      }

      const room = roomRows.find((row) => row.room_id === roomId);
      if (!room) {
        invoiceAnomalyCount++;
        anomalyAmount += invoiceAmount;
        continue;
      }
      const row = invoiceRows.get(roomId) || {
        room_id: roomId,
        room_code: room.room_code,
        room_name: room.room_name,
        building_name: room.building_name,
        debtor_ids: new Set<string>(),
        unpaid_count: 0,
        overdue_count: 0,
        total_outstanding_amount: 0,
      };
      const studentId = idOf(invoice.student_id);
      if (studentId) row.debtor_ids.add(studentId);
      if (invoice.status === 'Chưa thanh toán') row.unpaid_count++;
      else row.overdue_count++;
      row.total_outstanding_amount += invoiceAmount;
      invoiceRows.set(roomId, row);
    }

    const invoiceSummary = {
      outstanding_invoice_count: outstandingInvoiceCount,
      unpaid_count: unpaidInvoiceCount,
      overdue_count: overdueInvoiceCount,
      total_outstanding_amount: outstandingAmount,
      anomaly_amount: anomalyAmount,
      anomaly_count: invoiceAnomalyCount,
      rows: Array.from(invoiceRows.values()).map((row) => ({
        room_id: row.room_id,
        room_code: row.room_code,
        room_name: row.room_name,
        building_name: row.building_name,
        debtor_count: row.debtor_ids.size,
        unpaid_count: row.unpaid_count,
        overdue_count: row.overdue_count,
        total_outstanding_amount: row.total_outstanding_amount,
      })),
    };

    const assignedRegistrationIds = new Set(
      contractList
        .filter((contract) => contract.status === 'Hiệu lực' && contract.roster_entry_id && contract.room_id)
        .map((contract) => idOf(contract.roster_entry_id))
        .filter((id): id is string => Boolean(id)),
    );
    const requestedRoomType = (row: any) => row.room_type;
    const isAssigned = (row: any) => Boolean(
      row.room_id || row.bed_id || row.active_contract_id || assignedRegistrationIds.has(idOf(row._id) || ''),
    );
    const registrationSummary = {
      total: rosterList.length,
      assigned: rosterList.filter(isAssigned).length,
      male: rosterList.filter((row) => row.gender === 'Male').length,
      female: rosterList.filter((row) => row.gender === 'Female').length,
      unlinked: rosterList.filter((row) => row.identity_state !== 'LINKED').length,
      unassigned: rosterList.filter((row) => !isAssigned(row)).length,
      requested_room_type: {
        thuong: rosterList.filter((row) => requestedRoomType(row) === 'Thường').length,
        may_lanh: rosterList.filter((row) => requestedRoomType(row) === 'Máy lạnh').length,
        unknown: rosterList.filter((row) => !ROOM_TYPES.includes(requestedRoomType(row))).length,
      },
    };

    const category = (type: string) =>
      type === 'Phí phòng' ? 'fee' : type === 'Điện' || type === 'Nước' ? 'utility' : null;
    const feeSummary = { fee: { paid: 0, unpaid: 0 }, utility: { paid: 0, unpaid: 0 } };
    for (const rosterEntry of rosterList) {
      const created = new Date(rosterEntry.createdAt);
      const bucket = monthly.find(
        (item) => item.month === `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`,
      );
      if (bucket) bucket.registrations++;
    }
    for (const contract of contractList.filter((item) => item.status === 'Hiệu lực')) {
      const date = new Date(contract.start_date);
      const bucket = monthly.find(
        (item) => item.month === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      );
      if (bucket) bucket.move_ins++;
    }
    for (const invoice of invoiceList) {
      const paid = invoice.status === 'Đã thanh toán';
      for (const item of invoice.items || []) {
        const group = category(item.type);
        if (!group) continue;
        feeSummary[group][paid ? 'paid' : 'unpaid']++;
        const raw = /^T(\d{2})\/(\d{4})$/.exec(String(invoice.billing_period || ''));
        const bucket = raw
          ? monthly.find((row) => row.month === `${raw[2]}-${raw[1]}`)
          : undefined;
        if (bucket) {
          bucket[`${group === 'fee' ? 'dormitory_fee' : 'utility'}_${paid ? 'paid' : 'unpaid'}`]++;
        }
      }
    }

    const activeContracts = contractList.filter((contract) => contract.status === 'Hiệu lực');
    const roomsWithBeds = roomRows.filter((room) => room.free_beds > 0);
    const occupiedRooms = roomRows.filter((room) => room.occupied_beds > 0).length;

    return {
      // Legacy dashboard fields retained during the contract transition.
      total_rooms: roomSummary.total_rooms,
      available_rooms: roomsWithBeds.length,
      active_contracts: activeContracts.length,
      pending_registrations: registrationSummary.unassigned,
      unpaid_invoices: outstandingInvoiceCount,
      pending_maintenance: pendingMaintenance,
      rooms: {
        occupied: occupiedRooms,
        available: roomsWithBeds.length,
        air_conditioned: roomSummary.by_type.may_lanh,
        standard: roomSummary.by_type.thuong,
      },
      beds: {
        used: roomSummary.occupied_beds,
        free: roomSummary.free_beds,
      },
      students: { registered: rosterList.filter((row) => row.student_id).length, residing: activeContracts.length },
      dormitory_fees: feeSummary.fee,
      utilities: feeSummary.utility,
      monthly,
      room_summary: roomSummary,
      room_rows: roomRows,
      registration_summary: registrationSummary,
      invoice_summary: invoiceSummary,
    };
  }
}
