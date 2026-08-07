# Dormitory field naming migration

The dormitory API and MongoDB documents use English `snake_case` field names. Existing Vietnamese enum values are retained for data compatibility and are rendered through the frontend `DORMITORY_ENUM_LABELS` map.

## Dry run (default)

```powershell
cd backend
npm run migration:dormitory-naming:dry-run
```

The report contains document counts, non-sensitive `_id` checksums, proposed field/index changes, and collisions. No writes occur.

## Execute / rollback

Review the dry-run report, backup reference, and isolated-database counts before requesting the Human Gate. Then run only against a non-production `MONGO_URI`:

```powershell
npm run migration:dormitory-naming:execute
npm run migration:dormitory-naming:rollback:dry-run
npm run migration:dormitory-naming:rollback:execute
```

Both directions are idempotent and stop when old and new keys coexist in one document. Production-like URIs and `NODE_ENV=production` are blocked. Personal field values are never logged.
