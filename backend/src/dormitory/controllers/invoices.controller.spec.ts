import { BadRequestException } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateUtilityConfigDto } from '../dto/utility-config.dto';
import { ReviewPaymentProofDto } from '../dto/create-invoice.dto';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: any;
  let realtimeService: any;

  beforeEach(() => {
    service = {
      getUtilityConfig: jest.fn().mockResolvedValue({
        electricity: { quota_per_person: 15, unit_price: 2500, unit: 'kWh' },
        water: { quota_per_person: 4, unit_price: 10000, unit: 'm³' },
        configured_collection_days: 10,
      }),
      updateUtilityConfig: jest.fn().mockResolvedValue({
        electricity: { quota_per_person: 20, unit_price: 3000, unit: 'kWh' },
        water: { quota_per_person: 5, unit_price: 12000, unit: 'm³' },
        configured_collection_days: 15,
      }),
      getMeterReadings: jest.fn().mockResolvedValue({
        config: {},
        billing_month: '2026-03',
        rooms: [],
      }),
      saveBulkMeterReadings: jest.fn().mockResolvedValue({
        results: [{ room_id: 'r-1', success: true }],
      }),
      createMonthly: jest.fn().mockResolvedValue({ _id: 'inv-1', invoice_code: 'INV-1' }),
      updateMonthly: jest.fn().mockResolvedValue({ _id: 'inv-1', invoice_code: 'INV-1' }),
      getRoomInfo: jest.fn().mockResolvedValue({ occupant_count: 2, last_readings: { electricity: 100, water: 20 } }),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      findOne: jest.fn().mockResolvedValue({ _id: 'inv-1' }),
      pay: jest.fn().mockResolvedValue({ _id: 'inv-1', status: 'Đã thu' }),
      getOverdueSummary: jest.fn().mockResolvedValue({ total_overdue: 0, total_amount: 0 }),
      bulkDelete: jest.fn().mockResolvedValue({
        requested: 2,
        deleted: ['inv-1'],
        not_found: [],
        rejected: [{ id: 'inv-2', reason: 'Không thể xóa hóa đơn đã thanh toán' }],
      }),
    };

    realtimeService = {
      getStream: jest.fn().mockReturnValue('mock-stream'),
    };

    controller = new InvoicesController(service, realtimeService);
  });

  it('getUtilityConfig delegates to service.getUtilityConfig (AC-01)', async () => {
    const result = await controller.getUtilityConfig();
    expect(service.getUtilityConfig).toHaveBeenCalled();
    expect(result.electricity.unit_price).toBe(2500);
  });

  it('updateUtilityConfig delegates to service.updateUtilityConfig (AC-01)', async () => {
    const dto: any = {
      electricity: { quota_per_person: 20, unit_price: 3000, unit: 'kWh' },
      water: { quota_per_person: 5, unit_price: 12000, unit: 'm³' },
      configured_collection_days: 15,
    };
    const req = { user: { userId: 'admin-1' } };

    const result = await controller.updateUtilityConfig(dto, req);
    expect(service.updateUtilityConfig).toHaveBeenCalledWith(dto, req.user);
    expect(result.configured_collection_days).toBe(15);
  });

  it('validates UpdateUtilityConfigDto with room_quota_overrides and room_unit_price_overrides', async () => {
    const validDto = plainToInstance(UpdateUtilityConfigDto, {
      electricity: {
        quota_per_person: 20,
        unit_price: 3000,
        room_quota_overrides: [{ room_id: '507f1f77bcf86cd799439011', quota_per_person: 25 }],
        room_unit_price_overrides: [{ room_id: '507f1f77bcf86cd799439011', unit_price: 3500 }],
      },
      water: {
        quota_per_person: 5,
        unit_price: 12000,
        room_quota_overrides: [{ room_id: '507f1f77bcf86cd799439011', quota_per_person: 6 }],
        room_unit_price_overrides: [{ room_id: '507f1f77bcf86cd799439011', unit_price: 15000 }],
      },
      payment_deadline: '2026-04-10',
    });
    const errors = await validate(validDto);
    expect(errors.length).toBe(0);

    const invalidDto = plainToInstance(UpdateUtilityConfigDto, {
      electricity: {
        quota_per_person: 20,
        unit_price: 3000,
        room_quota_overrides: [{ room_id: '', quota_per_person: -1 }],
        room_unit_price_overrides: [{ room_id: '', unit_price: -100 }],
      },
      water: { quota_per_person: 5, unit_price: 12000 },
      payment_deadline: '2026-04-10',
    });
    const invalidErrors = await validate(invalidDto);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });

  it('rejects QR metadata that did not come from the dedicated image upload convention', async () => {
    const dto = plainToInstance(UpdateUtilityConfigDto, {
      electricity: { quota_per_person: 20, unit_price: 3000 },
      water: { quota_per_person: 5, unit_price: 12000 },
      configured_collection_days: 15,
      transfer_qr_image: { url: 'https://evil.example/qr.svg', mime_type: 'image/svg+xml', size: 6 * 1024 * 1024 },
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'transfer_qr_image')).toBe(true);
  });

  it('getMeterReadings delegates to service.getMeterReadings (AC-02)', async () => {
    const result = await controller.getMeterReadings('2026-03');
    expect(service.getMeterReadings).toHaveBeenCalledWith('2026-03');
    expect(result.billing_month).toBe('2026-03');
  });

  it('saveBulkMeterReadings delegates to service.saveBulkMeterReadings (AC-04, AC-06)', async () => {
    const dto: any = {
      billing_month: '2026-03',
      readings: [{ room_id: 'r-1', electricity_reading: 100, water_reading: 20 }],
    };
    const req = { user: { userId: 'admin-1' } };

    const result = await controller.saveBulkMeterReadings(dto, req);
    expect(service.saveBulkMeterReadings).toHaveBeenCalledWith(dto, req.user);
    expect(result.results.length).toBe(1);
  });

  it('createMonthly delegates to service.createMonthly', async () => {
    const dto: any = { room_id: 'r-1', billing_month: '2026-03' };
    const req = { user: { userId: 'u-1' } };

    const result = await controller.createMonthly(dto, req);
    expect(service.createMonthly).toHaveBeenCalledWith(dto, req.user);
    expect(result._id).toBe('inv-1');
  });

  it('updateMonthly delegates to service.updateMonthly', async () => {
    const dto: any = { notes: 'Updated notes' };
    const req = { user: { userId: 'u-1' } };

    const result = await controller.updateMonthly('inv-1', dto, req);
    expect(service.updateMonthly).toHaveBeenCalledWith('inv-1', dto, req.user);
    expect(result._id).toBe('inv-1');
  });

  it('getRoomInfo delegates to service.getRoomInfo', async () => {
    const result = await controller.getRoomInfo('r-1', '2026-03');
    expect(service.getRoomInfo).toHaveBeenCalledWith('r-1', '2026-03');
    expect(result.occupant_count).toBe(2);
  });

  it('uploadProof returns file metadata for valid file (AC-07)', () => {
    const mockFile: any = {
      filename: 'invoice-proof-123.png',
      mimetype: 'image/png',
      size: 102400,
    };

    const result = controller.uploadProof(mockFile);
    expect(result.url).toBe('/uploads/invoice-proof-123.png');
    expect(result.file_name).toBe('invoice-proof-123.png');
    expect(result.mime_type).toBe('image/png');
    expect(result.size).toBe(102400);
  });

  it('uploadProof throws BadRequestException if file is missing', () => {
    expect(() => controller.uploadProof(undefined as any)).toThrow(BadRequestException);
  });

  it('uploadTransferQr returns persistent image metadata', () => {
    const result = controller.uploadTransferQr({ filename: 'invoice-transfer-qr-1.webp', mimetype: 'image/webp', size: 2048 } as any);
    expect(result).toEqual({ url: '/uploads/invoice-transfer-qr-1.webp', file_name: 'invoice-transfer-qr-1.webp', mime_type: 'image/webp', size: 2048 });
  });

  it('uploadTransferQr rejects a missing file', () => {
    expect(() => controller.uploadTransferQr(undefined as any)).toThrow(BadRequestException);
  });

  it('pay delegates to service.pay (AC-07, AC-08)', async () => {
    const dto: any = { payment_method: 'Chuyển khoản' };
    const req = { user: { userId: 'u-1' } };

    const result = await controller.pay('inv-1', dto, req);
    expect(service.pay).toHaveBeenCalledWith('inv-1', dto, req.user);
    expect(result.status).toBe('Đã thu');
  });

  it('updateProof delegates to service.updatePaymentProof', async () => {
    service.updatePaymentProof = jest.fn().mockResolvedValue({ _id: 'inv-1', status: 'Đã thu' });
    const dto: any = { notes: 'Updated notes' };
    const req = { user: { userId: 'u-1' } };

    const result = await controller.updateProof('inv-1', dto, req);
    expect(service.updatePaymentProof).toHaveBeenCalledWith('inv-1', dto, req.user);
    expect(result.status).toBe('Đã thu');
  });

  it('reviewProof delegates to service.reviewPaymentProof', async () => {
    service.reviewPaymentProof = jest.fn().mockResolvedValue({ _id: 'inv-1', status: 'Đã thu' });
    const dto: any = { decision: 'approved', request_id: 'review-1' };
    const req = { user: { userId: 'u-1' } };

    const result = await controller.reviewProof('inv-1', dto, req);
    expect(service.reviewPaymentProof).toHaveBeenCalledWith('inv-1', 'approved', req.user, 'review-1');
    expect(result.status).toBe('Đã thu');
  });

  it('requires a bounded UUID review request id', async () => {
    const invalid = plainToInstance(ReviewPaymentProofDto, { decision: 'rejected', request_id: 'retry-key-without-bounds' });
    const valid = plainToInstance(ReviewPaymentProofDto, { decision: 'rejected', request_id: '4b594a18-5144-4cb8-b40f-5dff436b698c' });
    expect((await validate(invalid)).some((error) => error.property === 'request_id')).toBe(true);
    expect(await validate(valid)).toEqual([]);
  });

  it('bulkDelete delegates to service.bulkDelete', async () => {
    const dto = { ids: ['inv-1', 'inv-2'] };
    const req = { user: { userId: 'admin-1' } };

    const expectedResult = {
      requested: 2,
      deleted: ['inv-1'],
      not_found: [],
      rejected: [{ id: 'inv-2', reason: 'Không thể xóa hóa đơn đã thanh toán' }],
    };
    service.bulkDelete = jest.fn().mockResolvedValue(expectedResult);

    const result = await controller.bulkDelete(dto, req);
    expect(service.bulkDelete).toHaveBeenCalledWith(dto.ids, req.user);
    expect(result).toEqual(expectedResult);
  });

  it('realtime delegates to realtimeService.getStream', () => {
    const req = { user: { userId: 'u-1' } };
    const stream = controller.realtime('utility', req);
    expect(realtimeService.getStream).toHaveBeenCalledWith(req.user, 'utility');
    expect(stream).toBe('mock-stream');
  });
});
