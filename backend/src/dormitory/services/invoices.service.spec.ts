jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => '12345678-uuid',
}));
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';

function query<T>(value: T) {
  const result: any = {
    exec: jest.fn().mockResolvedValue(value),
    lean: jest.fn(() => result),
    populate: jest.fn(() => result),
    sort: jest.fn(() => result),
    skip: jest.fn(() => result),
    limit: jest.fn(() => result),
  };
  return result;
}

describe('InvoicesService', () => {
  const roomId = '507f1f77bcf86cd799439011';
  const room = {
    _id: roomId,
    room_code: 'P101',
    room_name: 'Phòng 101',
    room_price: 500000,
  } as any;

  const rosterEntries = [
    { _id: 'roster-1', room_id: roomId, full_name: 'Nguyễn Văn A' },
    { _id: 'roster-2', room_id: roomId, full_name: 'Trần Thị B' },
  ];

  function setup() {
    const saved = jest.fn().mockImplementation(async function (this: any) {
      return {
        ...this,
        _id: this._id || 'inv-1',
        toObject() {
          return { ...this };
        },
      };
    });

    const invoiceModel: any = jest.fn().mockImplementation((value: any) => ({
      ...value,
      save: saved,
      toObject() {
        return { ...this };
      },
    }));

    invoiceModel.find = jest.fn(() => query([]));
    invoiceModel.findOne = jest.fn(() => query(null));
    invoiceModel.findById = jest.fn(() => query(null));
    invoiceModel.countDocuments = jest.fn(() => query(0));
    invoiceModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    invoiceModel.deleteMany = jest.fn(() => query({ deletedCount: 1 }));

    const contractModel: any = {
      find: jest.fn(() => query([])),
      findOne: jest.fn(() => query(null)),
    };

    const roomModel: any = {
      findById: jest.fn(() => query(room)),
      find: jest.fn(() => query([room])),
    };

    const rosterModel: any = {
      find: jest.fn(() => query(rosterEntries)),
    };

    const configDoc: any = {
      electricity: { quota_per_person: 15, unit_price: 2500, unit: 'kWh' },
      water: { quota_per_person: 4, unit_price: 10000, unit: 'm³' },
      configured_collection_days: 10,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const utilityConfigModel: any = jest.fn().mockImplementation((value: any) => ({
      ...configDoc,
      ...value,
      save: jest.fn().mockImplementation(async function (this: any) {
        return { ...this, _id: 'config-1' };
      }),
    }));
    utilityConfigModel.findOne = jest.fn(() => query(configDoc));

    const service = new InvoicesService(
      invoiceModel,
      contractModel,
      roomModel,
      rosterModel,
      utilityConfigModel,
    );

    return {
      service,
      saved,
      invoiceModel,
      roomModel,
      rosterModel,
      contractModel,
      utilityConfigModel,
      configDoc,
    };
  }

  describe('calculateUtility (AC-03, AC-04)', () => {
    it('calculates consumption, quota_total, excess, and amount accurately', () => {
      const { service } = setup();
      const result = service.calculateUtility(
        2, // 2 occupants
        {
          previous_reading: 100,
          current_reading: 150, // 50 kWh actual
          quota_per_person: 15, // 30 kWh quota total
          unit_price: 2500, // 20 kWh excess * 2500 = 50,000
        },
        false,
      );

      expect(result.consumption).toBe(50);
      expect(result.quota_total).toBe(30);
      expect(result.excess_consumption).toBe(20);
      expect(result.amount).toBe(50000);
    });

    it('returns 0 amount when consumption is within quota', () => {
      const { service } = setup();
      const result = service.calculateUtility(
        4, // 4 occupants
        {
          previous_reading: 100,
          current_reading: 120, // 20 kWh actual
          quota_per_person: 15, // 60 kWh quota total
          unit_price: 2500,
        },
        false,
      );

      expect(result.consumption).toBe(20);
      expect(result.quota_total).toBe(60);
      expect(result.excess_consumption).toBe(0);
      expect(result.amount).toBe(0);
    });

    it('returns 0 amount when isExempt is true but preserves readings', () => {
      const { service } = setup();
      const result = service.calculateUtility(
        2,
        {
          previous_reading: 100,
          current_reading: 150,
          quota_per_person: 10,
          unit_price: 2500,
        },
        true, // isExempt
      );

      expect(result.consumption).toBe(50);
      expect(result.excess_consumption).toBe(30);
      expect(result.amount).toBe(0);
    });

    it('rejects current_reading < previous_reading (AC-04)', () => {
      const { service } = setup();
      expect(() =>
        service.calculateUtility(2, {
          previous_reading: 150,
          current_reading: 100,
          quota_per_person: 15,
          unit_price: 2500,
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects negative numbers (AC-04)', () => {
      const { service } = setup();
      expect(() =>
        service.calculateUtility(2, {
          previous_reading: -10,
          current_reading: 50,
          quota_per_person: 15,
          unit_price: 2500,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('createMonthly (AC-01, AC-03, AC-04, AC-05, AC-06)', () => {
    it('creates a monthly invoice with auto calculation and roster snapshot', async () => {
      const { service, saved } = setup();

      const result = await service.createMonthly(
        {
          room_id: roomId,
          billing_month: '2026-03',
          reading_date: '2026-03-25',
          electricity: {
            previous_reading: 100,
            current_reading: 160, // 60 kWh - (2 * 15) = 30 kWh excess * 2500 = 75,000
            quota_per_person: 15,
            unit_price: 2500,
          },
          water: {
            previous_reading: 20,
            current_reading: 32, // 12 m3 - (2 * 4) = 4 m3 excess * 10000 = 40,000
            quota_per_person: 4,
            unit_price: 10000,
          },
          payment_start_date: '2026-03-25',
          due_date: '2026-04-05',
          notes: 'Đợt thu T03',
        },
        { userId: 'user-1' },
      );

      expect(saved).toHaveBeenCalled();
      expect(result.invoice_code).toBe('INV-12345678');
      expect(result.billing_month).toBe('2026-03');
      expect(result.occupant_count).toBe(2);
      expect(result.roster_entry_ids).toEqual(['roster-1', 'roster-2']);
      expect(result.electricity?.amount).toBe(75000);
      expect(result.water?.amount).toBe(40000);
      expect(result.total_amount).toBe(115000);
      expect(result.status).toBe('Chưa thu');
    });

    it('rejects duplicate room_id + billing_month (AC-01, AC-04)', async () => {
      const { service, invoiceModel } = setup();
      invoiceModel.findOne.mockReturnValue(
        query({ _id: 'existing-inv', room_id: roomId, billing_month: '2026-03' }),
      );

      await expect(
        service.createMonthly(
          {
            room_id: roomId,
            billing_month: '2026-03',
            reading_date: '2026-03-25',
            electricity: {
              previous_reading: 100,
              current_reading: 120,
              quota_per_person: 15,
              unit_price: 2500,
            },
            water: {
              previous_reading: 10,
              current_reading: 15,
              quota_per_person: 4,
              unit_price: 10000,
            },
            due_date: '2026-04-05',
          },
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects due_date < payment_start_date (AC-04)', async () => {
      const { service } = setup();

      await expect(
        service.createMonthly(
          {
            room_id: roomId,
            billing_month: '2026-03',
            reading_date: '2026-03-25',
            payment_start_date: '2026-04-10',
            due_date: '2026-04-05', // due before start
            electricity: {
              previous_reading: 100,
              current_reading: 120,
              quota_per_person: 15,
              unit_price: 2500,
            },
            water: {
              previous_reading: 10,
              current_reading: 15,
              quota_per_person: 4,
              unit_price: 10000,
            },
          },
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects invalid billing_month format (AC-04)', async () => {
      const { service } = setup();

      await expect(
        service.createMonthly(
          {
            room_id: roomId,
            billing_month: 'invalid-month',
            reading_date: '2026-03-25',
            due_date: '2026-04-05',
            electricity: {
              previous_reading: 100,
              current_reading: 120,
              quota_per_person: 15,
              unit_price: 2500,
            },
            water: {
              previous_reading: 10,
              current_reading: 15,
              quota_per_person: 4,
              unit_price: 10000,
            },
          },
          {},
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates exempt invoice with total_amount = 0 (AC-04)', async () => {
      const { service } = setup();

      const result = await service.createMonthly(
        {
          room_id: roomId,
          billing_month: '2026-03',
          reading_date: '2026-03-25',
          is_exempt: true,
          electricity: {
            previous_reading: 100,
            current_reading: 200,
            quota_per_person: 15,
            unit_price: 2500,
          },
          water: {
            previous_reading: 10,
            current_reading: 30,
            quota_per_person: 4,
            unit_price: 10000,
          },
          due_date: '2026-04-05',
        },
        {},
      );

      expect(result.is_exempt).toBe(true);
      expect(result.total_amount).toBe(0);
      expect(result.electricity?.consumption).toBe(100);
      expect(result.water?.consumption).toBe(20);
    });
  });

  describe('updateMonthly (AC-03, AC-04)', () => {
    it('updates invoice readings and recalculates amounts', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        room_id: roomId,
        billing_month: '2026-03',
        status: 'Chưa thu',
        occupant_count: 2,
        electricity: {
          previous_reading: 100,
          current_reading: 120,
          quota_per_person: 15,
          unit_price: 2500,
        },
        water: {
          previous_reading: 10,
          current_reading: 15,
          quota_per_person: 4,
          unit_price: 10000,
        },
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.updateMonthly(
        'inv-1',
        {
          electricity: {
            previous_reading: 100,
            current_reading: 160, // 60 - 30 = 30 * 2500 = 75000
            quota_per_person: 15,
            unit_price: 2500,
          },
        },
        {},
      );

      expect(result.electricity?.amount).toBe(75000);
    });

    it('rejects editing an already paid invoice', async () => {
      const { service, invoiceModel } = setup();
      invoiceModel.findById.mockReturnValue(
        query({ _id: 'inv-1', status: 'Đã thu' }),
      );

      await expect(
        service.updateMonthly('inv-1', { notes: 'new note' }, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('pay (AC-07, AC-08)', () => {
    it('confirms payment and saves proof metadata', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Chưa thu',
        total_amount: 100000,
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.pay(
        'inv-1',
        {
          payment_method: 'Chuyển khoản',
          notes: 'Đã nhận tiền qua Vietcombank',
          payment_proof: {
            url: '/uploads/proof-1.png',
            file_name: 'proof-1.png',
            mime_type: 'image/png',
            size: 102400,
          },
        },
        { userId: 'user-admin' },
      );

      expect(result.status).toBe('Chưa thu');
      expect(result.payment_review?.status).toBe('pending');
      expect(result.payment_method).toBe('Chuyển khoản');
      expect(result.payment_proof?.url).toBe('/uploads/proof-1.png');
      expect(result.confirmed_by_id).toBeUndefined();
    });

    it('confirms cash payment immediately as Đã thu without review', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Chưa thu',
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.pay(
        'inv-1',
        {
          payment_method: 'Tiền mặt',
          notes: 'Thu tiền mặt tại văn phòng',
        },
        { userId: 'user-admin' },
      );

      expect(result.status).toBe('Đã thu');
      expect(result.payment_method).toBe('Tiền mặt');
      expect(result.confirmed_by_id).toBe('user-admin');
      expect(result.paid_at).toBeDefined();
    });

    it('rejects paying an already paid invoice', async () => {
      const { service, invoiceModel } = setup();
      invoiceModel.findById.mockReturnValue(
        query({ _id: 'inv-1', status: 'Đã thu' }),
      );

      await expect(
        service.pay('inv-1', { payment_method: 'Tiền mặt' }, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updatePaymentProof', () => {
    it('updates payment proof metadata and sets review to pending', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Đã thu',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/old-proof.png' },
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.updatePaymentProof(
        'inv-1',
        {
          payment_proof: {
            url: '/uploads/new-proof.png',
            file_name: 'new-proof.png',
            mime_type: 'image/png',
            size: 204800,
          },
          notes: 'Đã cập nhật lại ảnh chuyển khoản đúng',
        },
        { userId: 'admin-2' },
      );

      expect(result.payment_proof?.url).toBe('/uploads/new-proof.png');
      expect(result.notes).toBe('Đã cập nhật lại ảnh chuyển khoản đúng');
      expect(result.payment_review?.status).toBe('pending');
      expect(result.status).toBe('Chưa thu');
      expect(result.confirmed_by_id).toBeUndefined();
    });
  });

  describe('reviewPaymentProof', () => {
    it('approves pending proof and marks invoice as Đã thu', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Chưa thu',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'pending' },
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.reviewPaymentProof('inv-1', 'approved', { userId: 'admin-1' });
      expect(result.status).toBe('Đã thu');
      expect(result.payment_review?.status).toBe('approved');
      expect(result.payment_review?.reviewed_by_id).toBe('admin-1');
      expect(result.payment_review?.reviewed_at).toBeDefined();
      expect(result.confirmed_by_id).toBe('admin-1');
      expect(result.paid_at).toBeDefined();
    });

    it('rejects pending proof and keeps invoice as Chưa thu', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Chưa thu',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'pending' },
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.reviewPaymentProof('inv-1', 'rejected', { userId: 'admin-1' });
      expect(result.status).toBe('Chưa thu');
      expect(result.payment_review?.status).toBe('rejected');
      expect(result.payment_review?.reviewed_by_id).toBe('admin-1');
      expect(result.confirmed_by_id).toBeUndefined();
      expect(result.paid_at).toBeUndefined();
    });

    it('revokes approved proof, changes invoice to Chưa thu and records revoker info', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Đã thu',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'approved', reviewed_by_id: 'admin-1', reviewed_at: new Date() },
        confirmed_by_id: 'admin-1',
        paid_at: new Date(),
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      const result = await service.reviewPaymentProof('inv-1', 'revoked', { userId: 'admin-2' });
      expect(result.status).toBe('Chưa thu');
      expect(result.payment_review?.status).toBe('rejected');
      expect(result.payment_review?.revoked_by_id).toBe('admin-2');
      expect(result.payment_review?.revoked_at).toBeDefined();
      expect(result.confirmed_by_id).toBeUndefined();
      expect(result.paid_at).toBeUndefined();
      expect(result.payment_proof?.url).toBe('/uploads/proof.png');
    });

    it('rejects revoking when invoice is not approved or not collected', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Chưa thu',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'pending' },
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      await expect(
        service.reviewPaymentProof('inv-1', 'revoked', { userId: 'admin-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects review when proof is not pending', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Đã thu',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'approved' },
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      await expect(
        service.reviewPaymentProof('inv-1', 'approved', { userId: 'admin-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects review when invoice has no proof or is not transfer', async () => {
      const { service, invoiceModel } = setup();
      const existing = {
        _id: 'inv-1',
        status: 'Chưa thu',
        payment_method: 'Tiền mặt',
      };
      invoiceModel.findById.mockReturnValue(query(existing));

      await expect(
        service.reviewPaymentProof('inv-1', 'approved', { userId: 'admin-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getRoomInfo', () => {
    it('returns room details, occupant count from roster, and last invoice readings', async () => {
      const { service, invoiceModel } = setup();
      invoiceModel.findOne.mockReturnValue(
        query({
          electricity: { current_reading: 250 },
          water: { current_reading: 45 },
        }),
      );

      const info = await service.getRoomInfo(roomId);

      expect(info.room._id).toBe(roomId);
      expect(info.occupant_count).toBe(2);
      expect(info.last_readings.electricity).toBe(250);
      expect(info.last_readings.water).toBe(45);
    });
  });

  describe('UtilityConfig (AC-01)', () => {
    it('getUtilityConfig returns existing config or creates default', async () => {
      const { service, configDoc } = setup();
      const config = await service.getUtilityConfig();
      expect(config.electricity.unit_price).toBe(2500);
      expect(config.configured_collection_days).toBe(10);
    });

    it('updateUtilityConfig updates config with validated parameters', async () => {
      const { service, configDoc } = setup();
      const updated = await service.updateUtilityConfig(
        {
          electricity: { quota_per_person: 20, unit_price: 3000, unit: 'kWh' },
          water: { quota_per_person: 5, unit_price: 12000, unit: 'm³' },
          configured_collection_days: 15,
        },
        { userId: 'admin-1' },
      );

      expect(updated.electricity.unit_price).toBe(3000);
      expect(updated.water.unit_price).toBe(12000);
      expect(updated.configured_collection_days).toBe(15);
      expect(updated.updated_by_id).toBe('admin-1');
    });
  });

  describe('getMeterReadings (AC-01, AC-02, AC-03)', () => {
    it('returns all rooms from roomModel including occupied and empty rooms with previous readings and status (AC-01, AC-02)', async () => {
      const { service, roomModel, rosterModel, invoiceModel } = setup();
      const emptyRoom = {
        _id: '507f1f77bcf86cd799439022',
        room_code: 'P102',
        room_name: 'Phòng 102',
        room_price: 500000,
      };

      roomModel.find.mockReturnValue(
        query([emptyRoom, room]),
      );

      // Roster only contains occupants for room 1 (P101)
      rosterModel.find.mockReturnValue(
        query([
          { _id: 'r-1', room_id: room._id },
          { _id: 'r-2', room_id: room._id },
        ]),
      );

      // Mock invoices: room 1 has previous readings, room 2 has no previous
      invoiceModel.findOne.mockImplementation(({ room_id, billing_month }: any) => {
        if (room_id === roomId) {
          return query({
            electricity: { current_reading: 150 },
            water: { current_reading: 25 },
          });
        }
        return query(null);
      });

      const result = await service.getMeterReadings('2026-03');

      expect(result.billing_month).toBe('2026-03');
      expect(result.rooms.length).toBe(2);

      // Verify sorting: P101 before P102
      expect(result.rooms[0].room_id).toBe(roomId);
      expect(result.rooms[0].occupant_count).toBe(2);
      expect(result.rooms[0].previous_readings.electricity).toBe(150);
      expect(result.rooms[0].previous_readings.water).toBe(25);

      // Empty room
      expect(result.rooms[1].room_id).toBe('507f1f77bcf86cd799439022');
      expect(result.rooms[1].occupant_count).toBe(0);
      expect(result.rooms[1].previous_readings.electricity).toBe(0);
      expect(result.rooms[1].previous_readings.water).toBe(0);
      expect(result.rooms[1].status).toBe('unrecorded');
    });

    it('rejects invalid billing_month format', async () => {
      const { service } = setup();
      await expect(service.getMeterReadings('invalid-month')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('saveBulkMeterReadings (AC-03, AC-04, AC-05, AC-06, AC-07)', () => {
    it('saves valid readings, snapshots config & roster, and calculates server dates (AC-04, AC-05)', async () => {
      const { service, saved, invoiceModel } = setup();
      // No existing invoice in this month
      invoiceModel.findOne.mockReturnValueOnce(query(null));
      // Previous invoice
      invoiceModel.findOne.mockReturnValueOnce(
        query({
          electricity: { current_reading: 100 },
          water: { current_reading: 10 },
        }),
      );

      const result = await service.saveBulkMeterReadings(
        {
          billing_month: '2026-03',
          readings: [
            {
              room_id: roomId,
              electricity_reading: 150, // 50 kWh - (2 * 15) = 20 excess * 2500 = 50,000
              water_reading: 20, // 10 m3 - (2 * 4) = 2 excess * 10000 = 20,000
            },
          ],
        },
        { userId: 'admin-1' },
      );

      expect(result.results.length).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].invoice?.total_amount).toBe(70000);
      expect(result.results[0].invoice?.payment_start_date).toBeDefined();
      expect(result.results[0].invoice?.due_date).toBeDefined();
      expect(saved).toHaveBeenCalled();
    });

    it('saves readings for empty room with 0 occupants and charges full consumption (AC-07)', async () => {
      const { service, saved, invoiceModel, rosterModel, roomModel } = setup();
      const emptyRoomId = '507f1f77bcf86cd799439022';
      const emptyRoom = {
        _id: emptyRoomId,
        room_code: 'P102',
        room_name: 'Phòng 102',
      };
      roomModel.findById.mockReturnValue(query(emptyRoom));
      rosterModel.find.mockReturnValue(query([])); // 0 occupants

      // No existing invoice in this month
      invoiceModel.findOne.mockReturnValueOnce(query(null));
      // Previous invoice
      invoiceModel.findOne.mockReturnValueOnce(
        query({
          electricity: { current_reading: 100 },
          water: { current_reading: 10 },
        }),
      );

      const result = await service.saveBulkMeterReadings(
        {
          billing_month: '2026-03',
          readings: [
            {
              room_id: emptyRoomId,
              electricity_reading: 120, // 20 kWh - 0 quota = 20 excess * 2500 = 50,000
              water_reading: 15, // 5 m3 - 0 quota = 5 excess * 10000 = 50,000
            },
          ],
        },
        { userId: 'admin-1' },
      );

      expect(result.results.length).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].invoice?.occupant_count).toBe(0);
      expect(result.results[0].invoice?.roster_entry_ids).toEqual([]);
      expect(result.results[0].invoice?.total_amount).toBe(100000);
      expect(saved).toHaveBeenCalled();
    });

    it('handles partial failures without failing other valid rooms (AC-06)', async () => {
      const { service, invoiceModel } = setup();
      // First room: no invoice, previous 100
      invoiceModel.findOne.mockReturnValueOnce(query(null));
      invoiceModel.findOne.mockReturnValueOnce(
        query({
          electricity: { current_reading: 100 },
          water: { current_reading: 10 },
        }),
      );
      // Second room: invalid reading (decreasing)
      invoiceModel.findOne.mockReturnValueOnce(query(null));
      invoiceModel.findOne.mockReturnValueOnce(
        query({
          electricity: { current_reading: 200 },
          water: { current_reading: 30 },
        }),
      );

      const result = await service.saveBulkMeterReadings(
        {
          billing_month: '2026-03',
          readings: [
            {
              room_id: roomId,
              electricity_reading: 150,
              water_reading: 20,
            },
            {
              room_id: roomId,
              electricity_reading: 180, // less than 200!
              water_reading: 40,
            },
          ],
        },
        {},
      );

      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('Chỉ số điện mới không được nhỏ hơn chỉ số cũ');
    });

    it('rejects modifying paid invoices (AC-07)', async () => {
      const { service, invoiceModel } = setup();
      invoiceModel.findOne.mockReturnValue(
        query({
          _id: 'paid-inv',
          status: 'Đã thu',
          electricity: { previous_reading: 100 },
          water: { previous_reading: 10 },
        }),
      );

      const result = await service.saveBulkMeterReadings(
        {
          billing_month: '2026-03',
          readings: [
            {
              room_id: roomId,
              electricity_reading: 150,
              water_reading: 20,
            },
          ],
        },
        {},
      );

      expect(result.results.length).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Không thể chỉnh sửa hóa đơn đã thu');
    });
  });

  describe('bulkDelete (AC-04, AC-05)', () => {
    const invId1 = '507f1f77bcf86cd799439031';
    const invId2 = '507f1f77bcf86cd799439032';
    const paidInvId = '507f1f77bcf86cd799439033';

    it('deletes valid unpaid invoices and returns deterministic results (AC-04)', async () => {
      const { service, invoiceModel } = setup();
      const unpaid1 = { _id: invId1, invoice_code: 'INV-1', status: 'Chưa thu' };
      const unpaid2 = { _id: invId2, invoice_code: 'INV-2', status: 'Chưa thanh toán' };

      invoiceModel.find.mockReturnValue(query([unpaid1, unpaid2]));

      const result = await service.bulkDelete([invId1, invId2], { userId: 'admin-1' });

      expect(invoiceModel.deleteMany).toHaveBeenCalled();
      expect(result.requested).toBe(2);
      expect(result.deleted).toEqual([invId1, invId2]);
      expect(result.not_found).toEqual([]);
      expect(result.rejected).toEqual([]);
    });

    it('rejects paid invoices and leaves them untouched (AC-05)', async () => {
      const { service, invoiceModel } = setup();
      const unpaid = { _id: invId1, invoice_code: 'INV-1', status: 'Chưa thu' };
      const paid = { _id: paidInvId, invoice_code: 'INV-PAID', status: 'Đã thu' };

      invoiceModel.find.mockReturnValue(query([unpaid, paid]));

      const result = await service.bulkDelete([invId1, paidInvId], { userId: 'admin-1' });

      expect(result.requested).toBe(2);
      expect(result.deleted).toEqual([invId1]);
      expect(result.rejected).toEqual([
        {
          id: paidInvId,
          invoice_code: 'INV-PAID',
          reason: 'Không thể xóa hóa đơn đã thanh toán',
        },
      ]);
    });

    it('reports not_found for IDs not in database and invalid format for malformed IDs', async () => {
      const { service, invoiceModel } = setup();
      const notFoundId = '507f1f77bcf86cd799439099';
      const invalidId = 'invalid-not-an-objectid';

      invoiceModel.find.mockReturnValue(query([]));

      const result = await service.bulkDelete([notFoundId, invalidId], { userId: 'admin-1' });

      expect(result.requested).toBe(2);
      expect(result.deleted).toEqual([]);
      expect(result.not_found).toEqual([notFoundId]);
      expect(result.rejected).toEqual([
        {
          id: invalidId,
          reason: 'Mã hóa đơn không hợp lệ',
        },
      ]);
    });

    it('deduplicates input IDs before processing', async () => {
      const { service, invoiceModel } = setup();
      const unpaid = { _id: invId1, invoice_code: 'INV-1', status: 'Chưa thu' };

      invoiceModel.find.mockReturnValue(query([unpaid]));

      const result = await service.bulkDelete([invId1, invId1, invId1], { userId: 'admin-1' });

      expect(result.requested).toBe(1);
      expect(result.deleted).toEqual([invId1]);
    });

    it('throws BadRequestException on empty array or non-array input', async () => {
      const { service } = setup();

      await expect(service.bulkDelete([], {})).rejects.toThrow(BadRequestException);
      await expect(service.bulkDelete(null as any, {})).rejects.toThrow(BadRequestException);
    });
  });
});

