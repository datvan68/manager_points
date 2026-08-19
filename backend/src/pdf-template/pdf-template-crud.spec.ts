import { ConflictException, NotFoundException } from '@nestjs/common';
import { Binary } from 'bson';
import { createDefaultDormitoryLayout, DORMITORY_ROSTER_APPLICATION_DESCRIPTOR } from '../dormitory/pdf-template-adapter';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';
import { PdfTemplateRendererService } from './pdf-template-renderer.service';
import { PdfTemplateRegistry } from './registry';
import { PdfTemplateService, normalizePersistedPdfSource } from './pdf-template.service';

function query(value: unknown) {
  const result = { lean: () => ({ exec: async () => value }), select: () => result };
  return result;
}

describe('normalizePersistedPdfSource', () => {
  const pdfBytes = Buffer.from('%PDF-1.4 test template content');

  it('normalizes Node Buffer without mutation', () => {
    const result = normalizePersistedPdfSource(pdfBytes);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.equals(pdfBytes)).toBe(true);
  });

  it('normalizes BSON Binary to identical Buffer bytes', () => {
    const bsonBinary = new Binary(pdfBytes);
    const result = normalizePersistedPdfSource(bsonBinary);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.equals(pdfBytes)).toBe(true);
    expect(result.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('normalizes Uint8Array and ArrayBuffer to identical Buffer bytes', () => {
    const uint8 = new Uint8Array(pdfBytes);
    expect(normalizePersistedPdfSource(uint8).equals(pdfBytes)).toBe(true);

    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    expect(normalizePersistedPdfSource(arrayBuffer).equals(pdfBytes)).toBe(true);
  });

  it('normalizes JSON Buffer format to identical Buffer bytes', () => {
    const jsonBuffer = JSON.parse(JSON.stringify(pdfBytes));
    expect(normalizePersistedPdfSource(jsonBuffer).equals(pdfBytes)).toBe(true);
  });

  it('throws NotFoundException for missing, empty, or unsupported values', () => {
    expect(() => normalizePersistedPdfSource(null)).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource(undefined)).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource(Buffer.alloc(0))).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource(new Binary(Buffer.alloc(0)))).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource(new Uint8Array(0))).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource({})).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource('not-a-valid-buffer')).toThrow(NotFoundException);
    expect(() => normalizePersistedPdfSource(12345)).toThrow(NotFoundException);
  });
});

describe('PdfTemplateService aggregate CRUD', () => {
  const pages = [{ pageIndex: 0, width: 595.32, height: 842.04, rotation: 0 }];
  const layout = createDefaultDormitoryLayout(pages);
  const pdfBytes = Buffer.from('%PDF-1.4 test template content');
  const source = { buffer: pdfBytes, originalname: 'template.pdf', mimetype: 'application/pdf' };
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
    const renderer = { render: jest.fn(async (buf: Buffer) => ({ buffer: buf, pageCount: 1, warnings: [] })) } as unknown as PdfTemplateRendererService;
    const service = new PdfTemplateService(model, registry, intake, renderer);
    return { model, service, intake, renderer };
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

  it('downloads source successfully when persisted as BSON Binary or Buffer', async () => {
    const fromBson = setup({ version: 1, sourcePdf: new Binary(pdfBytes), sourceFilename: 'roster.pdf', sourceChecksum: 'chk-bson' });
    const bsonResult = await fromBson.service.source('DORMITORY_ROSTER_APPLICATION');
    expect(bsonResult).not.toBeNull();
    expect(bsonResult!.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(bsonResult!.buffer.equals(pdfBytes)).toBe(true);
    expect(bsonResult!.filename).toBe('roster.pdf');

    const fromBuffer = setup({ version: 1, sourcePdf: pdfBytes, sourceFilename: 'roster.pdf', sourceChecksum: 'chk-buf' });
    const bufResult = await fromBuffer.service.source('DORMITORY_ROSTER_APPLICATION');
    expect(bufResult!.buffer.equals(bsonResult!.buffer)).toBe(true);

    const missing = setup(null);
    expect(await missing.service.source('DORMITORY_ROSTER_APPLICATION')).toBeNull();

    const emptyStored = setup({ version: 1, sourcePdf: new Binary(Buffer.alloc(0)) });
    await expect(emptyStored.service.source('DORMITORY_ROSTER_APPLICATION')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates, updates, previews, and renders when sourcePdf is persisted as BSON Binary', async () => {
    const currentData = {
      version: 1,
      sourcePdf: new Binary(pdfBytes),
      sourceFilename: 'stored.pdf',
      sourceChecksum: 'chk-stored',
      pages,
      layout,
    };
    const { service, renderer } = setup(currentData);

    // Sourceless validate
    const validatedResult = await service.validate('DORMITORY_ROSTER_APPLICATION', layout);
    expect(validatedResult.sourceChecksum).toBe('chk-stored');
    expect(validatedResult.layout).toBeDefined();

    // Sourceless update
    const updateResult = await service.update('DORMITORY_ROSTER_APPLICATION', { version: 1, layout });
    expect(updateResult.version).toBe(2);

    // Sourceless preview
    await service.preview('DORMITORY_ROSTER_APPLICATION', layout, 'short');
    expect(renderer.render).toHaveBeenCalledWith(expect.any(Buffer), expect.any(Object), expect.any(Object));

    // renderSynthetic
    await service.renderSynthetic('DORMITORY_ROSTER_APPLICATION', 'short');
    expect(renderer.render).toHaveBeenCalled();

    // renderCurrent
    const currentRender = await service.renderCurrent('DORMITORY_ROSTER_APPLICATION', { 'student.fullName': 'Test' });
    expect(currentRender).toBeDefined();
  });
});
