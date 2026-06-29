# PRODUCTION_READINESS_CHECKLIST.md

# Learning Management Platform (LMP) Production Readiness Checklist (Phase 6)

Muc tieu: co mot quy trinh release production co the lap lai, co bang chung, co rollback ro rang, va co smoke test matrix de ra quyet dinh go/no-go.

## 1. Scope va release gate

Checklist nay bao phu 3 nhom:

1. Deploy gate truoc khi release.
2. Rollback plan khi release gap su co.
3. Smoke test matrix sau deploy.

Go-live chi duoc thuc hien khi tat ca gate P0/P1 pass.

## 2. Vai tro va phan cong

| Vai tro | Trach nhiem | Bat buoc co mat |
|---|---|---|
| Release owner | Dieu phoi release, xac nhan gate, quyet dinh go/no-go | Co |
| App operator | Deploy Vercel, verify app health | Co |
| Data operator | Chay backup/export, theo doi migration | Co |
| QA verifier | Chay smoke test matrix, ghi ket qua | Co |
| Incident communicator | Cap nhat trang thai cho stakeholder | Co |

## 3. Pre-deploy gate (truoc production)

### 3.1. Code quality va test

- [ ] `pnpm lint` pass.
- [ ] `pnpm test` pass.
- [ ] `pnpm test:integration` pass (neu local Supabase stack san sang).
- [ ] E2E smoke subset pass tren env release candidate.

### 3.2. Security va secret hygiene

- [ ] `pnpm security:scan` pass.
- [ ] Khong co file trong `backups/` bi track.
- [ ] `.env.local` va service role key khong xuat hien trong source control.

### 3.3. Data safety

- [ ] Chay backup/export du lieu quan trong:
  - `pnpm ops:export:critical -- --outputDir=backups`
- [ ] Kiem tra `manifest.json` cua backup.
- [ ] Luu backup vao noi luu tru noi bo da ma hoa.

### 3.4. Change impact

- [ ] Da review migration SQL (neu co).
- [ ] Da review SERVICE_CONTRACT thay doi (neu co).
- [ ] Da xac nhan khong co breaking change voi luong teacher/student chinh.
- [ ] Da xac nhan migration moi cho `global_notifications`, `question_bank_items`, `course_assessment_results`, `personal_library_settings` da ap dung day du.
- [ ] Da xac nhan luong `teacher gui yeu cau mo lop / mod-admin duyet`, `teacher duyet yeu cau tham gia lop` hoac bat `duyet tu dong`, va `admin tao tai khoan sinh vien/nhan su` khong bi lech voi UI production.

## 4. Deploy procedure (Vercel + Supabase Cloud)

### 4.1. Chuan bi release

1. Chot commit release + tag noi bo.
2. Dong bang thay doi schema ngoai release scope.
3. Thong bao maintenance window (neu can).

### 4.2. Database migration

1. Chay migration tren staging truoc.
2. Chay smoke test staging.
3. Chay migration production theo quy trinh team (Supabase migration pipeline).
4. Xac nhan migration status khong loi.

### 4.3. App deploy

1. Deploy release build len production tren Vercel.
2. Xac nhan health endpoint:
   - `GET /api/health` tra ve 200.
3. Xac nhan env vars production day du.

### 4.4. Post-deploy verification

1. Chay smoke test matrix (Section 6).
2. Xac nhan khong co P0/P1 fail.
3. Chot go-live trong release log.

## 5. Rollback plan

### 5.1. Trigger rollback

Rollback ngay neu gap 1 trong cac dieu kien:

- P0 auth fail (khong login duoc teacher/student).
- Data permission fail (student thay du lieu ngoai scope).
- Submission/import flow fail tren phan lon user.
- Error rate tang dot bien va khong the hotfix nhanh.

### 5.2. App rollback (Vercel)

1. Tam dung release moi.
2. Promote deployment on dinh truoc do.
3. Xac nhan lai health endpoint + smoke test P0.

### 5.3. Data rollback strategy

Nguyen tac uu tien:

1. Forward-fix migration neu co the (uu tien).
2. Neu bat buoc rollback data, dung backup gan nhat:
   - Chon backup theo `manifest.json`.
   - Khoi phuc tren staging de verify truoc.
   - Ap dung production theo tung bang co kiem soat.

### 5.4. Incident logging

- [ ] Ghi lai timeline su co.
- [ ] Ghi root cause tam thoi.
- [ ] Ghi hanh dong rollback da thuc hien.
- [ ] Tao follow-up action items.

## 6. Smoke test matrix (production post-deploy)

