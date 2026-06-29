# ARCHITECTURE.md

# Learning Management Platform (LMP) ARCHITECTURE

## 1. Vai trò của file này

File này là **nguồn chân lý kiến trúc** cho dự án Learning Management Platform (LMP). AI Agent phải đọc file này trước khi code và không được tự ý thay đổi tech stack, boundaries, schema, service contract hoặc storage layout nếu chưa cập nhật tài liệu liên quan.

---

## 2. Tóm tắt kiến trúc

LMP sử dụng mô hình full-stack TypeScript với Next.js và Supabase:

```text
Browser
  ↓
Next.js App Router
  ↓
Server Actions / API Routes
  ↓
Service Layer
  ↓
Repository Layer / Integration Adapters
  ↓
Supabase PostgreSQL / Supabase Storage / External Forms
```

Mục tiêu kiến trúc là giữ website nhẹ, dễ mở rộng, bảo mật theo quyền lớp học và tránh phụ thuộc vào một module quiz phức tạp trong phiên bản đầu.

---

## 3. Tech stack chính thức

| Lớp | Công nghệ |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js Server Actions và API Routes |
| Database | Supabase PostgreSQL |
| User management & login | Supabase Auth + profile/role layer |
| Storage | Supabase Storage private buckets + signed URLs |
| Validation | Zod |
| Charts | Recharts hoặc thư viện tương thích React |
| Export | SheetJS/xlsx hoặc CSV generator server-side |
| Testing | Vitest, React Testing Library, Playwright |
| Deployment | Vercel + Supabase Cloud |

---

## 4. Kiến trúc module

```text
app/
  (auth)/            Đăng nhập và xem trước lớp mở đăng ký
  (teacher)/         Dashboard và chức năng giảng viên
  (admin)/           Khu vực quản trị và User management
  (student)/         Trang học tập của sinh viên
  api/               Webhook, export, server-only endpoints

components/
  ui/                Component giao diện nền tảng
  course/            UI học phần
  class/             UI lớp học
  material/          UI tài liệu
  assessment/        UI bài kiểm tra
  dashboard/         UI biểu đồ/bảng điểm

lib/
  services/          Business logic
  repositories/      Database queries
  integrations/      Google/MS Form adapters, storage helpers
  validators/        Zod schemas
  supabase/          Supabase clients
  utils/             Utilities thuần

simulations/
  registry.ts        Đăng ký mô phỏng
  widgets/           Các widget mô phỏng riêng biệt
```

---

## 5. Boundaries bắt buộc

### 5.1. UI Layer

UI layer chỉ được:

- Render dữ liệu.
- Nhận input người dùng.
- Gọi server action hoặc service facade.
- Hiển thị loading/error/empty state.

UI layer không được:

- Gọi Supabase database trực tiếp nếu logic đó thuộc business rule.
- Tự quyết định quyền truy cập dữ liệu quan trọng.
- Tự xử lý import/sync kết quả.
- Chứa logic provider-specific của Google Form hoặc Microsoft Form.

### 5.2. Service Layer

Service layer chịu trách nhiệm:

- Kiểm tra quyền ở mức nghiệp vụ.
- Điều phối repository, storage và integration adapter.
- Chuẩn hóa lỗi trả về cho UI.
- Áp dụng business rules.

Ví dụ service:

- `CourseService`
- `ClassService`
- `MaterialService`
- `EnrollmentService`
- `AccessControlService`
- `UserManagementService`
- `StudentProfileService`
- `AssessmentService`
- `SubmissionService`
- `DashboardService`
- `GlobalNotificationService`
- `QuestionBankService`
- `PersonalLibraryService`
- `ExportService`

### 5.3. Repository Layer

Repository layer chịu trách nhiệm:

- Query database.
- Mapping dữ liệu database sang domain object đơn giản.
- Không chứa logic UI.
- Không gọi external form provider.

Ví dụ repository:

- `courseRepository`
- `classRepository`
- `materialRepository`
- `assessmentRepository`
- `submissionRepository`

### 5.4. Integration Adapter Layer

Integration adapter chịu trách nhiệm che giấu chi tiết nhà cung cấp bên ngoài:

- `GoogleFormAdapter`
- `MicrosoftFormAdapter`
- `CsvImportAdapter`
- `SupabaseStorageAdapter`

UI và business service không được phụ thuộc trực tiếp vào chi tiết raw response của Google/Microsoft. Mọi provider phải trả về shape nội bộ thống nhất.

---

## 6. Nguyên tắc thiết kế phần mềm áp dụng

Dự án áp dụng các nguyên tắc thiết kế sau để tránh code chắp vá khi dùng AI Agent.

### 6.1. Giảm độ phức tạp là mục tiêu trung tâm

