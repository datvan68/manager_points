# Task Scope: Import Backup Database va Khoi Phuc Du Lieu

## 1. Muc tieu

Bo sung chuc nang trong trang `/system`, tab/danh muc sao luu database, cho phep nguoi dung co quyen import tep sao luu database de xem truoc tong quan cac bang/collections va thuc hien khoi phuc du lieu khi da xac nhan.

Luong chinh:

1. Nguoi dung vao `/system` -> tab `backup`.
2. Bam nut `Import sao luu` va chon file backup.
3. He thong upload file, kiem tra dinh dang, tao phien preview.
4. Frontend mo modal tong quan database, hien thi danh sach collections, so ban ghi, kich thuoc uoc tinh, trang thai hop le/canh bao.
5. Nguoi dung chon collections can khoi phuc va che do restore.
6. He thong yeu cau xac nhan ro rang truoc khi ghi du lieu.
7. Backend tao backup an toan truoc restore, sau do chay restore job bat dong bo va cap nhat tien trinh/trang thai.

## 2. Pham vi hien tai cua du an

Frontend hien co:

- Trang chinh: `frontend/src/app/system/page.tsx`.
- API client: `frontend/src/api/system-api.ts`.
- Tab backup hien co danh sach job, tao backup, tai backup, xoa backup.
- Quyen hien co: `DATABASE_BACKUP_READ`, `DATABASE_BACKUP_CREATE`, `DATABASE_BACKUP_DOWNLOAD`, `DATABASE_BACKUP_DELETE`.

Backend hien co:

- Controller: `backend/src/system/system.controller.ts`.
- Service: `backend/src/system/system.service.ts`.
- DTO: `backend/src/system/dto/system.dto.ts`.
- Schema job: `backend/src/system/schemas/database-backup-job.schema.ts`.
- Backup file dang luu trong `storage/backups`.
- Co 2 dang backup can ho tro:
  - `mongodump --archive --gzip`.
  - Fallback NDJSON gzip do `runMongooseBackupFallback` sinh ra.

## 3. Chuc nang can them

### 3.1 Frontend `/system` - tab Backup

Them UI vao khu vuc backup:

- Nut `Import sao luu` chi hien thi khi co quyen restore/import.
- Input file an, chi chap nhan dinh dang `.gz`, `.archive`, `.zip` neu backend ho tro.
- Khi chon file:
  - Upload file len API preview.
  - Hien loading state: "Dang phan tich tep sao luu...".
  - Neu hop le, mo modal tong quan database.
  - Neu loi, hien toast loi ro rang.

Modal tong quan database can co:

- Header:
  - Ten file.
  - Kich thuoc file.
  - Dinh dang backup phat hien.
  - Thoi diem backup neu doc duoc metadata.
  - Checksum/file hash neu backend tra ve.
- Bang collections:
  - Ten collection.
  - So documents trong file backup.
  - So documents hien tai trong database.
  - Chenh lech them/xoa/ghi de uoc tinh.
  - Trang thai: hop le, thieu collection, collection moi, canh bao schema.
  - Checkbox chon collection can restore.
- Khu vuc tuy chon restore:
  - `Restore selected collections`.
  - Mode mac dinh: `replace_selected_collections`.
  - Mode tuy chon neu can: `merge_upsert` cho document trung `_id`.
  - Checkbox bat buoc: "Toi hieu thao tac nay co the ghi de du lieu hien tai".
  - O nhap xac nhan bat buoc: go `RESTORE`.
- Footer:
  - `Huy`.
  - `Khoi phuc du lieu` disabled neu chua chon collection/chua xac nhan/chua co quyen.

Sau khi submit restore:

- Goi API restore confirm bang `previewSessionId`.
- Dong modal hoac chuyen modal sang trang thai job progress.
- Refresh danh sach backup/restore job.
- Poll trang thai job 3 giay/lien tuc nhu backup job hien co.

