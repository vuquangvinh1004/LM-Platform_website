# OPERATIONS_BACKUP_EXPORT_CHECKLIST.md

# Learning Management Platform (LMP) Backup and Export Checklist (Phase 6)

Muc tieu: giam rui ro van hanh som bang quy trinh backup/export co the lap lai, de audit duoc va rollback duoc.

Tai lieu lien quan:

- `PRODUCTION_READINESS_CHECKLIST.md` cho deploy + rollback + smoke test matrix.

## 1. Pham vi backup quan trong

Du lieu can backup trong Phase 6 baseline:

- `profiles`
- `courses`
- `classes`
- `class_members`
- `materials`
- `assessments`
- `submissions`
- `simulations`
- `class_announcements`
- `direct_messages`
- `import_jobs`
- `activity_logs`
- `enrollment_requests`
- `permission_scopes`

Ghi chu:

- File backup la du lieu nhay cam noi bo. Khong commit vao Git.
- Thu muc backup mac dinh: `backups/<timestamp>/`.

## 2. Preflight truoc khi backup

1. Xac nhan `.env.local` co `NEXT_PUBLIC_SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY`.
2. Chay scan truoc van hanh:

```bash
pnpm security:scan
```

3. Dam bao thu muc `backups/` dang bi ignore boi `.gitignore`.

## 3. Chay backup/export du lieu quan trong

Lenh chuan:

```bash
pnpm ops:export:critical
```

Tuy chon thay doi output folder:

```bash
pnpm ops:export:critical -- --outputDir=backups
```

Ket qua mong doi:

- Tao 1 thu muc timestamp moi.
- Moi bang co file JSON rieng.
- Co `manifest.json` tong hop so dong va bang da skip (neu co).

## 4. Verification sau backup

1. Mo `manifest.json`, kiem tra:
   - co `generatedAt` hop le,
   - `tables` co rowCount > 0 voi bang nghiep vu dang su dung.
2. Lay random 2-3 file de check schema fields.
3. So sanh nhanh voi export nghiep vu:
   - Trang ket qua assessment export CSV/XLSX van chay duoc.

## 5. Chinh sach luu tru backup

1. Khong de backup tren may local qua lau.
2. Neu can luu dai han, dua vao kho luu tru noi bo da ma hoa.
3. Dat retention khuyen nghi:
   - daily: giu 7 ban gan nhat,
   - weekly: giu 4 ban,
   - monthly: giu 3 ban.

## 6. Tinh huong rollback/co so du lieu loi

1. Dong bang luong import/write tam thoi.
2. Chon ban backup gan nhat trong `manifest.json`.
3. Khoi phuc co kiem soat tren moi truong staging truoc.
4. Xac nhan test smoke (auth, class access, material access, assessment results) truoc khi mo lai ghi du lieu.

## 7. Checklist thao tac (copy nhanh)

- [ ] Da chay `pnpm security:scan`.
- [ ] Da chay `pnpm ops:export:critical` thanh cong.
- [ ] Da co `manifest.json` va row count hop ly.
- [ ] Thu muc backup khong nam trong tracked files.
- [ ] Da luu backup theo chinh sach retention noi bo.
