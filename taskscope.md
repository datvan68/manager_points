# Task Scope: Xu ly warning duplicate schema index cho Notification.deletedAt

## Muc tieu

Xu ly warning khi backend khoi dong:

```text
Warning: mongoose: Duplicate schema index on {"deletedAt":1} for model "Notification"
```

Dam bao schema `Notification` chi khai bao mot index duy nhat cho `deletedAt`, khong lam thay doi hanh vi soft delete va cac query notification hien tai.

## Hien trang lien quan

File chinh can kiem tra:

- `backend/src/notifications/schemas/notification.schema.ts`

Trong schema hien tai, field `deletedAt` dang duoc khai bao index hai lan:

```ts
@Prop({ type: Date, default: null, index: true })
deletedAt?: Date | null;
```

va:

```ts
NotificationSchema.index({ deletedAt: 1 });
```

Mongoose canh bao vi hai khai bao nay cung tao index don truong `{ deletedAt: 1 }` cho model `Notification`.

## Root Cause

`index: true` tren `@Prop({ deletedAt })` tu dong dang ky single-field index `{ deletedAt: 1 }`.

Dong `NotificationSchema.index({ deletedAt: 1 })` o cuoi file dang dang ky lai cung mot index, tao duplicate schema index warning.

Day la warning o tang schema/index declaration, khong phai loi data hay loi query runtime.

## Pham vi can sua

### 1. Chuan hoa khai bao index

Chi giu mot nguon khai bao index cho `deletedAt`.

Khuyen nghi:

```ts
@Prop({ type: Date, default: null })
deletedAt?: Date | null;
```

va giu:

```ts
NotificationSchema.index({ deletedAt: 1 });
```

Ly do:

- Cac index phuc hop cua `NotificationSchema` dang duoc khai bao tap trung bang `NotificationSchema.index(...)`.
- Cach nay giup nhin danh sach index cua collection o mot vi tri ro rang hon.
- Khong lam thay doi y nghia cua field `deletedAt`.

Phuong an thay the chap nhan duoc:

- Giu `index: true` tren `@Prop({ deletedAt })`.
- Xoa dong `NotificationSchema.index({ deletedAt: 1 })`.

Khong nen giu ca hai.

### 2. Kiem tra cac index lien quan

Kiem tra lai cac index trong `NotificationSchema`:

```ts
NotificationSchema.index({ recipientUserId: 1, readByUserIds: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ deletedAt: 1 });
```

Dam bao khong co index nao khac trung hoan toan voi index duoc tao tu `@Prop({ index: true })`.

Luu y: cac field `type`, `readByUserIds`, `recipientUserId`, `targetRole` dang co `index: true`. Warning hien tai chi ro duplicate tren `{ deletedAt: 1 }`, nhung nen tranh them duplicate tuong tu khi bo sung index moi.

### 3. Khong thay doi logic soft delete

Khong thay doi cac query/filter hien tai trong:

- `backend/src/notifications/notifications.service.ts`

Cac filter nhu sau van phai giu nguyen:

```ts
{ deletedAt: null }
```

Va thao tac xoa mem van set:

```ts
{ $set: { deletedAt: new Date() } }
```

### 4. Kiem tra database index hien huu

Can phan biet hai truong hop:

- Warning schema duplicate: sua code schema la het warning khi khoi dong.
- Database da co index duplicate/du thua voi ten khac: co the can review index tren MongoDB rieng.

Trong scope nay chi xu ly duplicate schema declaration. Khong drop index database neu chua co yeu cau ro rang va chua co approval.

## Acceptance Criteria

- Backend khoi dong khong con warning:
  `Duplicate schema index on {"deletedAt":1} for model "Notification"`.
- Model `Notification` van co index `{ deletedAt: 1 }`.
- Cac API notification van loc ban ghi chua xoa bang `deletedAt: null`.
- Soft delete notification van cap nhat `deletedAt` nhu truoc.
- Khong thay doi contract API, DTO, response shape, hay frontend.

## Kiem thu de xuat

1. Chay unit test lien quan:

```bash
npm test -- notifications
```

2. Khoi dong backend va quan sat log startup:

```bash
npm run start:dev
```

3. Kiem tra nhanh cac flow:

- Tao notification moi.
- Lay danh sach notification.
- Soft delete notification.
- Lay danh sach sau khi xoa de dam bao item da xoa khong con hien thi.

4. Neu co moi truong MongoDB local/staging, kiem tra index thuc te cua collection `notifications` de dam bao van co index cho `deletedAt`.

## Ngoai pham vi

- Khong drop index tren MongoDB production.
- Khong thay doi cau truc collection `notifications`.
- Khong doi logic phan quyen notification.
- Khong toi uu lai toan bo query/index notification neu khong co warning hoac yeu cau rieng.
