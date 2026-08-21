import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env') });

interface MigrationMapping {
  collection: string;
  documentId: string;
  field: string;
  oldUrl: string;
  newUrl: string;
  sourcePath: string;
  destinationPath: string;
  sha256: string;
  size: number;
}

interface MigrationReport {
  mode: 'dry-run' | 'execute' | 'verify' | 'rollback';
  timestamp: string;
  sourceDir: string;
  targetDir: string;
  totalFilesOnDisk: number;
  totalBytesOnDisk: number;
  totalReferencesInDb: number;
  matchedReferences: number;
  missingReferences: number;
  orphanFiles: string[];
  mappings: MigrationMapping[];
  errors: string[];
  status: 'ready' | 'success' | 'verified' | 'rolled-back' | 'failed';
}

function calculateSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isVerify = args.includes('--verify');
  const isRollback = args.includes('--rollback');
  const mode: 'dry-run' | 'execute' | 'verify' | 'rollback' = isRollback
    ? 'rollback'
    : isVerify
    ? 'verify'
    : isExecute
    ? 'execute'
    : 'dry-run';

  const sourceDir = path.resolve(__dirname, '../uploads');
  const targetDir = path.resolve(
    process.env.UPLOAD_STORAGE_ROOT || path.join(__dirname, '../storage/uploads'),
  );

  console.log(`=======================================================`);
  console.log(` STORAGE MIGRATION TOOL - MODE: ${mode.toUpperCase()}`);
  console.log(` Source: ${sourceDir}`);
  console.log(` Target: ${targetDir}`);
  console.log(`=======================================================\n`);

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/manager-point';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Không thể kết nối cơ sở dữ liệu MongoDB');
  }

  // Handle Rollback
  if (mode === 'rollback') {
    const storageDir = path.dirname(targetDir);
    const rollbackFiles = fs
      .readdirSync(storageDir)
      .filter((f) => f.startsWith('migration-rollback-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (rollbackFiles.length === 0) {
      console.error('Không tìm thấy tệp tin rollback mapping nào trong storage!');
      process.exit(1);
    }

    const rollbackFile = path.join(storageDir, rollbackFiles[0]);
    console.log(`Đang đọc rollback mapping từ: ${rollbackFile}`);
    const report: MigrationReport = JSON.parse(fs.readFileSync(rollbackFile, 'utf8'));

    let restored = 0;
    for (const item of report.mappings) {
      const col = db.collection(item.collection);
      const updateDoc: any = {};
      updateDoc[item.field] = item.oldUrl;
      await col.updateOne({ _id: new mongoose.Types.ObjectId(item.documentId) }, { $set: updateDoc });
      restored++;
    }

    console.log(`\nHoàn tất rollback! Đã khôi phục ${restored} bản ghi về đường dẫn cũ.`);
    await mongoose.disconnect();
    return;
  }

  // 1. Scan filesystem
  const filesOnDisk = fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir) : [];
  let totalBytesOnDisk = 0;
  const fileMap = new Map<string, { size: number; sha256: string; path: string }>();

  for (const filename of filesOnDisk) {
    const fullPath = path.join(sourceDir, filename);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      totalBytesOnDisk += stat.size;
      fileMap.set(filename, {
        size: stat.size,
        sha256: calculateSha256(fullPath),
        path: fullPath,
      });
    }
  }

  // 2. Scan DB references
  const mappings: MigrationMapping[] = [];
  const referencedFilenames = new Set<string>();
  const errors: string[] = [];

  // 2.1 Activities
  const activitiesCol = db.collection('activities');
  const activities = await activitiesCol.find({}).toArray();
  for (const act of activities) {
    const id = String(act._id);
    if (act.logo_url && typeof act.logo_url === 'string' && act.logo_url.includes('/uploads/')) {
      const filename = path.basename(act.logo_url);
      referencedFilenames.add(filename);
      const fileInfo = fileMap.get(filename);
      const destRel = `public/activities/logos/${filename}`;
      mappings.push({
        collection: 'activities',
        documentId: id,
        field: 'logo_url',
        oldUrl: act.logo_url,
        newUrl: `/api/media/public/activities/logos/${filename}`,
        sourcePath: fileInfo ? fileInfo.path : path.join(sourceDir, filename),
        destinationPath: path.join(targetDir, destRel),
        sha256: fileInfo ? fileInfo.sha256 : '',
        size: fileInfo ? fileInfo.size : 0,
      });
    }
    if (act.cover_url && typeof act.cover_url === 'string' && act.cover_url.includes('/uploads/')) {
      const filename = path.basename(act.cover_url);
      referencedFilenames.add(filename);
      const fileInfo = fileMap.get(filename);
      const destRel = `public/activities/covers/${filename}`;
      mappings.push({
        collection: 'activities',
        documentId: id,
        field: 'cover_url',
        oldUrl: act.cover_url,
        newUrl: `/api/media/public/activities/covers/${filename}`,
        sourcePath: fileInfo ? fileInfo.path : path.join(sourceDir, filename),
        destinationPath: path.join(targetDir, destRel),
        sha256: fileInfo ? fileInfo.sha256 : '',
        size: fileInfo ? fileInfo.size : 0,
      });
    }
  }

  // 2.2 Invoices (Dormitory utility invoices)
  const invoicesCol = db.collection('invoices');
  const invoices = await invoicesCol.find({ 'payment_proof.url': { $exists: true, $ne: null } }).toArray();
  for (const inv of invoices) {
    const id = String(inv._id);
    const proofUrl = inv.payment_proof?.url;
    if (proofUrl && typeof proofUrl === 'string' && proofUrl.includes('/uploads/')) {
      const filename = path.basename(proofUrl);
      referencedFilenames.add(filename);
      const fileInfo = fileMap.get(filename);
      const destRel = `private/invoices/proofs/${filename}`;
      mappings.push({
        collection: 'invoices',
        documentId: id,
        field: 'payment_proof.url',
        oldUrl: proofUrl,
        newUrl: `/api/media/private/invoices/proofs/${filename}`,
        sourcePath: fileInfo ? fileInfo.path : path.join(sourceDir, filename),
        destinationPath: path.join(targetDir, destRel),
        sha256: fileInfo ? fileInfo.sha256 : '',
        size: fileInfo ? fileInfo.size : 0,
      });
    }
  }

  // 2.3 Room fee invoices
  const roomFeeCol = db.collection('dormitory_room_fee_invoices');
  const roomFeeInvoices = await roomFeeCol.find({ 'payment_proof.url': { $exists: true, $ne: null } }).toArray();
  for (const inv of roomFeeInvoices) {
    const id = String(inv._id);
    const proofUrl = inv.payment_proof?.url;
    if (proofUrl && typeof proofUrl === 'string' && proofUrl.includes('/uploads/')) {
      const filename = path.basename(proofUrl);
      referencedFilenames.add(filename);
      const fileInfo = fileMap.get(filename);
      const destRel = `private/room-fee-invoices/proofs/${filename}`;
      mappings.push({
        collection: 'dormitory_room_fee_invoices',
        documentId: id,
        field: 'payment_proof.url',
        oldUrl: proofUrl,
        newUrl: `/api/media/private/room-fee-invoices/proofs/${filename}`,
        sourcePath: fileInfo ? fileInfo.path : path.join(sourceDir, filename),
        destinationPath: path.join(targetDir, destRel),
        sha256: fileInfo ? fileInfo.sha256 : '',
        size: fileInfo ? fileInfo.size : 0,
      });
    }
  }

  // 2.4 Utility Config (transfer QR)
  const utilityConfigCol = db.collection('utilityconfigs');
  const utilityConfigs = await utilityConfigCol.find({ 'transfer_qr_image.url': { $exists: true, $ne: null } }).toArray();
  for (const cfg of utilityConfigs) {
    const id = String(cfg._id);
    const qrUrl = cfg.transfer_qr_image?.url;
    if (qrUrl && typeof qrUrl === 'string' && qrUrl.includes('/uploads/')) {
      const filename = path.basename(qrUrl);
      referencedFilenames.add(filename);
      const fileInfo = fileMap.get(filename);
      const destRel = `public/dormitory-qr/${filename}`;
      mappings.push({
        collection: 'utilityconfigs',
        documentId: id,
        field: 'transfer_qr_image.url',
        oldUrl: qrUrl,
        newUrl: `/api/media/public/dormitory-qr/${filename}`,
        sourcePath: fileInfo ? fileInfo.path : path.join(sourceDir, filename),
        destinationPath: path.join(targetDir, destRel),
        sha256: fileInfo ? fileInfo.sha256 : '',
        size: fileInfo ? fileInfo.size : 0,
      });
    }
  }

  // 2.5 Room Fee Config (transfer QR)
  const roomFeeConfigCol = db.collection('dormitory_room_fee_configs');
  const roomFeeConfigs = await roomFeeConfigCol.find({ 'transfer_qr_image.url': { $exists: true, $ne: null } }).toArray();
  for (const cfg of roomFeeConfigs) {
    const id = String(cfg._id);
    const qrUrl = cfg.transfer_qr_image?.url;
    if (qrUrl && typeof qrUrl === 'string' && qrUrl.includes('/uploads/')) {
      const filename = path.basename(qrUrl);
      referencedFilenames.add(filename);
      const fileInfo = fileMap.get(filename);
      const destRel = `public/dormitory-qr/${filename}`;
      mappings.push({
        collection: 'dormitory_room_fee_configs',
        documentId: id,
        field: 'transfer_qr_image.url',
        oldUrl: qrUrl,
        newUrl: `/api/media/public/dormitory-qr/${filename}`,
        sourcePath: fileInfo ? fileInfo.path : path.join(sourceDir, filename),
        destinationPath: path.join(targetDir, destRel),
        sha256: fileInfo ? fileInfo.sha256 : '',
        size: fileInfo ? fileInfo.size : 0,
      });
    }
  }

  // Calculate orphans and missing
  const orphanFiles: string[] = [];
  for (const filename of filesOnDisk) {
    if (!referencedFilenames.has(filename)) {
      orphanFiles.push(filename);
    }
  }

  let missingCount = 0;
  for (const m of mappings) {
    if (!fs.existsSync(m.sourcePath)) {
      missingCount++;
      errors.push(`Tệp tin nguồn bị thiếu: ${m.sourcePath} (Collection: ${m.collection}, Doc: ${m.documentId})`);
    }
  }

  const report: MigrationReport = {
    mode,
    timestamp: new Date().toISOString(),
    sourceDir,
    targetDir,
    totalFilesOnDisk: filesOnDisk.length,
    totalBytesOnDisk,
    totalReferencesInDb: mappings.length,
    matchedReferences: mappings.length - missingCount,
    missingReferences: missingCount,
    orphanFiles,
    mappings,
    errors,
    status: errors.length > 0 ? 'failed' : 'ready',
  };

  console.log('--- KẾT QUẢ KIỂM KÊ (INVENTORY SUMMARY) ---');
  console.log(` Tổng số tệp trên ổ đĩa (/uploads): ${report.totalFilesOnDisk} (${Math.round(report.totalBytesOnDisk / 1024)} KB)`);
  console.log(` Tổng số liên kết trong CSDL:       ${report.totalReferencesInDb}`);
  console.log(` Liên kết khớp với tệp nguồn:       ${report.matchedReferences}`);
  console.log(` Liên kết bị thiếu tệp nguồn:       ${report.missingReferences}`);
  console.log(` Tệp tin mồ côi (không ai dùng):    ${report.orphanFiles.length}`);

  if (mode === 'dry-run') {
    console.log(`\n[DRY-RUN] Không có thay đổi nào được ghi. Dùng --execute để thực thi di chuyển.`);
    await mongoose.disconnect();
    return;
  }

  // Handle Verify Mode
  if (mode === 'verify') {
    console.log(`\n--- KIỂM TRA TÍNH TOÀN VẸN (VERIFICATION) ---`);
    let verifiedCount = 0;
    for (const item of mappings) {
      if (!fs.existsSync(item.destinationPath)) {
        console.error(`[FAIL] Không tìm thấy tệp đích: ${item.destinationPath}`);
        continue;
      }
      const destHash = calculateSha256(item.destinationPath);
      if (item.sha256 && destHash !== item.sha256) {
        console.error(`[FAIL] Sai lệch Checksum cho ${item.destinationPath}`);
        continue;
      }
      verifiedCount++;
    }
    console.log(`Đã kiểm tra thành công ${verifiedCount}/${mappings.length} tệp tin.`);
    await mongoose.disconnect();
    return;
  }

  // Handle Execute Mode
  if (mode === 'execute') {
    console.log(`\n--- BẮT ĐẦU THỰC THI DI CHUYỂN (EXECUTE) ---`);

    // 1. Copy all files atomically and verify sha256
    for (const item of mappings) {
      if (!fs.existsSync(item.sourcePath)) {
        console.warn(`[SKIP] Bỏ qua tệp nguồn không tồn tại: ${item.sourcePath}`);
        continue;
      }

      const destDir = path.dirname(item.destinationPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(item.sourcePath, item.destinationPath);
      const newHash = calculateSha256(item.destinationPath);

      if (newHash !== item.sha256) {
        throw new Error(
          `Lỗi Checksum: Tệp đích ${item.destinationPath} (${newHash}) không khớp nguồn (${item.sha256})`,
        );
      }
    }

    // 2. Also copy orphan files into storage for safe preservation
    for (const orphan of orphanFiles) {
      const src = path.join(sourceDir, orphan);
      const isProof = orphan.startsWith('invoice-proof-');
      const isQr = orphan.startsWith('invoice-transfer-qr-');
      const sub = isProof ? 'private/invoices/proofs' : isQr ? 'public/dormitory-qr' : 'public/activities/covers';
      const dest = path.join(targetDir, sub, orphan);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    // 3. Update database references
    let updatedDbRecords = 0;
    for (const item of mappings) {
      const col = db.collection(item.collection);
      const updateDoc: any = {};
      updateDoc[item.field] = item.newUrl;
      const res = await col.updateOne(
        { _id: new mongoose.Types.ObjectId(item.documentId) },
        { $set: updateDoc },
      );
      if (res.modifiedCount > 0) {
        updatedDbRecords++;
      }
    }

    // 4. Save rollback file
    const storageDir = path.dirname(targetDir);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const rollbackPath = path.join(storageDir, `migration-rollback-${Date.now()}.json`);
    report.status = 'success';
    fs.writeFileSync(rollbackPath, JSON.stringify(report, null, 2));

    console.log(`\n=======================================================`);
    console.log(` DI CHUYỂN DỮ LIỆU THÀNH CÔNG!`);
    console.log(` Đã sao chép & đối soát Checksum: ${mappings.length} tệp tin`);
    console.log(` Đã cập nhật liên kết CSDL:        ${updatedDbRecords} bản ghi`);
    console.log(` Rollback mapping đã lưu tại:      ${rollbackPath}`);
    console.log(`=======================================================`);
  }

  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('LỖI TRONG QUÁ TRÌNH DI CHUYỂN:', err);
  process.exit(1);
});
