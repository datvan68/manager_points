import { readFile } from 'fs/promises';
import { join } from 'path';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { DORMITORY_ROSTER_APPLICATION, createDefaultDormitoryLayout } from '../src/dormitory/pdf-template-adapter';
import { PdfTemplateIntakeService } from '../src/pdf-template/pdf-template-intake.service';

const SOURCE_PATH = join(__dirname, '..', 'src', 'dormitory', 'templates', 'dormitory-roster-application.pdf');
const PERMISSIONS = ['PDF_TEMPLATE_READ', 'PDF_TEMPLATE_MANAGE', 'DORM_REG_READ'];

export async function buildSeedReport() {
  const buffer = await readFile(SOURCE_PATH);
  const source = await new PdfTemplateIntakeService().validate(buffer, 'dormitory-roster-application.pdf', 'application/pdf');
  return {
    templateTypeCode: DORMITORY_ROSTER_APPLICATION,
    sourceChecksum: source.checksum,
    layoutChecksum: createHash('sha256').update(JSON.stringify(createDefaultDormitoryLayout(source.pages))).digest('hex'),
    sourceBytes: buffer.length,
    intendedVersion: 1,
    permissions: PERMISSIONS,
  };
}

async function execute(report: Awaited<ReturnType<typeof buildSeedReport>>) {
  if (process.env.NODE_ENV !== 'development') throw new Error('Seed chỉ được execute trong NODE_ENV=development.');
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI cho seed execute.');
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const templates = mongoose.connection.collection('pdf_templates');
    const existing = await templates.findOne({ templateTypeCode: DORMITORY_ROSTER_APPLICATION });
    if (existing) {
      console.log(JSON.stringify({ ...report, action: 'noop', reason: 'template_exists' }, null, 2));
      return;
    }
    const now = new Date();
    const buffer = await readFile(SOURCE_PATH);
    const source = await new PdfTemplateIntakeService().validate(buffer, 'dormitory-roster-application.pdf', 'application/pdf');
    await templates.insertOne({ templateTypeCode: DORMITORY_ROSTER_APPLICATION, moduleCode: 'DORMITORY', featureCode: 'DORMITORY_ROSTER', displayName: 'Mẫu đơn đăng ký KTX', sourceMimeType: 'application/pdf', sourceFilename: source.filename, sourceChecksum: source.checksum, sourceBytes: buffer.length, sourcePdf: buffer, pages: source.pages, layout: createDefaultDormitoryLayout(source.pages), version: 1, active: true, audit: { updatedBy: null, updatedAt: now }, updatedAt: now });
    console.log(JSON.stringify({ ...report, action: 'created', version: 1 }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

buildSeedReport().then((report) => {
  if (process.argv.includes('--execute')) return execute(report);
  console.log(JSON.stringify({ ...report, mode: 'dry-run', databaseWrites: 0 }, null, 2));
}).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
