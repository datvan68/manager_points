jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => '12345678-uuid',
}));

import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { RoomFeeInvoicesService } from './room-fee-invoices.service';

function query<T>(value: T) {
  const result: any = {
    exec: jest.fn().mockResolvedValue(value),
    lean: jest.fn(() => result),
    populate: jest.fn(() => result),
    sort: jest.fn(() => result),
    skip: jest.fn(() => result),
    limit: jest.fn(() => result),
    select: jest.fn(() => result),
  };
  return result;
}

describe('RoomFeeInvoicesService', () => {
  const roomStandardId = '507f1f77bcf86cd799439011';
  const roomAcId = '507f1f77bcf86cd799439022';
  const roster1Id = '507f1f77bcf86cd799439033';
  const roster2Id = '507f1f77bcf86cd799439044';

  const roomStandard = {
    _id: roomStandardId,
    room_code: 'P101',
    room_name: 'Phòng 101',
    room_type: 'Thường',
  } as any;

  const roomAc = {
    _id: roomAcId,
    room_code: 'P201',
    room_name: 'Phòng 201',
    room_type: 'Máy lạnh',
  } as any;

  const rosterEntries = [
    {
      _id: roster1Id,
      student_id: 'student-1',
      room_id: roomStandard,
      full_name: 'Nguyễn Văn A',
      student_code: 'SV001',
      semester_id: 'sem-1',
    },
    {
      _id: roster2Id,
      student_id: 'student-2',
      room_id: roomAc,
      full_name: 'Trần Thị B',
      student_code: 'SV002',
      semester_id: 'sem-1',
    },
  ];

  function setup() {
    const saved = jest.fn().mockImplementation(async function (this: any) {
      return {
        ...this,
        _id: this._id || 'rfi-1',
        toObject() {
          return { ...this };
        },
      };
    });

    const roomFeeInvoiceModel: any = jest.fn().mockImplementation((value: any) => ({
      ...value,
      save: saved,
      toObject() {
        return { ...this };
      },
    }));

    roomFeeInvoiceModel.find = jest.fn(() => query([]));
    roomFeeInvoiceModel.findOne = jest.fn(() => query(null));
    roomFeeInvoiceModel.findById = jest.fn(() => query(null));
    roomFeeInvoiceModel.countDocuments = jest.fn(() => query(0));
    roomFeeInvoiceModel.updateOne = jest.fn(() => query({ modifiedCount: 1 }));
    roomFeeInvoiceModel.deleteOne = jest.fn(() => query({ deletedCount: 1 }));

    const configDoc: any = {
      standard_monthly_rate: 500000,
      air_conditioned_monthly_rate: 700000,
      months_to_collect: 5,
      save: jest.fn().mockImplementation(async function (this: any) {
        return this;
      }),
    };

    const roomFeeConfigModel: any = jest.fn().mockImplementation((value: any) => ({
      ...configDoc,
      ...value,
      save: jest.fn().mockImplementation(async function (this: any) {
        return { ...this, _id: 'config-1' };
      }),
    }));
    roomFeeConfigModel.findOne = jest.fn(() => query(configDoc));

    const rosterModel: any = {
      find: jest.fn(() => query(rosterEntries)),
      findById: jest.fn((id: string) =>
        query(rosterEntries.find((r) => String(r._id) === String(id)) || null),
      ),
    };

    const roomModel: any = {
      findById: jest.fn((id: string) =>
        query(id === roomAcId ? roomAc : roomStandard),
      ),
      find: jest.fn(() => query([roomStandard, roomAc])),
    };

    const service = new RoomFeeInvoicesService(
      roomFeeInvoiceModel,
      roomFeeConfigModel,
      rosterModel,
      roomModel,
    );

    return {
      service,
      saved,
      roomFeeInvoiceModel,
      roomFeeConfigModel,
      rosterModel,
      roomModel,
      configDoc,
    };
  }

  describe('calculatePeriodEnd', () => {
    it('calculates end month correctly within the same year', () => {
      const { service } = setup();
      const endMonth = service.calculatePeriodEnd('2026-03', 5);
      expect(endMonth).toBe('2026-07');
    });

    it('calculates end month correctly across year boundary', () => {
      const { service } = setup();
      const endMonth = service.calculatePeriodEnd('2026-11', 3);
      expect(endMonth).toBe('2027-01');
    });

    it('throws BadRequestException on invalid start_month format', () => {
      const { service } = setup();
      expect(() => service.calculatePeriodEnd('2026-13', 5)).toThrow(
        BadRequestException,
      );
      expect(() => service.calculatePeriodEnd('invalid', 5)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on invalid monthsCount', () => {
      const { service } = setup();
      expect(() => service.calculatePeriodEnd('2026-03', 0)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getConfig and updateConfig', () => {
    it('returns existing config or creates default', async () => {
      const { service, roomFeeConfigModel, configDoc } = setup();
      const result = await service.getConfig();
      expect(roomFeeConfigModel.findOne).toHaveBeenCalled();
      expect(result.standard_monthly_rate).toBe(500000);
      expect(result.air_conditioned_monthly_rate).toBe(700000);
      expect(result.months_to_collect).toBe(5);
    });

    it('updates config fields and records updater ID', async () => {
      const { service, configDoc } = setup();
      const dto = {
        standard_monthly_rate: 600000,
        air_conditioned_monthly_rate: 850000,
        months_to_collect: 6,
        transfer_qr_image: {
          url: '/uploads/invoice-transfer-qr-1.png',
          file_name: 'invoice-transfer-qr-1.png',
          mime_type: 'image/png',
          size: 10240,
        },
      };
      const user = { userId: 'admin-1' };

      const result = await service.updateConfig(dto, user);
      expect(configDoc.save).toHaveBeenCalled();
      expect(result.standard_monthly_rate).toBe(600000);
      expect(result.air_conditioned_monthly_rate).toBe(850000);
      expect(result.months_to_collect).toBe(6);
      expect(result.updated_by_id).toBe('admin-1');
    });
  });

  describe('previewPeriod (AC-04)', () => {
    it('calculates preview counts and amounts accurately based on room types', async () => {
      const { service } = setup();
      const dto = {
        start_month: '2026-03',
        months_count: 5,
      };

      const preview = await service.previewPeriod(dto);
      expect(preview.start_month).toBe('2026-03');
      expect(preview.end_month).toBe('2026-07');
      expect(preview.months_count).toBe(5);
      expect(preview.total_assigned).toBe(2);
      expect(preview.eligible_count).toBe(2);
      expect(preview.eligible_standard_count).toBe(1);
      expect(preview.eligible_ac_count).toBe(1);
      expect(preview.skipped_existing_count).toBe(0);
      // Standard: 500,000 * 5 = 2,500,000; AC: 700,000 * 5 = 3,500,000 -> Total = 6,000,000
      expect(preview.expected_total_amount).toBe(6000000);
    });

    it('accounts for already issued invoices in skipped_existing_count', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      roomFeeInvoiceModel.find = jest.fn(() =>
        query([{ roster_entry_id: roster1Id }]),
      );

      const preview = await service.previewPeriod({ start_month: '2026-03' });
      expect(preview.eligible_count).toBe(1);
      expect(preview.skipped_existing_count).toBe(1);
      // Only roster-2 (AC) is eligible: 700,000 * 5 = 3,500,000
      expect(preview.expected_total_amount).toBe(3500000);
    });
  });

  describe('createPeriod (AC-05, AC-06)', () => {
    it('creates immutable charges for all eligible roster members', async () => {
      const { service, saved } = setup();
      const dto = {
        start_month: '2026-03',
        months_count: 5,
        due_date: '2026-04-15',
        notes: 'Đợt thu học kỳ 2',
      };
      const user = { _id: 'user-1' };

      const result = await service.createPeriod(dto, user);
      expect(result.created_count).toBe(2);
      expect(result.skipped_count).toBe(0);
      expect(result.total_amount).toBe(6000000);
      expect(saved).toHaveBeenCalledTimes(2);
    });

    it('handles duplicate unique constraint safely as skipped', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      let callIndex = 0;
      roomFeeInvoiceModel.mockImplementation((value: any) => ({
        ...value,
        save: jest.fn().mockImplementation(async () => {
          callIndex++;
          if (callIndex === 1) {
            const err: any = new Error('Duplicate key');
            err.code = 11000;
            throw err;
          }
          return { _id: 'rfi-2' };
        }),
      }));

      const result = await service.createPeriod(
        { start_month: '2026-03' },
        { _id: 'user-1' },
      );
      expect(result.created_count).toBe(1);
      expect(result.skipped_count).toBe(1);
    });
  });

  describe('pay (AC-07, AC-08)', () => {
    it('records cash payment as Đã thu immediately', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const mockInvoice = {
        _id: 'rfi-1',
        status: 'Chưa thu',
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      roomFeeInvoiceModel.findById = jest.fn(() => query(mockInvoice));

      const result = await service.pay(
        'rfi-1',
        { payment_method: 'Tiền mặt', notes: 'Thanh toán tiền mặt tại quầy' },
        { userId: 'cashier-1' },
      );

      expect(result.status).toBe('Đã thu');
      expect(result.payment_method).toBe('Tiền mặt');
      expect(result.paid_at).toBeDefined();
      expect(result.confirmed_by_id).toBe('cashier-1');
    });

    it('records transfer payment with proof and sets review to pending', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const mockInvoice = {
        _id: 'rfi-1',
        status: 'Chưa thu',
        save: jest.fn().mockImplementation(async function (this: any) {
          return this;
        }),
      };
      roomFeeInvoiceModel.findById = jest.fn(() => query(mockInvoice));

      const result = await service.pay(
        'rfi-1',
        {
          payment_method: 'Chuyển khoản',
          payment_proof: {
            url: '/uploads/invoice-proof-1.png',
            file_name: 'invoice-proof-1.png',
            mime_type: 'image/png',
            size: 20480,
          },
        },
        { userId: 'student-1' },
      );

      expect(result.status).toBe('Chưa thu');
      expect(result.payment_method).toBe('Chuyển khoản');
      expect(result.payment_review?.status).toBe('pending');
      expect(result.payment_proof?.url).toBe('/uploads/invoice-proof-1.png');
      expect(result.paid_at).toBeUndefined();
    });

    it('throws BadRequestException if invoice is already paid', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const mockInvoice = {
        _id: 'rfi-1',
        status: 'Đã thu',
      };
      roomFeeInvoiceModel.findById = jest.fn(() => query(mockInvoice));

      await expect(
        service.pay('rfi-1', { payment_method: 'Tiền mặt' }, { userId: 'u-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewPaymentProof (AC-08)', () => {
    it('approves proof and marks invoice as Đã thu atomically', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const mockInvoice = {
        _id: 'rfi-1',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'pending' },
        status: 'Chưa thu',
      };
      roomFeeInvoiceModel.findById = jest.fn(() => query(mockInvoice));

      const result = await service.reviewPaymentProof(
        'rfi-1',
        'approved',
        { userId: 'admin-1' },
      );
      expect(result.payment_review?.status).toBe('approved');
      expect(result.status).toBe('Đã thu');
      expect(result.paid_at).toBeDefined();
      expect(result.confirmed_by_id).toBe('admin-1');
    });

    it('rejects proof and records attempt while keeping invoice as Chưa thu', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const mockInvoice = {
        _id: 'rfi-1',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'pending', attempts: [] },
        status: 'Chưa thu',
      };
      roomFeeInvoiceModel.findById = jest.fn(() => query(mockInvoice));

      const result = await service.reviewPaymentProof(
        'rfi-1',
        'rejected',
        { userId: 'admin-1' },
        'req-1',
      );
      expect(result.payment_review?.status).toBe('pending');
      expect(result.status).toBe('Chưa thu');
      expect(result.payment_review?.attempts?.length).toBe(1);
    });

    it('revokes approved proof back to pending and status to Chưa thu', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const mockInvoice = {
        _id: 'rfi-1',
        payment_method: 'Chuyển khoản',
        payment_proof: { url: '/uploads/proof.png' },
        payment_review: { status: 'approved' },
        status: 'Đã thu',
      };
      roomFeeInvoiceModel.findById = jest.fn(() => query(mockInvoice));

      const result = await service.reviewPaymentProof(
        'rfi-1',
        'revoked',
        { userId: 'admin-1' },
      );
      expect(result.payment_review?.status).toBe('pending');
      expect(result.status).toBe('Chưa thu');
      expect(result.payment_review?.revoked_by_id).toBe('admin-1');
    });
  });

  describe('bulkDelete (AC-09)', () => {
    it('deletes unpaid invoices and rejects paid ones', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      const invoices = [
        { _id: 'rfi-1', status: 'Chưa thu', invoice_code: 'RFI-001' },
        { _id: 'rfi-2', status: 'Đã thu', invoice_code: 'RFI-002' },
      ];
      roomFeeInvoiceModel.find = jest.fn(() => query(invoices));

      const result = await service.bulkDelete(['rfi-1', 'rfi-2', 'rfi-3'], {
        userId: 'admin-1',
      });
      expect(result.requested).toBe(3);
      expect(result.deleted).toContain('rfi-1');
      expect(result.not_found).toContain('rfi-3');
      expect(result.rejected.some((r) => r.id === 'rfi-2')).toBe(true);
    });
  });

  describe('previewIndividual (AC-01, AC-02)', () => {
    it('calculates single member preview with default room type rate', async () => {
      const { service } = setup();
      const preview = await service.previewIndividual({
        roster_entry_id: roster1Id,
        start_month: '2026-03',
      });

      expect(preview.roster_entry_id).toBe(roster1Id);
      expect(preview.member_name).toBe('Nguyễn Văn A');
      expect(preview.room_code).toBe('P101');
      expect(preview.room_type).toBe('Thường');
      expect(preview.start_month).toBe('2026-03');
      expect(preview.end_month).toBe('2026-07');
      expect(preview.months_count).toBe(5);
      expect(preview.monthly_rate).toBe(500000);
      expect(preview.total_amount).toBe(2500000);
      expect(preview.already_exists).toBe(false);
    });

    it('calculates single member preview with custom monthly rate and custom months_count', async () => {
      const { service } = setup();
      const preview = await service.previewIndividual({
        roster_entry_id: roster2Id,
        start_month: '2026-03',
        months_count: 6,
        monthly_rate: 850000,
        due_date: '2026-04-15',
        notes: 'Ghi chú đặc biệt',
      });

      expect(preview.roster_entry_id).toBe(roster2Id);
      expect(preview.member_name).toBe('Trần Thị B');
      expect(preview.room_type).toBe('Máy lạnh');
      expect(preview.end_month).toBe('2026-08');
      expect(preview.months_count).toBe(6);
      expect(preview.monthly_rate).toBe(850000);
      expect(preview.total_amount).toBe(5100000);
      expect(preview.due_date).toBe('2026-04-15');
      expect(preview.notes).toBe('Ghi chú đặc biệt');
    });

    it('flags already_exists when an invoice for this period already exists', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      roomFeeInvoiceModel.findOne = jest.fn(() =>
        query({ _id: 'rfi-existing', invoice_code: 'RFI-EXIST-01' }),
      );

      const preview = await service.previewIndividual({
        roster_entry_id: roster1Id,
        start_month: '2026-03',
      });

      expect(preview.already_exists).toBe(true);
      expect(preview.existing_invoice_code).toBe('RFI-EXIST-01');
    });

    it('throws NotFoundException when roster entry does not exist', async () => {
      const { service, rosterModel } = setup();
      rosterModel.findById = jest.fn(() => query(null));

      await expect(
        service.previewIndividual({
          roster_entry_id: '507f1f77bcf86cd799439099',
          start_month: '2026-03',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when roster entry has no room or invalid room type', async () => {
      const { service, rosterModel } = setup();
      rosterModel.findById = jest.fn(() =>
        query({
          _id: '507f1f77bcf86cd799439099',
          room_id: null,
          full_name: 'Chưa xếp phòng',
        }),
      );

      await expect(
        service.previewIndividual({
          roster_entry_id: '507f1f77bcf86cd799439099',
          start_month: '2026-03',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on invalid ObjectId or negative rate', async () => {
      const { service } = setup();
      await expect(
        service.previewIndividual({
          roster_entry_id: 'invalid-id',
          start_month: '2026-03',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.previewIndividual({
          roster_entry_id: roster1Id,
          start_month: '2026-03',
          monthly_rate: -100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createIndividual (AC-03, AC-04, AC-05)', () => {
    it('creates an individual room-fee invoice with custom rate and immutable snapshots', async () => {
      const { service, saved, roomFeeConfigModel } = setup();
      const user = { _id: 'user-admin-1' };

      const invoice = await service.createIndividual(
        {
          roster_entry_id: roster1Id,
          start_month: '2026-03',
          months_count: 6,
          monthly_rate: 650000,
          due_date: '2026-04-20',
          notes: 'Ưu đãi đặc biệt',
        },
        user,
      );

      expect(saved).toHaveBeenCalledTimes(1);
      expect(invoice.roster_entry_id).toBe(roster1Id);
      expect(invoice.member_name).toBe('Nguyễn Văn A');
      expect(invoice.room_code).toBe('P101');
      expect(invoice.room_type).toBe('Thường');
      expect(invoice.start_month).toBe('2026-03');
      expect(invoice.end_month).toBe('2026-08');
      expect(invoice.months_count).toBe(6);
      expect(invoice.monthly_rate).toBe(650000);
      expect(invoice.total_amount).toBe(3900000);
      expect(invoice.status).toBe('Chưa thu');
      expect(invoice.created_by_id).toBe('user-admin-1');

      // Verify global RoomFeeConfig was NOT updated or saved
      expect(roomFeeConfigModel.prototype?.save).toBeUndefined();
    });

    it('throws ConflictException if an invoice for the period already exists in pre-check', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      roomFeeInvoiceModel.findOne = jest.fn(() =>
        query({ _id: 'rfi-existing', invoice_code: 'RFI-EXIST-01' }),
      );

      await expect(
        service.createIndividual(
          {
            roster_entry_id: roster1Id,
            start_month: '2026-03',
            months_count: 5,
            monthly_rate: 500000,
          },
          { userId: 'u1' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on Mongo E11000 duplicate key error', async () => {
      const { service, roomFeeInvoiceModel } = setup();
      roomFeeInvoiceModel.mockImplementation((value: any) => ({
        ...value,
        save: jest.fn().mockImplementation(async () => {
          const err: any = new Error('E11000 duplicate key error');
          err.code = 11000;
          throw err;
        }),
      }));

      await expect(
        service.createIndividual(
          {
            roster_entry_id: roster1Id,
            start_month: '2026-03',
            months_count: 5,
            monthly_rate: 500000,
          },
          { userId: 'u1' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when roster entry is missing', async () => {
      const { service, rosterModel } = setup();
      rosterModel.findById = jest.fn(() => query(null));

      await expect(
        service.createIndividual(
          {
            roster_entry_id: '507f1f77bcf86cd799439099',
            start_month: '2026-03',
            months_count: 5,
            monthly_rate: 500000,
          },
          { userId: 'u1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
