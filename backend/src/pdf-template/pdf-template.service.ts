import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PdfTemplate, PdfTemplateDocument } from './schemas/pdf-template.schema';
import { PdfTemplateRegistry } from './registry';
import { PdfTemplateIntakeService, ValidatedPdfSource } from './pdf-template-intake.service';
import { PdfTemplateRendererService } from './pdf-template-renderer.service';
import { PdfTemplateLayout, PDF_TEMPLATE_READ, PdfTemplateTypeDescriptor } from './types';
import { validateAndNormalizeLayout } from './layout.validation';

export type PdfTemplateRequester = { userId?: string; _id?: string; permissions?: string[]; roleCode?: string };
export type SavePdfTemplateInput = { version: number; layout: unknown; source?: { buffer: Buffer; originalname?: string; mimetype?: string } };
export type CreatePdfTemplateInput = { layout: unknown; source?: { buffer: Buffer; originalname?: string; mimetype?: string } };
export type PdfTemplateCatalogQuery = { page?: string | number; pageSize?: string | number; search?: string; moduleCode?: string; featureCode?: string; configured?: string; sortBy?: string; sortDirection?: string };

@Injectable()
export class PdfTemplateService {
  constructor(
    @InjectModel(PdfTemplate.name) private readonly model: Model<PdfTemplateDocument>,
    private readonly registry: PdfTemplateRegistry,
    private readonly intake: PdfTemplateIntakeService,
    private readonly renderer: PdfTemplateRendererService,
  ) {}

  private readonly logger = new Logger(PdfTemplateService.name);

