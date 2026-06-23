import { Test, TestingModule } from '@nestjs/testing';
import { SummariesPointController } from '../summaries-point.controller';
import { SummariesPointService } from '../summaries-point.service';
import * as express from 'express';

describe('SummariesPointController', () => {
  let controller: SummariesPointController;
  let service: SummariesPointService;

  const mockSummariesPointService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    approveGrading: jest.fn(),
    cancelApproval: jest.fn(),
    cancelApprovalBulk: jest.fn(),
    findLatestForStudent: jest.fn(),
    generateSummaryExcel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SummariesPointController],
      providers: [
        {
          provide: SummariesPointService,
          useValue: mockSummariesPointService,
        },
      ],
    }).compile();

    controller = module.get<SummariesPointController>(SummariesPointController);
    service = module.get<SummariesPointService>(SummariesPointService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('exportSummaryExcel', () => {
    it('should return excel buffer and set headers correctly', async () => {
      const mockReq = { user: { userId: 'teacher1', roleName: 'Teacher' } };
      const exportDto = { semesterId: 'sem1', classId: 'class1', mode: 'all_filtered' as const };
      const mockBuffer = Buffer.from('mock excel data');
      const filename = 'PL03_mock.xlsx';
      
      mockSummariesPointService.generateSummaryExcel.mockResolvedValue({
        buffer: mockBuffer,
        filename,
      });

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as express.Response;

      await controller.exportSummaryExcel(exportDto, mockReq, mockRes);

      expect(service.generateSummaryExcel).toHaveBeenCalledWith(exportDto, mockReq.user);
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': mockBuffer.length.toString(),
      });
      expect(mockRes.end).toHaveBeenCalledWith(mockBuffer);
    });

    it('should return 500 if service throws error', async () => {
      const mockReq = { user: { userId: 'teacher1', roleName: 'Teacher' } };
      const exportDto = { semesterId: 'sem1', classId: 'class1', mode: 'all_filtered' as const };
      
      mockSummariesPointService.generateSummaryExcel.mockRejectedValue(new Error('Test error'));

      const mockRes = {
        set: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as express.Response;

      await controller.exportSummaryExcel(exportDto, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ statusCode: 500, message: 'Test error' });
    });
  });

  describe('approve', () => {
    it('should call approveGrading on service', async () => {
      const mockReq = { user: { userId: 'admin1', roleName: 'Admin' } };
      mockSummariesPointService.approveGrading.mockResolvedValue({ status: 'locked', rank_tier: 'diamond' });

      const result = await controller.approve('summary1', mockReq);
      
      expect(service.approveGrading).toHaveBeenCalledWith('summary1', mockReq.user);
      expect(result).toEqual({ status: 'locked', rank_tier: 'diamond' });
    });
  });

  describe('finalize', () => {
    it('should call approveGrading on service as alias', async () => {
      const mockReq = { user: { userId: 'admin1', roleName: 'Admin' } };
      mockSummariesPointService.approveGrading.mockResolvedValue({ status: 'locked', rank_tier: 'diamond' });

      const result = await controller.finalize('summary1', mockReq);
      
      expect(service.approveGrading).toHaveBeenCalledWith('summary1', mockReq.user);
      expect(result).toEqual({ status: 'locked', rank_tier: 'diamond' });
    });
  });

  describe('cancelApproval', () => {
    it('should call cancelApproval on service', async () => {
      const mockReq = { user: { userId: 'admin1', roleName: 'Admin' } };
      mockSummariesPointService.cancelApproval.mockResolvedValue({ status: 'draft', rank_tier: null });

      const result = await controller.cancelApproval('summary1', mockReq);
      
      expect(service.cancelApproval).toHaveBeenCalledWith('summary1', mockReq.user);
      expect(result).toEqual({ status: 'draft', rank_tier: null });
    });
  });

  describe('cancelApprovalBulk', () => {
    it('should call cancelApprovalBulk on service', async () => {
      const mockReq = { user: { userId: 'admin1', roleName: 'Admin' } };
      const body = { summaryIds: ['summary1', 'summary2'] };
      mockSummariesPointService.cancelApprovalBulk.mockResolvedValue([
        { summaryId: 'summary1', success: true },
        { summaryId: 'summary2', success: true }
      ]);

      const result = await controller.cancelApprovalBulk(body, mockReq);
      
      expect(service.cancelApprovalBulk).toHaveBeenCalledWith(['summary1', 'summary2'], mockReq.user);
      expect(result).toEqual([
        { summaryId: 'summary1', success: true },
        { summaryId: 'summary2', success: true }
      ]);
    });
  });

  describe('getLatest', () => {
    it('should call findLatestForStudent on service', async () => {
      const mockReq = { user: { userId: 'user1' } };
      mockSummariesPointService.findLatestForStudent.mockResolvedValue({
        status: 'locked',
        rank_tier: 'gold'
      });

      const result = await controller.getLatest(mockReq, 'sem1', 'period1');
      
      expect(service.findLatestForStudent).toHaveBeenCalledWith('user1', 'sem1', 'period1');
      expect(result).toEqual({ status: 'locked', rank_tier: 'gold' });
    });
  });
});
