import { readFile } from 'fs/promises';
import { join } from 'path';
import mongoose from 'mongoose';
import { DEFAULT_PDF_TEMPLATE_LAYOUT, PDF_TEMPLATE_CODE, layoutChecksum } from '../src/dormitory/pdf-template/field-catalog';
import { PdfTemplateIntakeService } from '../src/dormitory/pdf-template/pdf-template-intake.service';

const SOURCE_PATH = join(__dirname, '..', 'src', 'dormitory', 'templates', 'dormitory-roster-application.pdf');
const PERMISSIONS = ['DORM_PDF_TEMPLATE_READ', 'DORM_PDF_TEMPLATE_MANAGE', 'DORM_PDF_TEMPLATE_PUBLISH'];

export async function buildSeedReport() {
  const buffer = await readFile(SOURCE_PATH);
  const source = await new PdfTemplateIntakeService().validate(buffer, 'dormitory-roster-application.pdf', 'application/pdf');
  return {
    templateCode: PDF_TEMPLATE_CODE,
    sourceChecksum: source.checksum,
    layoutChecksum: layoutChecksum(DEFAULT_PDF_TEMPLATE_LAYOUT),
    sourceBytes: buffer.length,
    intendedRevision: 1,
    permissions: PERMISSIONS,
  };
}

async function execute(report: Awaited<ReturnType<typeof buildSeedReport>>) {
  if (process.env.NODE_ENV !== 'development') throw new Error('Seed chỉ được execute trong NODE_ENV=development.');
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI cho seed execute.');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const templates = mongoose.connection.collection('dormitory_pdf_templates');
    const revisions = mongoose.connection.collection('dormitory_pdf_template_revisions');
    const existing = await templates.findOne({ template_code: PDF_TEMPLATE_CODE });
    if (existing) {
      console.log(JSON.stringify({ ...report, action: 'noop', reason: 'template_exists' }, null, 2));
      return;
    }
    const now = new Date();
    const templateId = new mongoose.Types.ObjectId();
    const revisionId = new mongoose.Types.ObjectId();
    await templates.insertOne({ _id: templateId, template_code: PDF_TEMPLATE_CODE, name: 'Đơn xin vào ký túc xá', active: true, active_revision_id: revisionId, current_revision: 1, createdAt: now, updatedAt: now });
    const buffer = await readFile(SOURCE_PATH);
    await revisions.insertOne({ _id: revisionId, template_code: PDF_TEMPLATE_CODE, template_id: templateId, revision: 1, revision_token: 0, status: 'PUBLISHED', source_filename: 'dormitory-roster-application.pdf', source_checksum: report.sourceChecksum, layout_checksum: report.layoutChecksum, source_pdf: buffer, layout: DEFAULT_PDF_TEMPLATE_LAYOUT, published_at: now, createdAt: now, updatedAt: now });
    console.log(JSON.stringify({ ...report, action: 'created', revisionId: String(revisionId) }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

buildSeedReport().then((report) => {
  if (process.argv.includes('--execute')) return execute(report);
  console.log(JSON.stringify({ ...report, mode: 'dry-run', databaseWrites: 0 }, null, 2));
}).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
