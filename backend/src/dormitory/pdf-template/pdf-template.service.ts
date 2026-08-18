import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';
import { CreatePdfTemplateDraftInput } from './types';
import { DEFAULT_PDF_TEMPLATE_LAYOUT, PDF_TEMPLATE_CODE, PDF_TEMPLATE_FIELD_CATALOG, PdfTemplateLayout, resolveRosterPdfValues } from './field-catalog';
import { validateAndNormalizeLayout } from './layout.validation';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';
import { PdfTemplateRendererService } from './pdf-template-renderer.service';
import { DormitoryPdfTemplate, DormitoryPdfTemplateDocument } from './schemas/dormitory-pdf-template.schema';
import { DormitoryPdfTemplateRevision, DormitoryPdfTemplateRevisionDocument } from './schemas/dormitory-pdf-template-revision.schema';

export type PdfTemplateRequester = { userId?: string; _id?: string; permissions?: string[]; roleCode?: string };

@Injectable()
export class PdfTemplateService {
  constructor(
    @InjectModel(DormitoryPdfTemplate.name) private readonly templateModel: Model<DormitoryPdfTemplateDocument>,
    @InjectModel(DormitoryPdfTemplateRevision.name) private readonly revisionModel: Model<DormitoryPdfTemplateRevisionDocument>,
    @InjectModel(DormitoryRosterEntry.name) private readonly rosterModel: Model<DormitoryRosterEntryDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    private readonly intake: PdfTemplateIntakeService,
    private readonly renderer: PdfTemplateRendererService,
  ) {}

  async list() {
    const templates: any[] = await this.templateModel.find({}).sort({ template_code: 1 }).lean().exec();
    return templates.map((template) => this.metadata(template));
  }

  async get(templateCode: string = PDF_TEMPLATE_CODE) {
    this.assertCode(templateCode);
    const template: any = await this.templateModel.findOne({ template_code: templateCode }).lean().exec();
    if (!template) return this.fallbackMetadata();
    const active: any = template.active_revision_id
      ? await this.revisionModel.findById(template.active_revision_id).lean().exec()
      : null;
    return { ...this.metadata(template), activeRevision: active ? this.revisionMetadata(active) : null, fallback: !active, defaultLayout: active ? undefined : DEFAULT_PDF_TEMPLATE_LAYOUT };
  }

  async getSource(templateCode: string, revisionId?: string): Promise<{ buffer: Buffer; filename: string; checksum: string }> {
    const revision: any = await this.getRevision(templateCode, revisionId, true);
    if (!revision) throw new NotFoundException('Không tìm thấy revision PDF.');
    return { buffer: Buffer.from(revision.source_pdf), filename: revision.source_filename, checksum: revision.source_checksum };
  }

  async getActiveRevision(templateCode = PDF_TEMPLATE_CODE): Promise<any | null> {
    this.assertCode(templateCode);
    const template: any = await this.templateModel.findOne({ template_code: templateCode }).lean().exec();
    if (!template?.active_revision_id) return null;
    const revision: any = await this.revisionModel.findById(template.active_revision_id).select('+source_pdf').lean().exec();
    return revision?.status === 'PUBLISHED' ? revision : null;
  }

  async createDraft(file: { buffer: Buffer; originalname?: string; mimetype?: string }, templateCode: string, requester?: PdfTemplateRequester) {
    this.assertCode(templateCode);
    const source = await this.intake.validate(file.buffer, file.originalname, file.mimetype);
    let template: any = await this.templateModel.findOne({ template_code: templateCode }).exec();
    if (!template) {
      template = await this.templateModel.create({ template_code: templateCode, name: 'Đơn xin vào ký túc xá', current_revision: 0, active: true });
    }
    const revisionNumber = Number(template.current_revision || 0) + 1;
    const revision: any = await this.revisionModel.create({
      template_code: templateCode, template_id: template._id, revision: revisionNumber, revision_token: 0,
      status: 'DRAFT', source_filename: source.filename, source_checksum: source.checksum,
      layout_checksum: require('./field-catalog').layoutChecksum(DEFAULT_PDF_TEMPLATE_LAYOUT), source_pdf: source.buffer,
      layout: DEFAULT_PDF_TEMPLATE_LAYOUT, created_by: this.actorId(requester),
    });
    await this.templateModel.updateOne({ _id: template._id }, { $set: { current_revision: revisionNumber, updated_by: this.actorId(requester) } }).exec();
    return this.revisionMetadata(revision);
  }