  async catalog(query: PdfTemplateCatalogQuery = {}) {
    const saved = await this.model.find({ active: true }).select('templateTypeCode moduleCode featureCode displayName sourceFilename sourceBytes pages sourceChecksum version audit').lean().exec();
    const byCode = new Map(saved.map((item: any) => [item.templateTypeCode, item]));
    const all = this.registry.all().map((descriptor) => {
      const current: any = byCode.get(descriptor.templateTypeCode);
      return {
        moduleCode: descriptor.moduleCode,
        featureCode: descriptor.featureCode,
        templateTypeCode: descriptor.templateTypeCode,
        displayName: descriptor.displayName,
        configured: Boolean(current),
        version: current?.version || 0,
        checksum: current?.sourceChecksum || null,
        sourceFilename: current?.sourceFilename || null,
        pageCount: current?.pages?.length || 0,
        sourceBytes: current?.sourceBytes || 0,
        updatedBy: current?.audit?.updatedBy ? String(current.audit.updatedBy) : null,
        updatedAt: current?.audit?.updatedAt || null,
      };
    }).filter((item) => {
      const search = String(query.search || '').trim().toLowerCase();
      const matchesSearch = !search || [item.displayName, item.templateTypeCode, item.moduleCode, item.featureCode].some((value) => value.toLowerCase().includes(search));
      const matchesModule = !query.moduleCode || query.moduleCode === 'all' || item.moduleCode === query.moduleCode;
      const matchesFeature = !query.featureCode || query.featureCode === 'all' || item.featureCode === query.featureCode;
      const matchesConfigured = !query.configured || query.configured === 'all' || (query.configured === 'true' ? item.configured : !item.configured);
      return matchesSearch && matchesModule && matchesFeature && matchesConfigured;
    });
    const sortBy = ['displayName', 'templateTypeCode', 'moduleCode', 'featureCode', 'updatedAt', 'sourceBytes'].includes(String(query.sortBy)) ? String(query.sortBy) : 'displayName';
    const direction = String(query.sortDirection).toLowerCase() === 'desc' ? -1 : 1;
    all.sort((left: any, right: any) => String(left[sortBy] ?? '').localeCompare(String(right[sortBy] ?? ''), 'vi') * direction);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const page = Math.max(1, Number(query.page) || 1);
    const modules = [...new Set(all.map((item) => item.moduleCode))].sort((left, right) => left.localeCompare(right, 'vi'));
    const features = [...new Set(all.map((item) => item.featureCode))].sort((left, right) => left.localeCompare(right, 'vi'));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize, modules, features };
  }

  async metadata(templateTypeCode: string) {
    const descriptor = this.descriptor(templateTypeCode); const current: any = await this.model.findOne({ templateTypeCode, active: true }).select('-sourcePdf').lean().exec();
    return { moduleCode: descriptor.moduleCode, featureCode: descriptor.featureCode, templateTypeCode, displayName: descriptor.displayName, sourcePermission: descriptor.sourcePermission, fields: descriptor.fields, configured: Boolean(current), version: current?.version || 0, checksum: current?.sourceChecksum || null, sourceChecksum: current?.sourceChecksum || null, sourceFilename: current?.sourceFilename || null, sourceBytes: current?.sourceBytes || 0, pages: current?.pages || null, layout: current?.layout || null, audit: current?.audit ? { updatedBy: current.audit.updatedBy ? String(current.audit.updatedBy) : null, updatedAt: current.audit.updatedAt } : null };
  }

  async source(templateTypeCode: string) { const current: any = await this.model.findOne({ templateTypeCode, active: true }).select('sourcePdf sourceFilename sourceChecksum').lean().exec(); if (!current) return null; return { buffer: Buffer.from(current.sourcePdf), filename: current.sourceFilename, checksum: current.sourceChecksum }; }

  async validate(templateTypeCode: string, layout: unknown, source?: { buffer: Buffer; originalname?: string; mimetype?: string }) {
    const descriptor = this.descriptor(templateTypeCode); const current: any = await this.model.findOne({ templateTypeCode, active: true }).lean().exec();
    const parsed = source ? await this.intake.validate(source.buffer, source.originalname, source.mimetype) : current ? { pages: current.pages, buffer: Buffer.from(current.sourcePdf) } as ValidatedPdfSource : null;
    if (!parsed) throw new NotFoundException('Template chưa có source PDF.');
    const checksum = source ? (parsed as ValidatedPdfSource).checksum : current?.sourceChecksum || null;
    return { layout: validateAndNormalizeLayout(layout, descriptor, parsed.pages), sourceChecksum: checksum };
  }

  async create(templateTypeCode: string, input: CreatePdfTemplateInput, requester?: PdfTemplateRequester) {
    const descriptor = this.descriptor(templateTypeCode);
    const current: any = await this.model.findOne({ templateTypeCode, active: true }).lean().exec();
    if (current) throw new ConflictException({ code: 'PDF_TEMPLATE_ALREADY_CONFIGURED', message: 'Collection đã có template.', currentVersion: current.version });
    const parsed = input.source ? await this.intake.validate(input.source.buffer, input.source.originalname, input.source.mimetype) : null;
    if (!parsed) throw new BadRequestException('Template mới phải có source PDF.');
    const layout = validateAndNormalizeLayout(input.layout, descriptor, parsed.pages); const updatedBy = this.actor(requester);
    const document = { templateTypeCode, moduleCode: descriptor.moduleCode, featureCode: descriptor.featureCode, displayName: descriptor.displayName, sourceMimeType: 'application/pdf', sourceFilename: parsed.filename, sourceChecksum: parsed.checksum, sourceBytes: parsed.buffer.length, sourcePdf: parsed.buffer, pages: parsed.pages, layout, version: 1, active: true, audit: { updatedBy, updatedAt: new Date() }, updatedBy };
    try { return await this.model.create(document).then((result: any) => { const plain = result.toObject ? result.toObject() : result; delete plain.sourcePdf; return plain; }); }
    catch (error: any) { if (error?.code === 11000) throw new ConflictException({ code: 'PDF_TEMPLATE_ALREADY_CONFIGURED', message: 'Collection đã có template.' }); throw error; }
  }

  async update(templateTypeCode: string, input: SavePdfTemplateInput, requester?: PdfTemplateRequester) {
    const descriptor = this.descriptor(templateTypeCode); const current: any = await this.model.findOne({ templateTypeCode, active: true }).lean().exec();
    if (!current) throw new NotFoundException('Template chưa được cấu hình.');
    const expected = current.version; if (!Number.isInteger(input.version) || input.version !== expected) throw new ConflictException({ code: 'PDF_TEMPLATE_VERSION_CONFLICT', message: 'Template đã được thay đổi bởi operator khác.', currentVersion: expected });
    const parsed = input.source ? await this.intake.validate(input.source.buffer, input.source.originalname, input.source.mimetype) : current ? { buffer: Buffer.from(current.sourcePdf), filename: current.sourceFilename, checksum: current.sourceChecksum, pages: current.pages } as ValidatedPdfSource : null;
    if (!parsed) throw new NotFoundException('Template mới phải có source PDF.');
    const layout = validateAndNormalizeLayout(input.layout, descriptor, parsed.pages); const version = expected + 1; const updatedBy = this.actor(requester);
    const update = { moduleCode: descriptor.moduleCode, featureCode: descriptor.featureCode, displayName: descriptor.displayName, sourceMimeType: 'application/pdf', sourceFilename: parsed.filename, sourceChecksum: parsed.checksum, sourceBytes: parsed.buffer.length, sourcePdf: parsed.buffer, pages: parsed.pages, layout, version, active: true, audit: { updatedBy, updatedAt: new Date() }, updatedBy };
    const query: any = { templateTypeCode, active: true, version: expected };
    let result: any;
    try {
      result = await this.model.findOneAndUpdate(query, { $set: update }, { new: true, upsert: false, runValidators: true }).select('-sourcePdf').lean().exec();
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException({ code: 'PDF_TEMPLATE_VERSION_CONFLICT', message: 'Template đã được thay đổi bởi operator khác.', currentVersion: expected });
      throw error;
    }
    if (!result) throw new ConflictException({ code: 'PDF_TEMPLATE_VERSION_CONFLICT', message: 'Template đã được thay đổi bởi operator khác.', currentVersion: expected });
    return result;
  }

  /** Compatibility wrapper for callers that still use the pre-contract name. */
  async save(templateTypeCode: string, input: SavePdfTemplateInput, requester?: PdfTemplateRequester) {
    return this.update(templateTypeCode, input, requester);
  }

  async delete(templateTypeCode: string, version: number, requester?: PdfTemplateRequester) {
    this.descriptor(templateTypeCode);
    if (!Number.isInteger(version) || version < 1) throw new BadRequestException('Cần version hiện tại để xóa template.');
    const current: any = await this.model.findOne({ templateTypeCode, active: true }).select('version sourceChecksum').lean().exec();
    if (!current) throw new NotFoundException('Template chưa được cấu hình.');
    if (current.version !== version) throw new ConflictException({ code: 'PDF_TEMPLATE_VERSION_CONFLICT', message: 'Template đã được thay đổi bởi operator khác.', currentVersion: current.version });
    const result: any = await this.model.deleteOne({ templateTypeCode, active: true, version }).exec();
    if (!result.deletedCount) throw new ConflictException({ code: 'PDF_TEMPLATE_VERSION_CONFLICT', message: 'Template đã được thay đổi bởi operator khác.', currentVersion: version });
    const actor = requester?.userId || requester?._id || 'unknown';
    this.logger.log(JSON.stringify({ event: 'pdf_template.deleted', templateTypeCode, actor, version, checksum: current.sourceChecksum, at: new Date().toISOString() }));
    return { deleted: true, templateTypeCode, version };
  }

  async renderSynthetic(templateTypeCode: string, fixture: 'short' | 'long' | 'missing' | 'vietnamese' = 'short') { const descriptor = this.descriptor(templateTypeCode); const current: any = await this.model.findOne({ templateTypeCode, active: true }).lean().exec(); if (!current) throw new NotFoundException('Template chưa được cấu hình.'); return this.renderer.render(Buffer.from(current.sourcePdf), current.layout, descriptor.syntheticFixture(this.fixture(fixture)).values); }

  async preview(templateTypeCode: string, layoutInput: unknown, fixture: 'short' | 'long' | 'missing' | 'vietnamese', source?: { buffer: Buffer; originalname?: string; mimetype?: string }) {
    const descriptor = this.descriptor(templateTypeCode); const current: any = await this.model.findOne({ templateTypeCode, active: true }).lean().exec();
    const parsed = source ? await this.intake.validate(source.buffer, source.originalname, source.mimetype) : current ? { buffer: Buffer.from(current.sourcePdf), pages: current.pages } as ValidatedPdfSource : null;
    if (!parsed) throw new NotFoundException('Template chưa có source PDF.');
    const layout = validateAndNormalizeLayout(layoutInput, descriptor, parsed.pages);
    return this.renderer.render(parsed.buffer, layout, descriptor.syntheticFixture(this.fixture(fixture)).values);
  }

  async renderCurrent(templateTypeCode: string, values: Record<string, unknown>) { const current: any = await this.model.findOne({ templateTypeCode, active: true }).lean().exec(); if (!current) return null; return this.renderer.render(Buffer.from(current.sourcePdf), current.layout, values); }

  async renderCurrentFromContext(templateTypeCode: string, context: unknown) {
    const descriptor = this.descriptor(templateTypeCode);
    const values = descriptor.resolveValues ? await descriptor.resolveValues(context) : {};
    return this.renderCurrent(templateTypeCode, values);
  }

  async renderFallback(templateTypeCode: string, sourcePdf: Buffer, layout: PdfTemplateLayout, values: Record<string, unknown>) {
    const descriptor = this.descriptor(templateTypeCode);
    const parsed = await this.intake.validate(sourcePdf, 'bundled-template.pdf', 'application/pdf');
    const normalized = validateAndNormalizeLayout(layout, descriptor, parsed.pages);
    return this.renderer.render(parsed.buffer, normalized, values);
  }

  descriptor(code: string): PdfTemplateTypeDescriptor { try { return this.registry.get(code); } catch { throw new NotFoundException('Template type không được hỗ trợ.'); } }
  private fixture(value: string): 'short' | 'long' | 'missing' | 'vietnamese' { if (value === 'short' || value === 'long' || value === 'missing' || value === 'vietnamese') return value; throw new BadRequestException('Fixture synthetic không được hỗ trợ.'); }
  private actor(requester?: PdfTemplateRequester) { const value = requester?.userId || requester?._id; return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null; }
  assertSourcePermission(templateTypeCode: string, requester?: PdfTemplateRequester) { const descriptor = this.descriptor(templateTypeCode); const role = String(requester?.roleCode || '').toUpperCase(); if (role === 'ADMIN' || requester?.permissions?.includes('ADMIN_FULL') || requester?.permissions?.includes(descriptor.sourcePermission)) return; throw new ForbiddenException(`Cần quyền ${descriptor.sourcePermission}.`); }
}