Mọi quyết định kỹ thuật phải được đánh giá bằng câu hỏi: thay đổi sau này có dễ hiểu và ít lan rộng không? Không ưu tiên giải pháp chỉ chạy được trước mắt nhưng làm tăng cognitive load cho lần sửa sau.

### 6.2. Module sâu, interface hẹp

Một module tốt nên có interface đơn giản nhưng xử lý được nhiều chi tiết bên trong. Ví dụ `MaterialService.createSignedDownloadUrl(materialId, userId)` che giấu kiểm tra membership, query metadata, kiểm tra quyền tải và gọi Supabase Storage.

Không tạo nhiều function nông chỉ chuyển tiếp tham số mà không làm giảm độ phức tạp.

### 6.3. Che giấu thông tin

- Component không biết storage path thật.
- Component không biết webhook secret.
- Component không biết cấu trúc raw CSV/Google Sheet.
- Service không biết chi tiết render UI.
- Repository không biết logic hiển thị dashboard.

### 6.4. Khác lớp, khác trừu tượng

Không viết các lớp chỉ pass-through từ UI đến database. Nếu một layer tồn tại, layer đó phải thêm giá trị: validation, authorization, transformation, orchestration hoặc abstraction.

### 6.5. Kéo phức tạp xuống dưới

Các trường hợp đặc biệt như file không cho tải, form không cho nhúng, submission trùng, sinh viên chưa có profile phải được xử lý trong service/adapter để UI nhận thông báo rõ ràng.

### 6.6. Thiết kế để loại bỏ lỗi

Ưu tiên constraint, enum, unique index, validation schema và idempotent import để giảm số lỗi phải xử lý thủ công.

### 6.7. Thiết kế hai lần trước khi chốt module lớn

Với các module quan trọng như sync kết quả form hoặc storage permission, AI Agent phải đề xuất ít nhất 2 phương án ngắn và chọn phương án có interface rõ hơn, ít phụ thuộc hơn.

### 6.8. Comment phục vụ thiết kế

Comment nên giải thích business rule, lý do kiến trúc và quyết định không hiển nhiên. Không comment kiểu lặp lại code. Interface public/service quan trọng cần có comment ngắn mô tả input, output, error behavior.

### 6.9. Tên gọi chính xác và nhất quán

Dùng thống nhất:

| Khái niệm | Tên code |
|---|---|
| Học phần | `course` |
| Lớp học phần | `class` hoặc `courseClass` nếu cần tránh trùng keyword |
| Thành viên lớp | `classMember` |
| Tài liệu | `material` |
| Bài kiểm tra | `assessment` |
| Kết quả/lượt nộp | `submission` |
| Mô phỏng | `simulation` |

Không dùng lẫn `lesson`, `subject`, `module`, `exam`, `quiz` nếu chưa định nghĩa rõ.

---

## 7. Data flow chính

### 7.1. Xem tài liệu

```text
Student opens material page
  → UI calls MaterialService.getReadableMaterial(materialId, userId)
  → Service verifies class membership and material visibility
  → Repository reads material metadata
  → Storage adapter creates signed URL
  → UI renders PDF/download link
```

### 7.2. Tạo bài kiểm tra

```text
Teacher submits assessment form
  → UI validates basic input
  → AssessmentService validates provider URL and teacher permission
  → Repository creates assessment record
  → Activity log records creation
  → UI redirects to assessment detail
```

### 7.3. Import kết quả

```text
Teacher uploads CSV / webhook receives payload
  → Import adapter normalizes rows
  → SubmissionService validates assessment and student identity
  → Repository upserts submissions idempotently
  → DashboardService recalculates summary on read
```

---

## 8. Auth và authorization

### 8.1. Authentication

Supabase Auth quản lý đăng nhập. Bảng `profiles` mở rộng thông tin người dùng.

Trong luồng hiện hành, toàn bộ tài khoản `student`, `teacher` và `moderator` được `admin` khởi tạo trong module `User management`; trang đăng nhập không còn public self-signup.

`access_status` vẫn được giữ để vận hành vòng đời truy cập (`active`, `suspended`, `expired`) và để tương thích với dữ liệu/luồng legacy nếu hệ thống từng có account `student` đi qua nhánh public cũ.

### 8.2. Authorization

Authorization gồm 3 lớp:

1. Route guard trong Next.js middleware/layout.
2. Service-level permission check.
3. Supabase Row Level Security ở database.

Không dựa vào UI-only guard cho dữ liệu nhạy cảm.

### 8.3. Role model chuẩn hóa

| Role | Mô tả |
|---|---|
| `student` | Truy cập học tập theo membership hợp lệ và trạng thái truy cập còn hiệu lực |
| `teacher` | Quản lý lớp mình phụ trách, gửi yêu cầu mở lớp, tạo tài nguyên, ngân hàng đề, bài kiểm tra |
| `moderator` | Giám sát viên vận hành học phần trực tiếp, vận hành Thư viện dùng chung theo học phần, xem kết quả đánh giá học phần và gửi thông báo chung |
| `admin` | Quản trị viên hệ thống: quản lý tài khoản, quota thư viện cá nhân, cấp scope và theo dõi báo cáo tổng hợp |

