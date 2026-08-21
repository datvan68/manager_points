import { BadRequestException } from '@nestjs/common';
import { RoomFeeInvoicesController } from './room-fee-invoices.controller';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateRoomFeeConfigDto,
  PreviewRoomFeePeriodDto,
  CreateRoomFeePeriodDto,
  ReviewRoomFeeProofDto,
  BulkReviewRoomFeeProofDto,
} from '../dto/room-fee-invoice.dto';

describe('RoomFeeInvoicesController', () => {
  let controller: RoomFeeInvoicesController;
  let service: any;

  beforeEach(() => {
    service = {
      getConfig: jest.fn().mockResolvedValue({
        standard_monthly_rate: 500000,
        air_conditioned_monthly_rate: 700000,
        months_to_collect: 5,
      }),
      updateConfig: jest.fn().mockResolvedValue({
        standard_monthly_rate: 600000,
        air_conditioned_monthly_rate: 800000,
        months_to_collect: 6,
      }),
      previewPeriod: jest.fn().mockResolvedValue({
        start_month: '2026-03',
        end_month: '2026-07',
        months_count: 5,
        eligible_count: 10,
        expected_total_amount: 50000000,
      }),
      createPeriod: jest.fn().mockResolvedValue({
        created_count: 10,
        skipped_count: 0,
        invalid_count: 0,
        total_amount: 50000000,
      }),
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      findOne: jest.fn().mockResolvedValue({ _id: 'rfi-1' }),
      pay: jest.fn().mockResolvedValue({ _id: 'rfi-1', status: 'Đã thu' }),
      updatePaymentProof: jest.fn().mockResolvedValue({ _id: 'rfi-1' }),
      reviewPaymentProof: jest.fn().mockResolvedValue({ _id: 'rfi-1' }),
      bulkReviewPaymentProof: jest.fn().mockResolvedValue({
        requested: 1,
        results: [{ id: 'rfi-1', outcome: 'approved' }],
      }),
      bulkDelete: jest.fn().mockResolvedValue({
        requested: 1,
        deleted: ['rfi-1'],
        not_found: [],
        rejected: [],
      }),
    };

    controller = new RoomFeeInvoicesController(service);
  });

  it('getConfig delegates to service.getConfig', async () => {
    const result = await controller.getConfig();
    expect(service.getConfig).toHaveBeenCalled();
    expect(result.standard_monthly_rate).toBe(500000);
  });

  it('updateConfig delegates to service.updateConfig', async () => {
    const dto: any = {
      standard_monthly_rate: 600000,
      air_conditioned_monthly_rate: 800000,
      months_to_collect: 6,
    };
    const req = { user: { userId: 'admin-1' } };

    const result = await controller.updateConfig(dto, req);
    expect(service.updateConfig).toHaveBeenCalledWith(dto, req.user);
    expect(result.months_to_collect).toBe(6);
  });

  it('previewPeriod delegates to service.previewPeriod', async () => {
    const dto: any = { start_month: '2026-03', months_count: 5 };
    const result = await controller.previewPeriod(dto);
    expect(service.previewPeriod).toHaveBeenCalledWith(dto);
    expect(result.eligible_count).toBe(10);
  });

  it('createPeriod delegates to service.createPeriod', async () => {
    const dto: any = { start_month: '2026-03', months_count: 5 };
    const req = { user: { userId: 'admin-1' } };
    const result = await controller.createPeriod(dto, req);
    expect(service.createPeriod).toHaveBeenCalledWith(dto, req.user);
    expect(result.created_count).toBe(10);
  });

  it('uploadProof returns metadata on valid image', () => {
    const mockFile: any = {
      filename: 'invoice-proof-test.png',
      mimetype: 'image/png',
      size: 10240,
    };
    const result = controller.uploadProof(mockFile);
    expect(result.url).toBe('/uploads/invoice-proof-test.png');
    expect(result.file_name).toBe('invoice-proof-test.png');
  });

  it('uploadProof throws BadRequestException on missing file', () => {
    expect(() => controller.uploadProof(undefined as any)).toThrow(
      BadRequestException,
    );
  });

  it('uploadTransferQr returns metadata on valid image', () => {
    const mockFile: any = {
      filename: 'invoice-transfer-qr-test.webp',
      mimetype: 'image/webp',
      size: 2048,
    };
    const result = controller.uploadTransferQr(mockFile);
    expect(result.url).toBe('/uploads/invoice-transfer-qr-test.webp');
  });

  it('pay delegates to service.pay', async () => {
    const dto: any = { payment_method: 'Tiền mặt' };
    const req = { user: { userId: 'u-1' } };
    const result = await controller.pay('rfi-1', dto, req);
    expect(service.pay).toHaveBeenCalledWith('rfi-1', dto, req.user);
    expect(result.status).toBe('Đã thu');
  });

  it('reviewProof delegates to service.reviewPaymentProof', async () => {
    const dto: any = { decision: 'approved', request_id: 'req-1' };
    const req = { user: { userId: 'admin-1' } };
    await controller.reviewProof('rfi-1', dto, req);
    expect(service.reviewPaymentProof).toHaveBeenCalledWith(
      'rfi-1',
      'approved',
      req.user,
      'req-1',
    );
  });

  describe('DTO Validations', () => {
    it('validates UpdateRoomFeeConfigDto rates cannot be negative', async () => {
      const dto = plainToInstance(UpdateRoomFeeConfigDto, {
        standard_monthly_rate: -100,
        air_conditioned_monthly_rate: 700000,
        months_to_collect: 5,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'standard_monthly_rate')).toBe(
        true,
      );
    });

    it('validates PreviewRoomFeePeriodDto start_month format', async () => {
      const invalidDto = plainToInstance(PreviewRoomFeePeriodDto, {
        start_month: '2026/03',
      });
      const errors = await validate(invalidDto);
      expect(errors.some((e) => e.property === 'start_month')).toBe(true);

      const validDto = plainToInstance(PreviewRoomFeePeriodDto, {
        start_month: '2026-03',
      });
      const validErrors = await validate(validDto);
      expect(validErrors.length).toBe(0);
    });

    it('validates ReviewRoomFeeProofDto decision enum', async () => {
      const invalidDto = plainToInstance(ReviewRoomFeeProofDto, {
        decision: 'invalid_decision' as any,
      });
      const errors = await validate(invalidDto);
      expect(errors.some((e) => e.property === 'decision')).toBe(true);
    });
  });
});
