import { ConflictException, NotFoundException } from '@nestjs/common';
import { createDefaultDormitoryLayout, DORMITORY_ROSTER_APPLICATION_DESCRIPTOR } from '../dormitory/pdf-template-adapter';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';
import { PdfTemplateRendererService } from './pdf-template-renderer.service';
import { PdfTemplateRegistry } from './registry';
import { PdfTemplateService } from './pdf-template.service';

function query(value: unknown) {
  const result = { lean: () => ({ exec: async () => value }), select: () => result };
  return result;
}

describe('PdfTemplateService aggregate CRUD', () => {
  const pages = [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }];
  const layout = createDefaultDormitoryLayout(pages);
  const source = { buffer: Buffer.from('%PDF-test'), originalname: 'template.pdf', mimetype: 'application/pdf' };
  const validated = { ...source, filename: 'template.pdf', mimeType: 'application/pdf' as const, checksum: 'checksum-1', pages };

  function setup(current: any = null) {
    const model: any = {
      findOne: jest.fn(() => query(current)),
      create: jest.fn(async (value) => ({ toObject: () => value })),
      findOneAndUpdate: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => ({ ...current, version: current.version + 1 }) }) }) })),
      deleteOne: jest.fn(() => ({ exec: async () => ({ deletedCount: 1 }) })),
    };
    const registry = new PdfTemplateRegistry([DORMITORY_ROSTER_APPLICATION_DESCRIPTOR]);
    registry.onModuleInit();
    const intake = { validate: jest.fn(async () => validated) } as unknown as PdfTemplateIntakeService;
    const service = new PdfTemplateService(model, registry, intake, new PdfTemplateRendererService());
    return { model, service };
  }

  it('creates only when the collection is unconfigured', async () => {
    const { model, service } = setup();
    const result = await service.create('DORMITORY_ROSTER_APPLICATION', { layout, source });
    expect(result.version).toBe(1);
    expect(model.create).toHaveBeenCalledTimes(1);

    const configured = setup({ version: 1 });
    await expect(configured.service.create('DORMITORY_ROSTER_APPLICATION', { layout, source })).rejects.toBeInstanceOf(ConflictException);
    expect(configured.model.create).not.toHaveBeenCalled();
  });

  it('updates only an existing aggregate and rejects stale versions', async () => {
    const missing = setup();
    await expect(missing.service.update('DORMITORY_ROSTER_APPLICATION', { version: 0, layout, source })).rejects.toBeInstanceOf(NotFoundException);

    const current = setup({ version: 2, sourcePdf: Buffer.from('%PDF-test'), sourceFilename: 'old.pdf', sourceChecksum: 'old' });
    await expect(current.service.update('DORMITORY_ROSTER_APPLICATION', { version: 1, layout, source })).rejects.toBeInstanceOf(ConflictException);
    expect(current.model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('deletes exactly one aggregate with the current version', async () => {
    const stale = setup({ version: 3, sourceChecksum: 'checksum-3' });
    await expect(stale.service.delete('DORMITORY_ROSTER_APPLICATION', 2, { userId: 'operator-1' })).rejects.toBeInstanceOf(ConflictException);
    expect(stale.model.deleteOne).not.toHaveBeenCalled();

    const current = setup({ version: 3, sourceChecksum: 'checksum-3' });
    await expect(current.service.delete('DORMITORY_ROSTER_APPLICATION', 3, { userId: 'operator-1' })).resolves.toEqual({ deleted: true, templateTypeCode: 'DORMITORY_ROSTER_APPLICATION', version: 3 });
    expect(current.model.deleteOne).toHaveBeenCalledWith({ templateTypeCode: 'DORMITORY_ROSTER_APPLICATION', active: true, version: 3 });
  });
});