Ghi chú: role `assistant` cũ được thay thế bởi `moderator` để khớp nghiệp vụ thực tế.

### 8.4. Access lifecycle cho sinh viên

Truy cập học tập của sinh viên phải được đánh giá đồng thời theo 3 điều kiện:

1. `access_status` hợp lệ (`active`).
2. `access_expires_at` chưa quá hạn (hoặc null nếu không giới hạn).
3. Có membership active trong lớp/học phần tương ứng.

Nếu một trong ba điều kiện không đạt, service trả `FORBIDDEN` hoặc `NOT_FOUND` theo ngữ cảnh, và RLS phải chặn tương ứng.

### 8.5. Scoped permissions cho moderator

Phân quyền moderator không phải quyền toàn cục theo role đơn lẻ. Hệ thống vẫn có lớp `permission_scope` để ràng buộc các luồng ngoài học phần theo `course` hoặc `class`, nhưng bản thân nghiệp vụ quản lý học phần hiện do moderator thao tác trực tiếp.

Nguyên tắc:

- Admin cấp/thu hồi scope.
- Teacher không tự cấp scope cho actor khác.
- Mọi service quan trọng (class/material/assessment/submission) phải kiểm scope trước khi thao tác.
- Audit log bắt buộc cho thao tác cấp/thu hồi scope.

### 8.6. Yêu cầu tham gia nhiều học phần

Luồng đăng ký học phần của sinh viên phải đi qua bảng yêu cầu trung gian (`enrollment_requests`) thay vì tạo membership trực tiếp khi sign-up.

Nguyên tắc duyệt:

- Chỉ giảng viên phụ trách lớp mới duyệt yêu cầu tham gia lớp.
- Moderator/Admin không duyệt yêu cầu tham gia lớp; hai vai trò này quản lý duyệt truy cập tài khoản, scope và các yêu cầu cấp học phần/lớp/tài nguyên.

### 8.7. Thông báo chung và thư viện cá nhân

- `global_notifications` là kênh thông báo chung trên dashboard cho `admin`, `moderator`, `teacher`.
- `admin` và `moderator` được tạo thông báo; `teacher` chỉ đọc.
- Mỗi giảng viên có `Thư viện cá nhân` riêng với quota mặc định 50 MB; quota được kiểm tra ở service layer trước khi upload.

---

## 9. Storage architecture

### 9.1. Bucket đề xuất

| Bucket | Trạng thái | Mục đích |
|---|---|---|
| `course-materials` | Private | Tài liệu học tập |
| `course-thumbnails` | Public hoặc private tùy cấu hình | Ảnh đại diện học phần |
| `imports` | Private | File import tạm, có thể xóa theo chính sách |
| `exports` | Private | File export tạm, signed URL ngắn hạn |

### 9.2. Storage path

```text
course-materials/{course_id}/{material_id}/{safe_file_name}
imports/{teacher_id}/{import_job_id}/{file_name}
exports/{teacher_id}/{export_job_id}/{file_name}
```

### 9.3. Quy tắc

- Không lưu file course materials trong public bucket ở v1.
- Không để client tự tạo path tùy ý.
- File name phải sanitize.
- Signed URL phải có thời hạn ngắn.

---

## 10. Error handling

Lỗi trả về từ service phải có shape thống nhất:

```ts
type AppError = {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
};
```

Nhóm lỗi chính:

| Code | Ý nghĩa |
|---|---|
| `UNAUTHORIZED` | Chưa đăng nhập |
| `FORBIDDEN` | Không có quyền |
| `NOT_FOUND` | Không tìm thấy hoặc không được phép thấy |
| `VALIDATION_ERROR` | Dữ liệu đầu vào không hợp lệ |
| `CONFLICT` | Trùng dữ liệu hoặc vi phạm unique rule |
| `EXTERNAL_PROVIDER_ERROR` | Lỗi Google/MS Form hoặc import adapter |
| `STORAGE_ERROR` | Lỗi upload/download/signed URL |

Không nuốt lỗi im lặng. Không hiển thị stack trace cho người dùng cuối.

---

## 11. Business rules cốt lõi

