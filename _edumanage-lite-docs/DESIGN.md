---
version: alpha
name: Learning Management Platform (LMP)
description: "Glossary và design constitution cho UI học thuật, đáng tin cậy, nhất quán của LMP"
colors:
  primary: "#0f766e"
  secondary: "#0369a1"
  neutral: "#f8fafc"
  on-primary: "#f8fafc"
  on-neutral: "#0f172a"
  error: "#b91c1c"
  success: "#166534"
typography:
  h1:
    fontFamily: "Be Vietnam Pro"
    fontSize: "2rem"
    fontWeight: "700"
  body-md:
    fontFamily: "Be Vietnam Pro"
    fontSize: "1rem"
    fontWeight: "400"
  label-sm:
    fontFamily: "Be Vietnam Pro"
    fontSize: "0.875rem"
    fontWeight: "500"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#115e59"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  badge-active:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  badge-archived:
    backgroundColor: "#cbd5e1"
    textColor: "#1e293b"
    rounded: "{rounded.sm}"
  surface-default:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-neutral}"
    rounded: "{rounded.lg}"
  back-text-link:
    textColor: "{colors.secondary}"
    icon: "left-arrow"
    placement: "top-left-before-page-title"
    usage: "Dùng để quay về trang cha hoặc trang trước; không hiển thị như button viền."
---

# DESIGN

Tai lieu nay dong vai tro nhu mot `glossary` va `source of truth` cho cac quy uoc thiet ke giao dien trong LMP. Khi xay dung UI moi, uu tien doc file nay ben canh `SPEC_FINAL.md`, `ARCHITECTURE.md` va `ROADMAP.md` de giu tinh thong nhat ve mau sac, typography, spacing, trang thai va cac pattern dieu huong.

## 1. Product Feel

UI cua LMP phai tao cam giac:

- hoc thuat va dang tin cay
- binh tinh, de doc, de quet
- uu tien noi dung tieng Viet va tinh huu dung
- phan biet ro trang thai `active`, `archived`, `pending`, `error`

Khong dung phong cach qua giong landing page marketing, qua nhieu hieu ung, hoac palette mang tinh trinh dien.

## 2. Design Glossary

### 2.1. Primary

- Mau hanh dong chinh cua man hinh.
- Chi dung cho 1 CTA quan trong nhat trong mot context.
- Token: `{colors.primary}`.

### 2.2. Secondary

- Mau cho text-link, dieu huong phu, hoac nhan manh cap hai.
- Khong dung de canh tranh voi CTA chinh.
- Token: `{colors.secondary}`.

### 2.3. Neutral Surface

- Nen mat dinh cho page, card, bang va vung doc noi dung.
- Giao dien phai uu tien nen sang, tuong phan ro, khong dung dark surface lam mac dinh.
- Token: `{colors.neutral}`.

### 2.4. Success / Error

- `success`: dung cho trang thai thanh cong, kha dung, active.
- `error`: dung cho loi, tu choi, canh bao that bai.
- Khong dung hai mau nay lam mau trang tri.

### 2.5. Back Text Link

- Pattern dieu huong quay lai chuan cua he thong.
- Hien o goc trai phia tren, truoc tieu de trang.
- Dung component chung `BackTextLink`.
- Khong thay bang button vien hoac icon don le neu khong co ly do ro rang.

## 3. Typography Rules

- Font uu tien: `Be Vietnam Pro`.
- Heading lon nhat dung `h1`.
- Noi dung doc thong thuong dung `body-md`.
- Nhan/phu de nho dung `label-sm`.
- Khong nen vuot qua 2 font-weight noi bat tren cung mot man hinh neu khong co ly do dac biet.

## 4. Spacing And Shape Rules

- `sm = 8px`
- `md = 16px`
- `lg = 24px`
- `xl = 32px`

Quy uoc:

- Khoang cach ben trong card/form uu tien `md` hoac `lg`.
- Khoang cach giua cac section lon uu tien `lg` hoac `xl`.
- Border radius dung he thong `sm / md / lg`; khong them radius tuy y.

## 5. Component Glossary

### 5.1. Button Primary

- Dung cho hanh dong nop, tao, luu, xac nhan chinh.
- Nen dung token `button-primary` va `button-primary-hover`.

### 5.2. Badge Active

- Dung cho trang thai kha dung/active/duoc phep.
- Nen thong nhat voi token `badge-active`.

### 5.3. Badge Archived

- Dung cho trang thai luu tru, ngung hoat dong, khong con thao tac chinh.
- Nen thong nhat voi token `badge-archived`.

### 5.4. Surface Default

- Dung cho khung card, block thong tin, bang va panel.
- Nen text tren surface nay phai uu tien `{colors.on-neutral}`.

## 6. Screen-Level Rules

- Moi man hinh can co hierarchy ro: back link (neu can), title, subtitle/guide, content chinh, actions.
- Form dai can tach theo nhom logic, tranh nhieu cum truong khong co caption.
- Bang du lieu phai uu tien kha nang quet: header ro, width hop ly, text alignment nhat quan.
- Empty state phai noi ro hien dang thieu du lieu gi, thay vi chi de khung trong.
- Error state phai cu the va co tinh hanh dong, khong chi hien “Da co loi”.

## 7. Do And Don't

### Do

- Dung token trong file nay khi chon mau, spacing, radius, typography.
- Tai su dung component chung khi pattern da ton tai.
- Giu giao dien sang, ro, uu tien hoc thuat va van hanh.
- Dung text tieng Viet nhat quan trong UI.

### Don't

- Khong hardcode palette ngau nhien khi da co token.
- Khong tron nhieu phong cach button/link tren cung mot man hinh.
- Khong dung qua nhieu mau nhan manh cung luc.
- Khong bien page van hanh thanh giao dien marketing.

## 8. Usage Contract

- Khi mo rong design system, cap nhat file nay truoc hoac dong thoi voi implementation.
- Neu mot component/pattern moi duoc su dung lap lai nhieu noi, bo sung no vao file nay nhu mot quy uoc moi.
- Neu UI hien tai lech token trong file nay, xem do la technical/design debt va ghi chu ro trong code/docs lien quan.