### 3.2 API client frontend

Mo rong `frontend/src/api/system-api.ts`:

- Them type:
  - `BackupPreviewCollection`.
  - `BackupImportPreview`.
  - `RestoreJob`.
  - `RestoreMode`.
- Them method:
  - `previewBackupImport(file: File): Promise<BackupImportPreview>`.
  - `restoreBackupImport(payload): Promise<RestoreJob>`.
  - `getRestoreJobs(query): Promise<PaginatedResponse<RestoreJob>>` neu tach job restore rieng.

Khong truyen token qua query string. Dung `httpClient`/Authorization header nhu cac API hien tai.

### 3.3 Backend endpoints

Them endpoints trong `SystemController`:

- `POST /api/system/backups/import/preview`
  - Permission: `DATABASE_BACKUP_RESTORE` hoac `DATABASE_BACKUP_IMPORT`.
  - Content-Type: `multipart/form-data`.
  - Upload 1 file backup.
  - Tra ve preview session va tong quan collections.

- `POST /api/system/backups/import/restore`
  - Permission: `DATABASE_BACKUP_RESTORE`.
  - Body gom:
    - `previewSessionId`.
    - `collections`.
    - `mode`.
    - `confirmationText`.
  - Tao restore job bat dong bo.
  - Bat buoc kiem tra `confirmationText === "RESTORE"`.

- `GET /api/system/backups/restore-jobs`
  - Permission: `DATABASE_BACKUP_READ` hoac `DATABASE_BACKUP_RESTORE`.
  - Tra ve lich su restore job va trang thai.

### 3.4 Backend service

Them service logic:

- Validate file:
  - Gioi han kich thuoc upload theo config.
  - Chi nhan file backup hop le.
  - Luu file tam trong folder rieng, vi du `storage/backup-imports`.
  - Kiem tra path traversal bang `path.resolve` va safe prefix nhu logic download/delete backup hien co.
- Phat hien dinh dang:
  - Neu la MongoDB archive gzip: xu ly bang `mongorestore` vao temporary database de inspect.
  - Neu la fallback NDJSON gzip: stream parse tung line, nhan dien header `{ "__collection": "..." }`.
- Tao preview:
  - Tinh danh sach collections trong file.
  - Dem documents moi collection.
  - Lay document count hien tai cua database hien hanh.
  - Khong log noi dung document, khong tra sample chua thong tin nhay cam mac dinh.
  - Neu can sample, chi tra `_id` va keys top-level da mask.
- Restore:
  - Khong restore ngay trong request preview.
  - Truoc khi restore, tu dong tao backup hien trang database va luu job lien ket.
  - Chi restore collections duoc chon.
  - Mac dinh `replace_selected_collections`: drop collection duoc chon roi import lai.
  - Neu `merge_upsert`: upsert theo `_id`, khong xoa document khong co trong file.
  - Block neu co backup/restore job khac dang `queued` hoac `running`.
  - Ghi audit log userId, jobId, collections, mode, file hash, ket qua.
  - Mask URI/secret trong moi error message.

### 3.5 Schema/DTO

Co the mo rong schema `DatabaseBackupJob` hoac tao schema moi `DatabaseRestoreJob`.

Khuyen nghi tao schema rieng `DatabaseRestoreJob`:

- `status`: `queued | running | success | failed`.
- `requested_by`.
- `started_at`.
- `finished_at`.
- `source_file_name`.
- `source_file_size`.
- `source_file_hash`.
- `preview_session_id`.
- `mode`.
- `collections`.
- `collection_summaries`.
- `pre_restore_backup_job_id`.
- `error_message`.
- timestamps.

DTO can them:

- `CreateBackupImportPreviewDto` neu can metadata di kem upload.
- `RestoreBackupImportDto`:
  - `previewSessionId`: string.
  - `collections`: string[], min 1.
  - `mode`: enum `replace_selected_collections | merge_upsert`.
  - `confirmationText`: string.

