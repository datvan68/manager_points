# Taskscope: Import/restore sai BSON type MongoDB

## Ket luan

Co van de that su trong luong import/restore fallback NDJSON. Neu file import chua du lieu o dang JSON thuong nhu:

```json
{
  "_id": "6a34de61ab48320e82082214",
  "role": "6a333d30b636c1806e45733d",
  "createdAt": "2026-06-19T06:14:57.657Z"
}
```

thi MongoDB se luu cac field nay thanh `string`, khong phai `ObjectId`/`Date`. Anh chup dang cho thay `_id`, `role`, `date_birth`, `createdAt`, `updatedAt` co dau hieu bi luu sai BSON type.

Nhanh `mongorestore` tu file `mongodump archive` van la huong dung vi giu duoc BSON type. Van de nam o nhanh fallback/custom NDJSON.

## Bang chung trong code hien tai

- `backend/src/system/system.service.ts` dung `EJSON.stringify()` khi tao backup fallback, nen file do he thong tu sinh ra co the giu type neu duoc parse dung.
- `previewBackupImport()` va `runBackupAndRestoreAsync()` dung `EJSON.parse(line)`. `EJSON.parse()` chi chuyen ve `ObjectId`/`Date` khi input la Extended JSON chuan, vi du `{ "$oid": "..." }`, `{ "$date": "..." }`.
- `insertDocsSafe()` ghi truc tiep bang `this.connection.collection(collectionName).insertMany(docs)` / `bulkWrite()`, nen bo qua Mongoose schema casting.
- `insertDocsSafe()` chi xu ly rieng `_id.$oid` trong mode `merge_upsert`; khong normalize `_id` dang string, khong normalize reference fields nhu `users.role`, `students.user_id`, `classes.dept_id`, `roles.permissions`, va khong normalize date fields.

## Nguyen nhan goc

1. Import fallback chap nhan NDJSON nhung khong bat buoc file phai la Extended JSON chuan.
2. He thong parse bang `EJSON.parse()`, nhung input JSON thuong van ra object JSON thuong.
3. Ghi bang native Mongo collection nen Mongoose khong tu cast type.
4. Khong co validation truoc khi restore de bao loi field sai type.
5. Parser dang `chunk.toString().split('\n')` va swallow loi parse, co the mat dong neu JSON line bi cat ngang chunk.

## Anh huong

- `users._id` sai type lam lookup theo `new ObjectId(userId)` khong tim thay user.
- `users.role` sai type lam populate role/permission va RBAC co the fail.
- Cac reference nhu `student.user_id`, `student.class_id`, `class.dept_id`, `academic_records.student_id`, `semester_id`, `criterion_id` co the mat lien ket.
- Date fields thanh string lam sort/filter theo ngay, TTL index, report theo khoang ngay sai ket qua.
- Mode `merge_upsert` co the tao duplicate logic: ban ghi cu `_id: ObjectId(...)`, ban ghi import `_id: "..."` la 2 key khac nhau.

## Pham vi xu ly de xuat

### 1. Phan loai format import ro rang

- Uu tien va khuyen nghi chi restore production bang `mongodump` archive + `mongorestore`.
- Neu file la fallback NDJSON, can gan format ro rang: `ndjson_ejson_gzip`.
- Tu choi hoac canh bao manh voi file JSON thuong khong co Extended JSON metadata neu phat hien type mismatch.

### 2. Them normalize BSON type theo schema/collection

Tao mot helper trong `SystemService`, vi du:

```ts
normalizeMongoTypes(collectionName: string, doc: Record<string, any>): Record<string, any>
```

Khong convert moi chuoi 24 hex tren toan document. Chi convert cac field duoc khai bao theo map.

Map toi thieu can co:

- `users`: `_id`, `role` -> `ObjectId`; `date_birth`, `locked_until`, `createdAt`, `updatedAt` -> `Date`.
- `roles`: `_id`, `permissions[]` -> `ObjectId`; timestamps -> `Date`.
- `permissions`, `permissiongroups`, `routepermissions`: `_id`, cac mang permission/ref -> `ObjectId`; timestamps -> `Date`.
- `students`: `_id`, `class_id`, `training_point_id`, `user_id` -> `ObjectId`; `date_bir`, timestamps -> `Date`.
- `classes`: `_id`, `dept_id`, `advisor_id` -> `ObjectId`; timestamps -> `Date`.
- `departments`, `categories`, `criteria`, `semesters`, `evaluationperiods`: `_id` va cac ref field lien quan -> `ObjectId`; timestamps/date fields -> `Date`.
- `academicrecords`, `summarypoints`, `dailyclassreports`, `studenttasks`, `studenttaskprogresses`, `notifications`: `_id` va cac ref field/mang ref -> `ObjectId`; date/timestamps -> `Date`.
- `system_requests`, `database_backup_jobs`, `database_restore_jobs`, `login_logs`: cac ref user/job -> `ObjectId`; date/timestamps -> `Date`.

Field nghiep vu dang string phai giu nguyen, vi du `user_name`, `student_code`, `class_year`, `role_code`, `email`.

### 3. Validate truoc khi restore

Trong `previewBackupImport()`:

- Lay sample tung collection.
- Chay normalize dry-run.
- Report cac mismatch: collection, field, expected type, actual type, sample value da mask neu can.
- Neu field bat buoc la `ObjectId`/`Date` nhung khong convert duoc thi block restore.
- UI can hien thi canh bao: "File import co field sai BSON type, khong the khoi phuc an toan".

### 4. Sua import fallback de khong swallow loi

- Them line buffer khi doc gzip stream de khong mat JSON line bi split qua chunk.
- Neu line parse loi thi dem loi va fail job, khong `catch (e) {}` im lang.
- Luu `error_message` ro: collection, line number, reason.

### 5. Sua `insertDocsSafe()`

- Goi `normalizeMongoTypes(collectionName, doc)` truoc `bulkWrite()` / `insertMany()`.
- Trong `merge_upsert`, filter `_id` phai dung type da normalize.
- Neu `_id` khong phai ObjectId sau normalize voi collection yeu cau ObjectId thi fail import, khong insert string `_id`.

### 6. Kiem tra du lieu da bi sai type

Can co script/endpoint noi bo chi doc de scan cac collection quan trong:

```js
db.users.aggregate([
  {
    $project: {
      _id: 1,
      idType: { $type: "$_id" },
      roleType: { $type: "$role" },
      createdAtType: { $type: "$createdAt" }
    }
  },
  {
    $match: {
      $or: [
        { idType: { $ne: "objectId" } },
        { roleType: { $ne: "objectId" } },
        { createdAtType: { $ne: "date" } }
      ]
    }
  }
])
```

Neu da co du lieu sai type, khong nen sua bang tay tren production. Can backup truoc, sau do chay migration co whitelist field theo collection.

## Khong nen lam

- Khong convert tat ca chuoi 24 ky tu thanh `ObjectId` toan cuc.
- Khong restore file JSON thuong vao production khi chua co validation type.
- Khong chi sua frontend hien thi, vi loi nam o du lieu BSON trong DB.
- Khong dua vao Mongoose auto-cast neu van dung native `connection.collection()`.

## Acceptance criteria

- Import fallback tu Extended JSON giu dung `_id: ObjectId`, reference fields la `ObjectId`, date fields la `Date`.
- Import file JSON thuong co `_id`/reference/date dang string phai bi block hoac duoc normalize theo schema map truoc khi insert.
- Preview hien thi type mismatch truoc khi nguoi dung bam restore.
- Restore khong tao duplicate do `_id` string vs `_id` ObjectId.
- Parser khong bo qua dong loi im lang.
- Co test cho `users.role`, `students.user_id`, `classes.dept_id`, `roles.permissions[]`, `createdAt/updatedAt`.

## Test de xuat

- Unit test `normalizeMongoTypes()` voi:
  - `_id` string hop le -> `Types.ObjectId`.
  - `role` string hop le -> `Types.ObjectId`.
  - `createdAt` ISO string -> `Date`.
  - `user_name`/`student_code` giu string.
  - ObjectId string khong hop le o ref field -> fail.
- Unit test `insertDocsSafe()` mode `merge_upsert` dung `_id` ObjectId trong filter.
- Integration test restore NDJSON EJSON va NDJSON JSON thuong cho collection `users`.
- Regression test parser gzip voi JSON line bi split qua chunk.