  async updateDraft(templateCode: string, revisionId: string, input: CreatePdfTemplateDraftInput, requester?: PdfTemplateRequester) {
    const revision: any = await this.getRevision(templateCode, revisionId, true);
    if (!revision) throw new NotFoundException('Không tìm thấy draft PDF.');
    if (revision.status !== 'DRAFT') throw new ConflictException('Chỉ có thể sửa draft.');
    if (Number(input.revision) !== Number(revision.revision_token)) throw new ConflictException('Draft đã thay đổi. Hãy tải lại phiên bản mới nhất.');
    const layout = validateAndNormalizeLayout({ pageWidth: 595.32, pageHeight: 842.04, fields: input.fields });
    const updated: any = await this.revisionModel.findOneAndUpdate(
      { _id: revision._id, status: 'DRAFT', revision_token: input.revision },
      { $set: { layout, layout_checksum: require('./field-catalog').layoutChecksum(layout) }, $inc: { revision_token: 1 } },
      { new: true },
    ).select('+source_pdf').exec();
    if (!updated) throw new ConflictException('Draft đã thay đổi. Hãy tải lại phiên bản mới nhất.');
    return this.revisionMetadata(updated);
  }

  async validateDraft(templateCode: string, revisionId: string) {
    const revision: any = await this.getRevision(templateCode, revisionId, false);
    if (!revision) throw new NotFoundException('Không tìm thấy revision PDF.');
    try {
      const layout = validateAndNormalizeLayout(revision.layout);
      return { valid: true, errors: [], warnings: [], layoutChecksum: require('./field-catalog').layoutChecksum(layout) };
    } catch (error: any) {
      return { valid: false, errors: [error?.message || 'Layout không hợp lệ.'], warnings: [] };
    }
  }

  async publish(templateCode: string, revisionId: string, requester?: PdfTemplateRequester) {
    const revision: any = await this.getRevision(templateCode, revisionId, true);
    if (!revision) throw new NotFoundException('Không tìm thấy draft PDF.');
    if (revision.status !== 'DRAFT') throw new ConflictException('Revision đã được xử lý, không thể publish lại.');
    const validation = await this.validateDraft(templateCode, revisionId);
    if (!validation.valid) throw new ConflictException({ message: 'Không thể publish layout chưa hợp lệ.', errors: validation.errors });
    await this.revisionModel.updateMany({ template_code: templateCode, status: 'PUBLISHED' }, { $set: { status: 'SUPERSEDED' } }).exec();
    const published: any = await this.revisionModel.findOneAndUpdate(
      { _id: revision._id, status: 'DRAFT' },
      { $set: { status: 'PUBLISHED', published_by: this.actorId(requester), published_at: new Date() } },
      { new: true },
    ).exec();
    if (!published) throw new ConflictException('Revision không còn là draft.');
    await this.templateModel.updateOne({ template_code: templateCode }, { $set: { active_revision_id: published._id, current_revision: published.revision, updated_by: this.actorId(requester) } }).exec();
    return { ...this.revisionMetadata(published), checksum: published.layout_checksum, published: true };
  }

  async restore(templateCode: string, revisionId: string, requester?: PdfTemplateRequester) {
    const sourceRevision: any = await this.getRevision(templateCode, revisionId, true);
    if (!sourceRevision) throw new NotFoundException('Không tìm thấy revision cần khôi phục.');
    const template: any = await this.templateModel.findOne({ template_code: templateCode }).exec();
    if (!template) throw new NotFoundException('Không tìm thấy template.');
    const revisionNumber = Number(template.current_revision || 0) + 1;
    const draft: any = await this.revisionModel.create({
      template_code: templateCode, template_id: template._id, revision: revisionNumber, revision_token: 0,
      status: 'DRAFT', source_filename: sourceRevision.source_filename, source_checksum: sourceRevision.source_checksum,
      layout_checksum: sourceRevision.layout_checksum, source_pdf: sourceRevision.source_pdf, layout: sourceRevision.layout,
      created_by: this.actorId(requester),
    });
    await this.templateModel.updateOne({ _id: template._id }, { $set: { current_revision: revisionNumber, updated_by: this.actorId(requester) } }).exec();
    return this.revisionMetadata(draft);
  }