## 4. Quyen va bao mat

Them permission moi:

- `DATABASE_BACKUP_RESTORE`: duoc import, preview va chay restore.

Neu muon tach nho hon:

- `DATABASE_BACKUP_IMPORT`: chi duoc upload/preview.
- `DATABASE_BACKUP_RESTORE`: duoc thuc hien restore.

Yeu cau bao mat bat buoc:

- Khong expose `file_path` ra client.
- Khong log raw `MONGO_URI`, token, password, noi dung document.
- File upload phai co gioi han kich thuoc va dinh dang.
- Tat ca file tam phai nam trong thu muc duoc resolve an toan.
- Restore la thao tac destructive nen bat buoc:
  - Permission rieng.
  - Modal xac nhan.
  - Chu xac nhan `RESTORE`.
  - Tao backup truoc restore.
  - Audit log.

## 5. UX chi tiet

Trang backup nen co cac nut:

- `Tao sao luu`
- `Import sao luu`
- `Lam moi`

Bang backup hien tai giu nguyen, co the them tab nho trong backup:

- `Ban sao luu`
- `Lich su khoi phuc`

Modal preview nen uu tien tinh ro rang:

- Canh bao mau do/cam khi restore mode co ghi de.
- Hien tong so collections va tong documents.
- Hien collections duoc chon va tac dong truoc khi nut restore duoc enable.
- Neu file backup khong tuong thich, modal chi cho xem loi va khong cho restore.

## 6. Acceptance Criteria

- Nguoi co quyen backup restore thay nut `Import sao luu` trong `/system` -> tab backup.
- Chon file backup hop le se mo modal tong quan tat ca collections trong file.
- Modal hien document count trong file va document count hien tai cua tung collection.
- Khong restore du lieu khi moi upload file; restore chi chay sau khi user xac nhan.
- Restore job co trang thai `queued/running/success/failed` va frontend co polling.
- Truoc restore thanh cong/thuc thi, he thong tao backup hien trang database.
- Neu file sai dinh dang, qua lon, hong gzip/archive, API tra loi ro va khong ghi du lieu.
- Neu dang co backup/restore job chay, API tu choi job moi bang `409 Conflict`.
- Tat ca API restore co guard JWT + permission.
- Khong co path/file system leak trong response.
- Co unit/e2e test cho preview, validation, permission va restore confirmation.

## 7. Test Scope

Backend:

- Unit test detect format backup.
- Unit test parse fallback NDJSON gzip.
- Unit test validate restore DTO.
- Unit test block restore neu `confirmationText` khong dung.
- Unit test block concurrent backup/restore job.
- E2E test:
  - Khong co quyen -> 403.
  - Upload file sai dinh dang -> 400.
  - Upload file hop le -> tra preview collections.
  - Restore selected collections -> tao job.

Frontend:

- Test API client multipart upload.
- Test modal:
  - Loading state.
  - Error state.
  - Collection checkbox.
  - Restore button disabled/enabled dung dieu kien.
  - Submit payload dung.

## 8. Ngoai pham vi

- Khong yeu cau restore truc tiep len production neu chua co human approval.
- Khong xay dung lich restore tu dong.
- Khong chinh sua schema nghiep vu cua cac collection.
- Khong expose noi dung document day du trong modal preview.
- Khong import file tu URL ben ngoai trong phase nay.

## 9. De xuat thu tu thuc hien

1. Them permission `DATABASE_BACKUP_RESTORE`.
2. Them backend DTO/schema restore job.
3. Them upload preview endpoint va parser cho fallback NDJSON gzip.
4. Them xu ly MongoDB archive gzip bang temp database.
5. Them restore endpoint voi auto pre-restore backup va job polling.
6. Them frontend API client.
7. Them nut import, modal preview va restore confirm trong `/system`.
8. Them test backend/frontend.
9. Chay test va review security.