| ID | Domain | Scenario | Role | Expected | Priority | Ket qua |
|---|---|---|---|---|---|---|
| SMK-001 | Auth | Dang nhap thanh cong va vao dung dashboard | teacher | Redirect dung scope | P0 | [ ] Pass / [ ] Fail |
| SMK-002 | Auth | Dang nhap thanh cong va vao My Classes | student | Redirect dung scope | P0 | [ ] Pass / [ ] Fail |
| SMK-003 | Classroom | Teacher vao classroom room va tao announcement | teacher | Tao thanh cong, co flash success | P0 | [ ] Pass / [ ] Fail |
| SMK-004 | Classroom | Student gui direct message den teacher | student | Gui thanh cong, co flash success | P0 | [ ] Pass / [ ] Fail |
| SMK-005 | Permissions | Student khong xem duoc du lieu ngoai class membership | student | Bi chan boi service/RLS | P0 | [ ] Pass / [ ] Fail |
| SMK-006 | Materials | Student mo material da publish | student | Co view/download theo quyen | P1 | [ ] Pass / [ ] Fail |
| SMK-007 | Assessments | Teacher xem trang ket qua assessment | teacher | Load du lieu binh thuong | P1 | [ ] Pass / [ ] Fail |
| SMK-008 | Export | Teacher export CSV/XLSX ket qua assessment | teacher | File tai xuong duoc | P1 | [ ] Pass / [ ] Fail |
| SMK-009 | Simulations | Teacher mo trang simulations va chay widget mau | teacher | Widget render, input hop le | P2 | [ ] Pass / [ ] Fail |
| SMK-010 | Activity logs | Action quan trong tao duoc activity log | teacher | Dashboard recent activity co ban ghi moi | P1 | [ ] Pass / [ ] Fail |
| SMK-011 | API health | Health endpoint | system | `/api/health` tra ve 200 | P0 | [ ] Pass / [ ] Fail |
| SMK-012 | Notifications | Admin/Mod dang thong bao chung, Giang vien doc duoc | admin, moderator, teacher | Gui thanh cong va hien tren dashboard dung quyen | P1 | [ ] Pass / [ ] Fail |
| SMK-013 | User management | Admin tao tai khoan giang vien hoac moderator | admin | Tai khoan tao thanh cong, profile/role dung | P0 | [ ] Pass / [ ] Fail |
| SMK-014 | Personal library | Giang vien upload vao Thu vien ca nhan trong quota | teacher | Upload thanh cong, usage cap nhat dung | P1 | [ ] Pass / [ ] Fail |
| SMK-015 | Personal library quota | Upload vuot quota Thu vien ca nhan bi chan | teacher | He thong tra validation loi ro rang | P1 | [ ] Pass / [ ] Fail |
| SMK-016 | Enrollment approval | Sinh vien gui yeu cau tham gia lop, chi giang vien duyet duoc | student, teacher | Teacher duyet duoc, Mod/Admin khong thay action duyet yeu cau tham gia lop | P0 | [ ] Pass / [ ] Fail |
| SMK-016A | Auto enrollment approval | Giang vien bat `duyet tu dong`, sinh vien gui yeu cau tham gia lop | teacher, student | Yeu cau moi duoc chap nhan ngay, sinh vien vao lop ma khong can thao tac duyet tay | P0 | [ ] Pass / [ ] Fail |
| SMK-017 | Question bank | Giang vien gan cau hoi tu ngan hang de thi vao bai kiem tra | teacher | Lien ket tao thanh cong dung theo hoc phan | P1 | [ ] Pass / [ ] Fail |
| SMK-018 | Course assessment aggregate | Ket qua import/webhook duoc tong hop theo hoc phan va hien cho Mod sau khi giang vien nop | teacher, moderator | `course_assessment_results` duoc cap nhat dung va bang `Kết quả đánh giá học phần` hien du lieu dung | P1 | [ ] Pass / [ ] Fail |
| SMK-019 | Class resource scope | Giang vien mo trang `Tài nguyên lớp học` tu `Man chieu`, `Tu tai lieu`, `Thanh phan cua bai giang` hoac `Tai lieu doc them` | teacher | Chi hien `Tài liệu dùng chung` va tai nguyen gan voi dung hoc phan cua lop hien tai | P1 | [ ] Pass / [ ] Fail |

## 7. Go/No-Go criteria

Go khi:

- Tat ca test P0 pass.
- Khong co issue P1 dang mo chua co mitigation.
- Release owner + app operator + QA verifier dong y.

No-Go khi:

- Bat ky P0 fail.
- Co rui ro du lieu chua co rollback path.
- Khong co bang chung backup truoc release.

## 8. Release evidence can luu

- [ ] Commit/tag release.
- [ ] Log output cua `pnpm lint`, `pnpm test`, `pnpm security:scan`.
- [ ] Duong dan backup folder + `manifest.json`.
- [ ] Ket qua smoke test matrix da dien.
- [ ] Quyết dinh go/no-go va nguoi phe duyet.
- [ ] Bang doi chieu rule hien hanh: notifications, question bank, personal library quota, duyet truy cap, yeu cau mo lop, duyet tu dong yeu cau vao lop, pham vi `Tài nguyên lớp học`, Mod quan ly hoc phan truc tiep, User management.

## 9. Delta follow-up sau release

- [ ] Tao issue cho moi fail/flake trong smoke test.
- [ ] Cap nhat ROADMAP phase 6 neu release gate da pass.
- [ ] Cap nhat huong dan su dung giang vien neu luong UI thay doi.