  async listRevisions(templateCode: string) {
    this.assertCode(templateCode);
    const rows: any[] = await this.revisionModel.find({ template_code: templateCode }).sort({ revision: -1 }).lean().exec();
    return rows.map((row) => this.revisionMetadata(row));
  }

  async preview(templateCode: string, revisionId: string, input: { realRoster?: boolean; rosterEntryId?: string }, requester?: PdfTemplateRequester) {
    const revision: any = await this.getRevision(templateCode, revisionId, true);
    if (!revision) throw new NotFoundException('Không tìm thấy revision PDF.');
    let values: Record<string, unknown>;
    if (input.realRoster) {
      this.assertRosterPreviewAccess(requester);
      if (!input.rosterEntryId) throw new NotFoundException('Thiếu rosterEntryId.');
      const roster: any = await this.rosterModel.findById(input.rosterEntryId).populate({ path: 'student_id', populate: { path: 'class_id', populate: { path: 'dept_id' } } }).exec();
      if (!roster) throw new NotFoundException('Không tìm thấy mục Danh sách KTX.');
      values = resolveRosterPdfValues(roster.toObject ? roster.toObject() : roster, roster.student_id);
    } else {
      values = Object.fromEntries(PDF_TEMPLATE_FIELD_CATALOG.map((field) => [field.key, field.key === 'name' ? 'Nguyễn Văn Bảo đảm tiếng Việt' : '']));
    }
    const rendered = await this.renderer.render(Buffer.from(revision.source_pdf), validateAndNormalizeLayout(revision.layout), values);
    return { ...rendered, filename: `preview-${templateCode.toLowerCase()}.pdf` };
  }

  private async getRevision(templateCode: string, revisionId: string | undefined, includeSource: boolean): Promise<any> {
    this.assertCode(templateCode);
    const query: any = revisionId ? this.revisionModel.findOne({ _id: revisionId, template_code: templateCode }) : this.revisionModel.findOne({ template_code: templateCode, status: 'DRAFT' }).sort({ revision: -1 });
    if (includeSource && query.select) query.select('+source_pdf');
    return query.exec();
  }

  private metadata(template: any) { return { templateCode: template.template_code, name: template.name, active: template.active !== false, activeRevisionId: template.active_revision_id || null, currentRevision: template.current_revision || 0 }; }
  private revisionMetadata(revision: any) { return { id: String(revision._id), templateCode: revision.template_code, revision: revision.revision, revisionToken: revision.revision_token, status: revision.status, sourceFilename: revision.source_filename, sourceChecksum: revision.source_checksum, layoutChecksum: revision.layout_checksum, layout: revision.layout, createdAt: revision.createdAt, publishedAt: revision.published_at || null }; }
  private fallbackMetadata() { return { templateCode: PDF_TEMPLATE_CODE, name: 'Đơn xin vào ký túc xá', active: true, activeRevisionId: null, currentRevision: 0, fallback: true, defaultLayout: DEFAULT_PDF_TEMPLATE_LAYOUT, fieldCatalog: PDF_TEMPLATE_FIELD_CATALOG }; }
  private assertCode(value: string) { if (value !== PDF_TEMPLATE_CODE) throw new NotFoundException('Template không được hỗ trợ.'); }
  private actorId(requester?: PdfTemplateRequester): Types.ObjectId | null { const value = requester?.userId || requester?._id; return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null; }
  private assertRosterPreviewAccess(requester?: PdfTemplateRequester) { const role = String(requester?.roleCode || '').toUpperCase(); const permissions = requester?.permissions || []; if (role !== 'ADMIN' && !permissions.includes('ADMIN_FULL') && !permissions.includes('DORM_REG_READ')) throw new ForbiddenException('Cần DORM_REG_READ để xem dữ liệu roster thật.'); }
}
