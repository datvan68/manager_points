import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { normalizeStudentCode } from '../src/dormitory/registration-edit-policy';

dotenv.config({ path: path.join(__dirname, '../.env') });

export type ReconciliationReport = {
  mode: 'dry-run';
  totals: { public: number; formal: number; students: number };
  malformedSources: Array<{ id: string; source: unknown }>;
  invalidCodes: Array<{ id: string; code: string; reason: string }>;
  duplicateCandidates: Array<{ code: string; studentIds: string[] }>;
  divergentLinkedRecords: Array<{ publicId: string; formalId: string; fields: string[] }>;
  partialLinks: Array<{ publicId: string; linkedStudentId?: string; linkedRegistrationId?: string; reason: string }>;
  unsafeFindings: string[];
};

const isPublicSource = (value: unknown) => value === 'QR_SCAN' || value === 'PUBLIC';
const isKnownSource = (value: unknown) => value === 'ADMIN_ENTRY' || isPublicSource(value);
const idOf = (value: unknown) => String((value as any)?._id ?? value ?? '');

export function buildReconciliationReport(input: {
  publicRegistrations: any[];
  formalRegistrations: any[];
  students: any[];
}): ReconciliationReport {
  const studentsByCode = new Map<string, any[]>();
  for (const student of input.students) {
    const code = normalizeStudentCode(student.student_code);
    if (!code) continue;
    studentsByCode.set(code, [...(studentsByCode.get(code) || []), student]);
  }

  const malformedSources = input.publicRegistrations
    .filter((item) => !isKnownSource(item.source))
    .map((item) => ({ id: idOf(item), source: item.source ?? null }));
  const invalidCodes: ReconciliationReport['invalidCodes'] = [];
  const duplicateCandidates: ReconciliationReport['duplicateCandidates'] = [];
  for (const [code, students] of studentsByCode) {
    if (students.length > 1) duplicateCandidates.push({ code, studentIds: students.map((student) => idOf(student)) });
  }

  for (const item of input.publicRegistrations) {
    const code = normalizeStudentCode(item.student_code);
    if (!code) continue;
    const candidates = studentsByCode.get(code) || [];
    if (!candidates.length) invalidCodes.push({ id: idOf(item), code, reason: 'NOT_FOUND' });
    else if (candidates.length > 1 && !duplicateCandidates.some((entry) => entry.code === code)) {
      duplicateCandidates.push({ code, studentIds: candidates.map((student) => idOf(student)) });
    }
  }

  const formalById = new Map(input.formalRegistrations.map((item) => [idOf(item), item]));
  const studentsById = new Map(input.students.map((item) => [idOf(item), item]));
  const partialLinks: ReconciliationReport['partialLinks'] = [];
  const divergentLinkedRecords: ReconciliationReport['divergentLinkedRecords'] = [];
  for (const item of input.publicRegistrations) {
    const hasStudent = Boolean(item.linked_student_id);
    const hasFormal = Boolean(item.linked_registration_id);
    if (hasStudent !== hasFormal) {
      partialLinks.push({ publicId: idOf(item), linkedStudentId: item.linked_student_id ? idOf(item.linked_student_id) : undefined, linkedRegistrationId: item.linked_registration_id ? idOf(item.linked_registration_id) : undefined, reason: 'ONE_SIDED_LINK' });
      continue;
    }
    if (!hasStudent || !hasFormal) continue;
    const formal = formalById.get(idOf(item.linked_registration_id));
    const student = studentsById.get(idOf(item.linked_student_id));
    if (!formal || !student) {
      partialLinks.push({ publicId: idOf(item), linkedStudentId: idOf(item.linked_student_id), linkedRegistrationId: idOf(item.linked_registration_id), reason: !formal ? 'FORMAL_REGISTRATION_MISSING' : 'STUDENT_MISSING' });
      continue;
    }
    const fields: string[] = [];
    if (idOf(formal.student_id) !== idOf(item.linked_student_id)) fields.push('student_id');
    if (normalizeStudentCode(student.student_code) !== normalizeStudentCode(item.student_code)) fields.push('student_code');
    if (String(formal.semester || '') !== String(item.semester || '')) fields.push('semester');
    if (String(formal.academic_year || '') !== String(item.academic_year || '')) fields.push('academic_year');
    if (fields.length) divergentLinkedRecords.push({ publicId: idOf(item), formalId: idOf(formal), fields });
  }

  const unsafeFindings = [
    ...(malformedSources.length ? [`${malformedSources.length} malformed source record(s).`] : []),
    ...(invalidCodes.length ? [`${invalidCodes.length} invalid student code record(s).`] : []),
    ...(duplicateCandidates.length ? [`${duplicateCandidates.length} duplicate student-code candidate group(s).`] : []),
    ...(divergentLinkedRecords.length ? [`${divergentLinkedRecords.length} linked record(s) diverge from the canonical formal record.`] : []),
    ...(partialLinks.length ? [`${partialLinks.length} partial link record(s).`] : []),
  ];
  return {
    mode: 'dry-run',
    totals: { public: input.publicRegistrations.length, formal: input.formalRegistrations.length, students: input.students.length },
    malformedSources,
    invalidCodes,
    duplicateCandidates,
    divergentLinkedRecords,
    partialLinks,
    unsafeFindings,
  };
}

export async function runReconciliation(db: Db): Promise<ReconciliationReport> {
  const [publicRegistrations, formalRegistrations, students] = await Promise.all([
    db.collection('publicregistrations').find({}).toArray(),
    db.collection('registrations').find({}).toArray(),
    db.collection('students').find({}, { projection: { student_code: 1 } }).toArray(),
  ]);
  const report = buildReconciliationReport({ publicRegistrations, formalRegistrations, students });
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  if (process.argv.includes('--execute')) throw new Error('Registration reconciliation is dry-run only; obtain the Human Gate and implement a reviewed record set before any write.');
  const uri = process.env.MONGO_URI || '';
  if (!uri) {
    console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.');
    return;
  }
  if (process.env.NODE_ENV === 'production' || /(?:prod|production|atlas|cluster)/i.test(uri)) throw new Error('Production connection detected; reconciliation is blocked.');
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable.');
    await runReconciliation(db);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
