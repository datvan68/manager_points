import * as path from 'path';

const validPath = path.join(process.cwd(), 'storage', 'backups', 'backup_123.gz');
const backupDir = path.dirname(validPath);
const modifiedBackupDir = backupDir.replace(/^[a-z]:/i, (m) => m === m.toUpperCase() ? m.toLowerCase() : m.toUpperCase());

console.log('validPath:', validPath);
console.log('modifiedBackupDir:', modifiedBackupDir);

const absoluteFilePath = path.resolve(validPath);
const absoluteBackupDir = path.resolve(modifiedBackupDir);
const safePrefix = absoluteBackupDir.endsWith(path.sep) ? absoluteBackupDir : absoluteBackupDir + path.sep;
const relative = path.relative(safePrefix, absoluteFilePath);
const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

console.log('relative:', relative);
console.log('isSafe:', isSafe);
