# Huong dan su dung cho giang vien (Learning Management Platform - LMP)

Tai lieu nay mo ta cac luong van hanh can ban cho giang vien trong phien ban hien tai. Website da ho tro bai kiem tra external qua Google/Microsoft Form va co luong internal runtime cho mot so contract noi bo, nen cac buoc duoi day tap trung vao luong van hanh thuc te dang dung trong giao dien.

## 1. Dang nhap va vao dashboard

1. Mo trang dang nhap: /login.
2. Dang nhap bang email + mat khau.
3. Sau khi dang nhap thanh cong, he thong dieu huong den dashboard giang vien.

Neu dang nhap thanh cong nhung khong vao dung khu vuc role, lien he admin de kiem tra User management va role profile.

## 2. Quan ly hoc phan

1. Vao trang hoc phan: /courses.
2. Tao hoc phan moi voi ma hoc phan, ten hoc phan, mo ta.
3. Cap nhat trang thai hoc phan theo nhu cau (draft/active/archived).

Khuyen nghi:

- Chi archive hoc phan khi da ket thuc hoc ky.
- Khong hard-delete hoc phan da co du lieu lop, tai lieu, ket qua.

## 3. Quan ly lop hoc

1. Vao trang lop hoc: /classes.
2. Tao lop hoc gan voi hoc phan.
3. Them sinh vien thu cong hoac import CSV.

### 3.1. Import CSV sinh vien

Header khuyen nghi:

- fullName hoac full_name hoac ho ten
- email (khuyen nghi)
- studentCode hoac student_code hoac ma sinh vien

Buoc thuc hien:

1. Chon file CSV.
2. Bam Nhap CSV.
3. Kiem tra thong bao ket qua: so dong da them, dong bi bo qua.

Luu y:

- He thong bo qua dong trung membership active.
- Dong loi duoc tra ve voi ly do de xu ly lai.

## 4. Quan ly phong hoc truc quan

Trang phong hoc: /classes/{classId}/room

Giang vien co the:

- Dang thong bao lop hoc.
- Gui tin nhan truc tiep den sinh vien.
- Theo doi tai lieu va mo phong gan voi lop.

Sau thao tac thanh cong, he thong hien flash message va ghi activity log cho hanh dong quan trong.

## 5. Quan ly bai kiem tra va ket qua

1. Vao trang bai kiem tra: `/assessments`.
2. Tao bai kiem tra voi provider phu hop (Google Form/Microsoft Form) hoac chon mode noi bo neu giao dien/contract hien thi.
3. Vao trang ket qua assessment de theo doi submissions va ket qua tong hop.

### 5.1. Export ket qua

Tai trang ket qua assessment:

- Export CSV
- Export XLSX

File export ton trong theo quyen va bo loc status neu co.

## 6. Import ket qua submissions tu CSV

He thong ho tro import theo assessment scope voi xu ly idempotent.

Header khuyen nghi:

- studentCode (bat buoc, khoa doi chieu chinh)
- fullName (bat buoc neu co san)
- email (khuyen nghi)
- score (bat buoc)
- submitted_at (tuy chon)
- source (tuy chon, vi du `Google Form`)
- note (tuy chon)

Nguyen tac quan trong:

- Dong loi khong lam hong toan bo import.
- Co tong hop successRows/errorRows sau import.
- Co activity log sau khi import hoan tat.
- He thong doi chieu chinh theo `studentCode`; cac truong ten, email co the thay doi theo profile sinh vien.

## 6.1. Tai file mau

Khi import ket qua, giang vien nen tai file mau CSV/XLSX truoc de diền dung thu tu cot va ten header. File mau phai co san header tieng Viet co dau va mot dong vi du.

## 7. Duyet truy cap sinh vien

Trang duyet truy cap: /access-review

Giang vien co the:

- Duyet yeu cau truy cap
- Gia han truy cap
- Theo doi trang thai access lifecycle

## 8. Quy trinh van hanh an toan truoc khi thao tac lon

Truoc khi import hang loat hoac release:

1. Chay backup/export theo huong dan:
   - xem OPERATIONS_BACKUP_EXPORT_CHECKLIST.md
2. Chay security scan:
   - pnpm security:scan

## 9. Troubleshooting nhanh

1. Khong dang nhap duoc:
   - Kiem tra email/password.
   - Kiem tra role profile va trang thai tai khoan.
2. Import CSV loi:
   - Kiem tra header va gia tri score/date.
   - Xu ly lai cac dong trong danh sach error.
3. E2E/integration khong chay local:
   - Dam bao Docker Desktop dang chay.
   - Dam bao Supabase local stack reachable.

## 10. Quan ly thoi gian lam bai

Voi cac bai kiem tra co thiet lap thoi luong:

- Sinh vien phai bam `Bat dau lam bai` moi bat dau dem thoi gian.
- He thong se luu thoi diem bat dau theo tung sinh vien, khong phu thuoc vao browser client.
- Neu da het gio, nut mo bai se bi khoa va chi hien thong bao het thoi gian.
- Neu giang vien dong bai, sinh vien khong the bat dau moi ngay ca khi refresh hay dang nhap lai.

## 11. Kenh evidence khi van hanh

Moi release nen luu:

- Ket qua lint/test/security.
- Ket qua smoke matrix.
- Backup manifest.
- Quyet dinh go/no-go.

Xem them: PRODUCTION_READINESS_CHECKLIST.md

---

## 12. Trang thai hien tai

- Guide nay da dong bo voi web hien tai: class management, classroom visual layout, library, assessment import/export va dashboard.
- Phan import ket qua va file mau la diem quan trong nhat de tranh loi font/loi mapping khi phuc vu giang vien thuc te.
- Neu co lay mot tu khoa: `studentCode` la khoa doi chieu on dinh; `fullName` va `email` co the thay doi theo profile sinh vien.
