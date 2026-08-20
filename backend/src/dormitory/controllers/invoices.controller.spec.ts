import { BadRequestException } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: any;

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
    };

    controller = new InvoicesController(service);
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

  it('pay delegates to service.pay (AC-07, AC-08)', async () => {
    const dto: any = { payment_method: 'Chuyển khoản' };
    const req = { user: { userId: 'u-1' } };

    const result = await controller.pay('inv-1', dto, req);
    expect(service.pay).toHaveBeenCalledWith('inv-1', dto, req.user);
    expect(result.status).toBe('Đã thu');
  });
});
