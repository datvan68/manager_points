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

    const service = new InvoicesService(
      invoiceModel,
      contractModel,
      roomModel,
      rosterModel,
    );

    return {
      service,
      saved,
      invoiceModel,
      roomModel,
      rosterModel,
      contractModel,
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

      expect(result.status).toBe('Đã thu');
      expect(result.payment_method).toBe('Chuyển khoản');
      expect(result.payment_proof?.url).toBe('/uploads/proof-1.png');
      expect(result.confirmed_by_id).toBe('user-admin');
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
});
