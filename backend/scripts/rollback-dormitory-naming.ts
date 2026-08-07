import { runMigration, isProductionConnection } from './migrate-dormitory-naming';

// Rollback uses the same collision-safe implementation with reversed paths.
// It remains dry-run by default and requires --execute explicitly.
if (require.main === module) {
  if (isProductionConnection(process.env.MONGO_URI || '')) {
    console.error('Production connection detected; rollback is blocked.');
    process.exitCode = 1;
  } else {
    process.env.DORMITORY_ROLLBACK = '1';
    runMigration().catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