1. Sinh viên chỉ truy cập lớp khi có membership active.
2. Sinh viên chỉ truy cập dữ liệu học tập khi đã được duyệt và chưa quá hạn truy cập.
3. Giảng viên chỉ quản lý học phần/lớp do mình sở hữu hoặc được cấp quyền.
4. Moderator là vai trò vận hành chính của học phần; các scope bổ sung tiếp tục dùng cho lớp, tài nguyên và các luồng liên quan.
5. Admin có thể tạo, vô hiệu hóa và quản lý vòng đời toàn bộ tài khoản; luồng tạo sinh viên đi riêng trong `User management`, không trộn với nhân sự.
6. Chỉ giảng viên phụ trách lớp được duyệt yêu cầu tham gia lớp.
7. Admin không tạo lớp trực tiếp trong workflow chuẩn; giảng viên gửi yêu cầu mở lớp, Mod/Admin duyệt. Học phần là ngoại lệ mới: Mod quản lý trực tiếp, Admin không duyệt học phần. Với thư viện và mô phỏng HTML, Mod xử lý vận hành tài nguyên dùng chung theo học phần, gồm duyệt, ẩn và xóa trực tiếp tài nguyên dùng chung; Admin chỉ giữ governance hệ thống như danh mục và tích hợp native.
8. Khi giảng viên chọn tài nguyên cho lớp từ `Màn chiếu`, `Tủ tài liệu`, `Thành phần của bài giảng` hoặc `Tài liệu đọc thêm`, trang `Tài nguyên lớp học` chỉ hiển thị tài nguyên `dùng chung` và tài nguyên của đúng học phần lớp đó để tránh nhiễu khi thư viện tăng quy mô.
9. Mỗi học phần có ngân hàng đề riêng và một bảng tổng hợp `Kết quả đánh giá học phần` do Mod theo dõi.
9. Kết quả assessment của lớp chỉ đi vào bảng tổng hợp cấp học phần sau khi giảng viên chủ động `NỘP KẾT QUẢ`; bảng mirror nội bộ không còn được xem như một module teacher-facing riêng.
10. Mỗi giảng viên có thư viện cá nhân với quota riêng.
11. Học phần/lớp/tài liệu/bài kiểm tra có dữ liệu liên quan không được hard-delete.
12. File tài liệu private mặc định.
13. Bài kiểm tra v1 là external form link, không phải native quiz.
14. Import kết quả phải idempotent.
15. Dashboard không được tính điểm từ dữ liệu lỗi/chưa xác thực.
16. Mọi thay đổi schema phải đi kèm migration và cập nhật `DATABASE_SCHEMA.md`.

### 11.1. Nguyên tắc profile sinh viên nhẹ

- Bảng profile chỉ lưu thông tin cá nhân và trạng thái truy cập.
- Dữ liệu điểm chi tiết lưu ở `submissions`, không nhúng vào profile.
- Thống kê chung hiển thị profile lấy từ bảng/view tổng hợp để giảm tải đóng gói dữ liệu.
- Badge tách module riêng, không trộn vào core profile.

---

## 12. Testing strategy

| Loại test | Mục tiêu |
|---|---|
| Unit test | Validate schema, service rule, utility thuần |
| Integration test | Service + repository với database test hoặc mock Supabase |
| UI test | Component quan trọng: upload form, assessment form, dashboard table |
| E2E test | Luồng giảng viên gửi yêu cầu mở lớp, bật lớp mở đăng ký khi cần, tạo tài liệu và sinh viên truy cập; luồng học phần do Mod tạo/sửa trực tiếp |
| Regression test | Bắt buộc khi fix bug liên quan quyền truy cập/import |

---

## 13. Performance principles

- Dùng pagination cho danh sách lớp, tài liệu, submissions.
- Không load file binary qua server nếu signed URL đủ an toàn.
- Dashboard tổng hợp bằng query có index phù hợp.
- Đo trước khi tối ưu; không tối ưu phỏng đoán.
- Batch hóa các read path hay dùng chung context lớp/học phần thay vì gọi lặp từng item.
- Sau mutation chỉ refresh đúng scope cần thiết; tránh `router.refresh()` hoặc `revalidatePath()` quá rộng gây render loop và tải lại toàn bộ layout không cần thiết.
- Với màn nặng như Quản lý lớp, Phòng học trực quan, Thư viện và Result page, nên gắn timing log theo block truy vấn để xác định nút nghẽn thật trước khi đổi kiến trúc.

---

## 14. Architecture decision records ban đầu

### ADR-001: Dùng external forms thay vì native quiz engine trong v1

Lý do: giảm scope, tận dụng Google/MS Form đã ổn định, tập trung vào quản lý học tập và dashboard.

### ADR-002: Dùng Supabase làm backend chính

Lý do: có Auth, PostgreSQL, Storage, RLS, phù hợp MVP nhỏ nhưng có thể mở rộng.

### ADR-003: File tài liệu private mặc định

Lý do: tài liệu học tập có thể chỉ dành cho lớp/học phần cụ thể.

### ADR-004: Import/sync kết quả phải idempotent

Lý do: tránh trùng điểm khi import lại hoặc webhook gửi lại.
