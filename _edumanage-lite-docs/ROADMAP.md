# ROADMAP.md

# Learning Management Platform (LMP) DEVELOPMENT ROADMAP

## 1. Nguyên tắc roadmap

Roadmap này dùng để AI Agent và người phát triển triển khai theo từng phase nhỏ, tránh code chắp vá. Mỗi phase phải có acceptance criteria rõ. Không chuyển phase nếu các test và business rules quan trọng của phase trước chưa ổn định.

Triết lý triển khai:

- Làm lõi nhỏ nhưng chắc.
- Tính năng nào xong phải có dữ liệu, phân quyền, validation và test tối thiểu.
- Không hy sinh kiến trúc dài hạn để hoàn thành giao diện nhanh.
- Mỗi sprint nên giảm độ phức tạp hoặc giữ độ phức tạp không tăng ngoài tầm kiểm soát.

Quy ước UI chung:

- Link quay lại trang trước/trang cha dùng dạng text màu xanh có mũi tên trái, ví dụ `← Quay về lớp của tôi`.
- Không dùng button viền hoặc card-like button cho hành động quay lại; button viền chỉ dành cho lệnh/hành động rõ ràng như lọc, export, mở form hoặc thao tác dữ liệu.
- Đặt link quay lại ở góc trái trên cùng của trang, trước tiêu đề hoặc cụm header chính, để vị trí điều hướng luôn nhất quán.
- Khi triển khai UI mới, dùng component `BackTextLink` để giữ thống nhất kiểu chữ, màu, hover state và spacing.

Ma trận quyền chức năng chính đã chốt:

- Lớp học: giảng viên gửi yêu cầu mở lớp gắn với học phần; Mod/Admin duyệt yêu cầu và quản lý lớp theo scope; Mod không tạo lớp; Admin không tạo lớp trực tiếp trong luồng vận hành chuẩn.
- Học phần: Mod gửi yêu cầu tạo học phần và mặc định được gán quản lý sau khi Admin duyệt; Admin duyệt, giao scope và quản lý học phần, không tự đi theo luồng tạo trực tiếp trong UI vận hành chuẩn.
- Thư viện: giảng viên có Thư viện cá nhân riêng mặc định 50 MB, Admin có thể điều chỉnh quota; giảng viên tải tài nguyên lên thư viện cá nhân, xóa tài nguyên cá nhân của mình, đưa tài nguyên vào lớp mình giảng dạy và gửi yêu cầu đưa tài nguyên vào Thư viện dùng chung; tài nguyên dùng chung muốn ẩn thì gửi Mod duyệt, muốn xóa thì gửi Admin duyệt. Mod tải tài nguyên trực tiếp vào Thư viện dùng chung, duyệt ẩn tài nguyên và yêu cầu xóa nhưng không quản lý Danh mục Thư viện; Admin tải trực tiếp, ẩn/xóa tài nguyên và quản lý Danh mục Thư viện.
- Mô phỏng HTML: giảng viên chỉ tải lên; Mod tải lên, gắn vào học phần và gửi yêu cầu tích hợp native; Admin duyệt/từ chối tích hợp native và không gắn mô phỏng HTML vào học phần.
- Bài kiểm tra: giảng viên tạo bài kiểm tra; đề thi có thể lấy câu hỏi từ Ngân hàng đề thi theo từng học phần; kết quả lớp học được tổng hợp thêm về kho Kết quả kiểm tra theo học phần để Mod/Admin theo dõi.
- Thông báo: dashboard của Admin, Mod, Giảng viên đều có khối Thông báo chung; Admin và Mod được gửi/đọc, Giảng viên chỉ được đọc.
- User management: sinh viên tự đăng ký; tài khoản giảng viên và moderator do Admin tạo trong module User management, kèm phân quyền và vòng đời duyệt truy cập.
- Phòng học: khung Kiểm tra nằm ngay dưới Bảng đen, tự ẩn khi không có bài kiểm tra đang mở; khi có bài đang mở thì hiển thị tiêu đề, hạn nộp và nút vào phòng kiểm tra. Trang làm bài của sinh viên yêu cầu bấm Bắt đầu làm bài rồi mới hiển thị nội dung và đồng hồ đếm ngược.

---

## 2. Tổng quan phase

| Phase | Tên | Mục tiêu | Trạng thái |
|---|---|---|---|
| Phase 0 | Khởi tạo nền tảng | Setup dự án, docs, Supabase, cấu trúc thư mục | Completed |
| Phase 1 | User management nền và phân quyền | Đăng nhập, role, profile, route guard, RLS nền | Completed |
| Phase 2 | Học phần và tài liệu | Course, material upload, signed URL, đọc/tải file | Completed |
| Phase 3 | Lớp học và sinh viên | Class, class members, import danh sách SV | Completed |
| Phase 3.3 | Quản trị truy cập và vòng đời tài khoản | Duyệt sinh viên, phân quyền moderator theo phạm vi, hết hạn/gia hạn truy cập, đăng ký nhiều học phần | Completed |
| Phase 4 | Bài kiểm tra và kết quả | External forms, import/sync submissions, dashboard | Completed |
| Phase 5 | Mô phỏng đơn giản | Simulation registry, widget mẫu, thư viện mô phỏng HTML | Completed |
| Phase 6 | Hoàn thiện vận hành | Export, audit log, UI polish, backup, deployment | In Progress |

---

## 3. Phase 0: Khởi tạo nền tảng

### Mục tiêu

Tạo project Next.js + Supabase với cấu trúc sạch, đủ tài liệu, đủ quy tắc cho AI Agent.

### Task

- [x] Khởi tạo Next.js TypeScript project.
- [x] Cài Tailwind CSS, shadcn/ui pattern deps, Supabase client, Zod, test libraries.
- [x] Tạo cấu trúc thư mục theo `ARCHITECTURE.md`.
- [x] Tạo `.env.example`.
- [x] Cấu hình Supabase local hoặc cloud project.
- [x] Tạo migration đầu cho `profiles`.
- [x] Tạo layout cơ bản: public, teacher, student.

Ghi chú tiến độ:

- Đã chạy `supabase init` và tạo `supabase/config.toml`.
- Đã cài Docker Desktop, chạy thành công `pnpm supabase:start` và `pnpm supabase:db:reset`.

### Acceptance criteria

- [x] `pnpm dev` chạy được.
- [x] `pnpm test` chạy được với test mẫu.
- [x] Project không chứa secret thật.
- [x] Tài liệu nền tảng được đặt ở root.
- [x] AI Agent có thể đọc `START_HERE_FOR_AI_AGENT.md` trước khi code.

---

## 4. Phase 1: User management nền và phân quyền

### Mục tiêu

Người dùng đăng nhập được và truy cập đúng khu vực theo role.

### Sprint 1.1: Supabase Auth + Profiles

- [x] Kết nối Supabase Auth.
- [x] Tạo profile sau khi user đăng nhập hoặc qua seed.
- [x] Tạo `AuthService.getCurrentProfile()`.
- [x] Tạo route guard theo role.

Acceptance:

- [x] User chưa đăng nhập bị chuyển về login.
- [x] Student không vào được teacher dashboard.
- [x] Teacher không vào được admin-only nếu chưa có quyền.

### Sprint 1.2: RLS nền

- [x] Bật RLS cho `profiles`.
- [x] Policy xem/sửa profile cá nhân.
- [x] Admin xem được tất cả.
- [x] Test policy tối thiểu.

Acceptance:

- [x] Không thể query profile người khác nếu không có quyền.
- [x] Service role không lộ ở client.

---

## 5. Phase 2: Học phần và tài liệu

### Sprint 2.1: Course management

- [x] Migration `courses`.
- [x] `CourseService` và `courseRepository`.
- [x] Trang danh sách học phần.
- [x] Form tạo/sửa học phần.
- [x] Archive học phần.

Acceptance:

- [x] Moderator gửi được yêu cầu tạo học phần để Admin duyệt.
- [x] Actor theo quyền chỉ thấy học phần trong phạm vi sở hữu hoặc scope được cấp.
- [x] Course code unique theo owner/scope nghiệp vụ áp dụng.

### Sprint 2.2: Material upload và viewer

- [x] Migration `materials`.
- [x] Tạo bucket `course-materials` private.
- [x] `MaterialService.createUploadIntent()`.
- [x] Upload file và lưu metadata.
- [x] Sinh viên xem PDF bằng signed URL.
- [x] Bật/tắt download.

Acceptance:

- [x] File private không mở được bằng URL trực tiếp.
- [x] Sinh viên có quyền nhận signed URL.
- [x] Sinh viên không thuộc lớp không xem được tài liệu.

---

## 6. Phase 3: Lớp học và sinh viên

### Sprint 3.1: Class management

- [x] Migration `classes`.
- [x] `ClassService.createClass()`.
- [x] Trang danh sách lớp.
- [x] Gắn lớp với học phần.

Acceptance:

- [x] Teacher gửi được yêu cầu mở lớp cho học phần của mình.
- [x] Lớp hiển thị học kỳ/năm học.

### Sprint 3.2: Class members

- [x] Migration `class_members`.
- [x] Thêm sinh viên thủ công.
- [x] Import CSV danh sách sinh viên.
- [x] Trang danh sách sinh viên trong lớp.
- [x] RLS theo membership.

Acceptance:

- [x] Không tạo duplicate membership.
- [x] Student thấy lớp của mình.
- [x] Student không thấy lớp không tham gia.

---

## 7. Phase 3.3: Quản trị truy cập và vòng đời tài khoản

### Sprint 3.3.1: Student approval workflow

- [x] Bổ sung trạng thái truy cập sinh viên: `pending_approval`, `active`, `suspended`, `expired`.
- [x] Luồng sinh viên tự đăng ký nhưng chưa vào được khu học tập khi chưa duyệt.
- [x] Màn hình duyệt truy cập sinh viên chờ duyệt cho `admin` và `moderator`.
- [x] Giảng viên duyệt trong phạm vi học phần/lớp do mình sở hữu hoặc được cấp quyền.

Acceptance:

- [x] Sinh viên mới đăng ký không vào được lớp/tài liệu/assessment nếu chưa duyệt.
- [x] Quyết định duyệt/từ chối có audit log.
- [x] RLS và service guard đều chặn đúng trạng thái `pending_approval`.

### Sprint 3.3.2: Expiry và gia hạn truy cập

- [x] Bổ sung `access_expires_at` cho tài khoản sinh viên.
- [x] Middleware + service guard chặn truy cập khi quá hạn.
- [x] Admin/moderator/giảng viên (theo phạm vi quyền) được gia hạn truy cập.

Acceptance:

- [x] Tài khoản quá hạn không truy cập được tài nguyên học tập.
- [x] Gia hạn có hiệu lực ngay mà không cần can thiệp database thủ công.

### Sprint 3.3.3: Moderator và phân quyền theo phạm vi

- [x] Chuẩn hóa role `moderator` trong user-management/profile layer.
- [x] Bổ sung permission scope theo `course`/`class` do admin cấp.
- [x] Moderator có toàn bộ quyền giảng viên trong phạm vi được cấp.

Acceptance:

- [x] Moderator không thao tác ngoài phạm vi được cấp.
- [x] Admin có thể cấp và thu hồi scope theo course/class.

### Sprint 3.3.4: Đăng ký nhiều học phần và duyệt theo phạm vi

- [x] Hiển thị danh sách học phần/lớp đang mở khi sinh viên khởi tạo tài khoản.
- [x] Sinh viên gửi yêu cầu đăng ký nhiều học phần cùng lúc.
- [x] Giảng viên chỉ duyệt yêu cầu thuộc học phần mình phụ trách.
- [x] Giảng viên duyệt hàng loạt yêu cầu theo phạm vi lớp/học phần mình phụ trách.

Acceptance:

- [x] Một yêu cầu đăng ký không hợp lệ không làm hỏng toàn bộ batch.
- [x] Kết quả duyệt được phản ánh vào membership đúng lớp/học phần.

### Sprint 3.3.5: Hồ sơ sinh viên nhẹ và tổng hợp

- [x] Tách thông tin hồ sơ cá nhân khỏi dữ liệu kết quả chi tiết theo học phần.
- [x] Thêm bảng/tầng tổng hợp thống kê nhẹ cho profile (thời lượng truy cập, tần suất truy cập).
- [x] Chuẩn bị contract huy hiệu (badge) cho phase sau.

Acceptance:

- [x] Profile sinh viên tải nhanh, không phình dữ liệu từ submissions thô.
- [x] Điểm hiển thị tách theo học phần và có tổng hợp chung.

### Test plan bắt buộc cho Phase 3.3

Unit test:

- [x] Validator cho approve/renew access (`expiresAt`, role, status transitions).
- [x] Validator cho batch yêu cầu tham gia lớp (duplicate trong cùng payload, classId optional).
- [x] Permission check helper (admin pass, teacher own-course pass, moderator ngoài scope fail).

Integration test:

- [x] Repository/API `approveStudentAccess` cập nhật đúng `access_status`, `approved_by`, `approved_at`.
- [x] Repository `renewStudentAccess` không làm mất trạng thái `active`.
- [x] Enrollment review tạo membership đúng lớp/học phần và idempotent khi duyệt lại.
- [x] Scope assignment/revocation có hiệu lực ngay ở service-level permission check.

RLS test:

- [x] Student `pending_approval` không đọc được classes/materials/assessments.
- [x] Student `expired` không đọc được classes/materials/assessments.
- [x] Moderator chỉ thao tác được lớp/học phần nằm trong `permission_scopes` active.

Ghi chú tiến độ RLS hiện tại:

- [x] Đã verify chặn đọc `classes`/`materials` với `pending_approval` và `expired`.
- [x] Đã verify chặn đọc `assessments` với `pending_approval` và `expired`.

E2E test:

- [x] Sinh viên tự đăng ký -> bị chặn khu học tập khi chưa duyệt.
- [x] Admin/moderator duyệt -> sinh viên truy cập được lớp hợp lệ.
- [x] Hết hạn truy cập -> sinh viên bị chặn -> gia hạn -> truy cập lại bình thường.
- [x] Sinh viên gửi batch yêu cầu tham gia nhiều học phần và nhận kết quả duyệt theo từng học phần.

Ghi chú E2E tiến độ hien tai:

- [x] Teacher duyệt yêu cầu tham gia lớp + duyệt truy cập -> sinh viên truy cập được lớp hợp lệ (`tests/e2e/enrollment-approval-flow.spec.ts`).
- [x] Student pending_approval bị chặn trải nghiệm học tập (`tests/e2e/auth-flow.spec.ts`).
- [x] Moderator có scope duyệt truy cập thành công; yêu cầu tham gia lớp của sinh viên chỉ do giảng viên duyệt (`tests/e2e/phase33-moderator-renew.spec.ts` và `tests/e2e/enrollment-approval-flow.spec.ts`).
- [x] Student expired bị chặn và truy cập lại sau khi renew (`tests/e2e/phase33-moderator-renew.spec.ts`).
- [x] Student gửi batch enrollment 2 học phần và nhận kết quả duyệt approved/rejected theo từng học phần (`tests/e2e/phase33-multi-course-enrollment.spec.ts`).
- [x] Teacher duyệt batch yêu cầu tham gia lớp theo lớp/học phần mình phụ trách; yêu cầu không hợp lệ fail theo từng item (`tests/e2e/phase33-multi-course-enrollment.spec.ts`).

Exit gate trước Phase 4:

- [x] Toan bo test Phase 3.3 pass (unit/integration/RLS/E2E).
- [x] Migration Phase 3.3 da ap dung thanh cong tren local va staging.
- [x] SERVICE_CONTRACT va DATABASE_SCHEMA dong bo voi implementation.
- [x] Khong con bug blocker lien quan den user-management approval/scope/expiry.

---

## 8. Phase 4: Bài kiểm tra và kết quả

### Sprint 4.1: External assessment links

- [x] Migration `assessments`.
- [x] `AssessmentService.createAssessment()`.
- [x] Validate Google/MS Form URL cơ bản.
- [x] Trang bài kiểm tra theo lớp.
- [x] Student mở form bằng iframe hoặc new tab.

Acceptance:

- [x] Teacher gắn được Google Form/MS Form.
- [x] Student chỉ thấy assessment của lớp mình.
- [x] Assessment closed không cho làm bài theo mặc định.

Ghi chú tiến độ Sprint 4.1 hiện tại:

- [x] Đã thêm route giảng viên `\/assessments` và route sinh viên `\/my-classes\/assessments`.
- [x] Đã thêm unit test cho `assessment-service` (validate provider URL, embed fallback, closed assessment guard).
- [x] Integration test `tests/integration/phase41-assessment-visibility.test.ts` — xác nhận RLS chặn outsider đọc assessment (PASS).
- [x] E2E test `tests/e2e/assessment-visibility.spec.ts` — xác nhận student member thấy assessment, outsider không thấy (PASS 12.7s).

### Sprint 4.2: Submission import

- [x] Migration `submissions` và `import_jobs`.
- [x] Import CSV kết quả.
- [x] Mapping cột student code/email/name/score/submitted at.
- [x] Upsert idempotent.
- [x] Báo cáo dòng lỗi.

Acceptance:

- [x] Import lại không tạo trùng.
- [x] Dòng lỗi không làm hỏng toàn bộ import.
- [x] Teacher xem được kết quả theo assessment.

Ghi chú tiến độ Sprint 4.2 hiện tại:

- [x] Da them migration `supabase/migrations/202605280018_phase42_submissions_import_jobs.sql`.
- [x] Da them `SubmissionService.importSubmissionsFromCsv()` voi row-level error report.
- [x] Da them unit test `tests/unit/submission-service.test.ts` cho role guard, parse CSV, partial import, idempotent path.
- [x] Da co read-model + UI teacher xem ket qua assessment qua route `/assessments/[assessmentId]/results`.

### Sprint 4.3: Webhook sync cơ bản

- [x] API route Google webhook.
- [x] API route Microsoft webhook.
- [x] Shared secret validation.
- [x] Adapter normalize payload.
- [x] Upsert submission.

Acceptance:

- [x] Payload thiếu secret bị từ chối.
- [x] Payload hợp lệ được ghi nhận.
- [x] Lỗi provider được log an toàn.

Ghi chú tiến độ Sprint 4.3 hiện tại:

- [x] Da them route `app/api/webhooks/google-form/route.ts` va `app/api/webhooks/microsoft-form/route.ts`.
- [x] Da them adapters normalize payload trong `lib/integrations/google-form-adapter.ts` va `lib/integrations/microsoft-form-adapter.ts`.
- [x] Da them `SubmissionService.upsertExternalSubmission()` voi shared secret validation va service-role upsert.
- [x] Da bo sung activity logging an toan cho webhook success/error qua `createSystemActivityLogRepository`.
- [x] Da them unit test webhook path trong `tests/unit/submission-service.test.ts`.

### Sprint 4.4: Dashboard và export

- [x] Dashboard tổng quan teacher.
- [x] Bảng điểm theo lớp/bài.
- [x] Biểu đồ tỷ lệ hoàn thành.
- [x] Export CSV/XLSX.

Acceptance:

- [x] Export đúng theo quyền.
- [x] Bảng điểm lọc được theo trạng thái.
- [x] Dashboard không tính bản ghi `ignored`.

Ghi chú tiến độ Sprint 4.4 hiện tại:

- [x] Da them read-model `SubmissionService.getAssessmentResults()` + repository pagination/status filter.
- [x] Da them UI route giang vien `app/(teacher)/assessments/[assessmentId]/results/page.tsx` va link dieu huong tu danh sach assessment.
- [x] Da them API export `GET /api/assessments/[assessmentId]/results/export?format=csv|xlsx`.
- [x] Da them unit test export `tests/unit/export-service.test.ts` va E2E `tests/e2e/assessment-results.spec.ts`.
- [x] Da them `DashboardService.getTeacherDashboard()` + trang dashboard tong quan co completion-rate chart.
- [x] Export XLSX nang cao da co 2 sheet: `summary` + `raw`.
- [x] Da bo sung bo loc dashboard theo `courseId`/`classId` tren route `/dashboard`.
- [x] Da them E2E dashboard `tests/e2e/dashboard-overview.spec.ts` cho completion chart + recent activity.
- [x] Da nang cap summary XLSX voi completion rate, score bands va status breakdown chi tiet.
- [x] Da dong bo roster lifecycle cho `missing/late/ignored`, dedupe latest result theo sinh vien va mo rong `source = lifecycle` de dashboard/export khong bo sot sinh vien chua nop.

---

## 9. Phase 5: Mô phỏng đơn giản

### Sprint 5.1: Simulation registry

- [x] Tạo `simulations/registry.ts`.
- [x] Migration `simulations`.
- [x] Gắn simulation với course.
- [x] Trang hiển thị simulation.
- [x] Redesign lớp học theo dạng `visual classroom layout` (theo `_Giao_dien_lop_hoc.md`).
- [x] Tạo route classroom detail cho teacher/student (không thay thế trang list hiện có).
- [x] Bảng đen lớp học: đọc/ghi announcements theo class scope.
- [x] Khu bàn sinh viên: auto-seat theo quy tắc sort tên và layout 4 cột x 5 hàng.
- [x] Tủ tài liệu lớp: hiển thị material theo context lớp-học phần.
- [x] Màn chiếu: hiển thị simulation widgets theo context lớp-học phần.
- [x] Bàn giảng viên + private message composer theo class scope.

Acceptance:

- [x] Course có thể hiển thị danh sách mô phỏng.
- [x] Simulation không phá course/material module.
- [x] Classroom visual layout không phá `ClassService` và luồng class list hiện tại.
- [x] Chỗ ngồi hiển thị đúng thứ tự trái -> phải, trên -> dưới, deterministic theo `fullName`.
- [x] Mỗi bàn sinh viên đúng cấu trúc 2 khung: `Tên - Họ` và `MSSV`.
- [x] Announcement và direct message tuân thủ RLS theo class scope.

Backlog chi tiết + checklist implementation theo file-level:

- [x] Xem tài liệu `SPRINT_5_1_CLASSROOM_VISUAL_BACKLOG.md` và triển khai theo checklist.

### Sprint 5.2: Widget mẫu

- [x] Mô phỏng bình quân di động.
- [x] Mô phỏng san bằng mũ đơn giản.
- [x] Mô phỏng phân phối chuẩn hoặc hồi quy tuyến tính.

Acceptance:

- [x] Widget chạy client-side ổn định.
- [x] Input được validate.
- [x] Có mô tả ngắn cho sinh viên.

### Sprint 5.3: Thư viện mô phỏng HTML

- [x] Thêm upload mô phỏng HTML vào Thư viện.
- [x] Thêm trạng thái duyệt `pending_review`, `approved`, `rejected` để xử lý bản ghi legacy; upload mới mặc định khả dụng trong Thư viện.
- [x] Thêm thao tác gắn mô phỏng HTML vào học phần.
- [x] Sinh viên mở mô phỏng HTML bằng tab mới từ Màn chiếu.
- [x] Thêm trạng thái đề xuất tích hợp native để developer chuyển mô phỏng thành widget chính thức sau.
- [x] Seed 3 widget native mặc định vào các học phần hiện có bằng migration `202606040002_seed_default_simulation_widgets.sql`.
- [x] Thêm bảng `class_resource_links` để giảng viên/Mod/Admin thêm hoặc bớt tài liệu, mô phỏng theo từng lớp.
- [x] Thêm danh mục và tags cho tài nguyên Thư viện bằng migration `202606050003_library_categories_and_tags.sql`.
- [x] Upload tài liệu/mô phỏng HTML trong Thư viện có trường Học phần tùy chọn: bỏ trống để lưu vào thư viện cá nhân của giảng viên, chọn học phần để gửi yêu cầu duyệt vào Thư viện dùng chung.

Acceptance:

- [x] File HTML upload không nhúng raw vào App Router runtime.
- [x] Storage path không lộ ra UI; route mở mô phỏng dùng signed URL ngắn hạn.
- [x] Mô phỏng HTML upload cá nhân dùng ngay trong Thư viện cá nhân; upload gắn học phần cần Mod/Admin duyệt trước khi đưa vào học phần dùng chung.
- [x] Tài nguyên Thư viện được thêm/bớt khỏi Màn chiếu và Tủ tài liệu theo từng lớp, không cần duyệt.
- [x] Giảng viên tìm/lọc tài nguyên theo danh mục hoặc tag; Mod/Admin quản lý danh sách danh mục.
- [x] Workflow hiện tại phù hợp với file `_Mo_phong_VL6.html`; chuyển native vẫn cần refactor thủ công.

---

## 10. Phase 6: Hoàn thiện vận hành

### Task

- [x] Activity log cho hành động quan trọng.
- [x] Error boundary và empty state.
- [x] Loading state nhất quán.
- [x] Backup/export dữ liệu quan trọng.
- [x] Kiểm tra accessibility cơ bản.
- [x] Kiểm tra mobile responsive.
- [ ] Deploy production.
- [x] Viết hướng dẫn sử dụng cho giảng viên.

Acceptance:

- [ ] Luồng chính chạy trên production.
- [x] Có hướng dẫn import sinh viên/kết quả.
- [x] Có checklist backup.
- [x] Không có secret lộ trong repo.

Ghi chu tien do Phase 6:

- [x] Da them `OPERATIONS_BACKUP_EXPORT_CHECKLIST.md` cho backup/export van hanh som.
- [x] Da them `PRODUCTION_READINESS_CHECKLIST.md` gom deploy runbook + rollback + smoke test matrix.
- [x] Da them `TEACHER_USER_GUIDE.md` huong dan import sinh vien/ket qua cho giang vien.
- [x] Da co evidence dry-run trong `PHASE6_PRODUCTION_READINESS_EVIDENCE_20260603.md`.
- [x] Da co evidence tiep tuc production deploy attempt trong `PHASE6_PRODUCTION_DEPLOY_ATTEMPT_20260604.md`: lint/unit/security/build pass, cloud rollout bi chan boi Vercel/Supabase tooling/credential va Docker permission.
- [x] Da co evidence local validation trong `PHASE6_LOCAL_VALIDATION_EVIDENCE_20260604.md`: app health pass, Supabase local reachable, integration pass, admin user-management/auth-profile pass; E2E browser automation bi chan boi `spawn EPERM`.
- [x] Da them route `/library` lam hub Thu vien cho teacher/moderator/admin: tong hop tai lieu + simulation, link ve upload/registry, va review tich hop `_Mo_phong_VL6.html`.
- [x] Da them workflow upload tai lieu/mo phong HTML trong Thu vien: bo trong hoc phan thi luu thu vien ca nhan; chon hoc phan thi gui yeu cau duyet vao Thu vien dung chung. Migration `202606070001_personal_library_upload_review.sql` bo sung `materials.review_status`, `materials.course_id` nullable va `simulation_uploads.requested_course_id`.
- [x] Da them workflow `library_change_requests`: giang vien/Mod/Admin tao yeu cau an/xoa tai lieu/mo phong; Mod/Admin duyet an, chi Admin duyet xoa.
- [x] Da them workflow `class_resource_links`: giang vien/Mod/Admin them hoac bot tai lieu/mo phong theo tung lop tu Man chieu va Tu tai lieu.
- [x] Da them metadata `library_categories` + `tags` cho tai lieu, mo phong va simulation upload; trang Thu vien co bo loc danh muc/tag cho giang vien/Mod/Admin.
- [x] Da bo sung khoi `Thong bao` dung chung tren dashboard Admin/Mod/Giang vien; Admin va Mod duoc gui thong bao, Giang vien chi doc.
- [x] Da bo sung module `Kiem tra` theo hoc phan: ngan hang de thi + kho tong hop ket qua kiem tra theo hoc phan.
- [x] Da bo sung `Thu vien ca nhan` gan voi tai khoan giang vien, quota mac dinh 50 MB va Admin co the dieu chinh.
- [x] Da doi huong tu `Auth` don thuan sang `User management` day du cho Admin: tao tai khoan giang vien, tao/cap quyen moderator, quan ly vai tro va truy cap.
- [x] Da chuan hoa UI Thu vien giang vien: bo card tong quan Duyet xoa, them loc theo hoc phan, danh sach Tai lieu/Mo phong dung khung cuon co dinh, va form tai tai lieu/mo phong HTML dong bo thu tu truong + vi tri nut gui.
- [x] Da chuan hoa UI Thu vien Mod/Admin: tong so mo phong dem theo widget duy nhat thay vi nhan theo hoc phan, form upload staff bat buoc chon hoc phan hoac Khac va dua thang vao Thu vien, cac label/input trong Danh muc va Duyet xoa/an co spacing rong hon.
- [x] Da chinh quyen Admin trong Thu vien: Admin tich hop native truc tiep cho mo phong HTML, an/xoa tai nguyen truc tiep khong can tao yeu cau; Mod/giang vien van di qua luong de xuat/duyet phu hop.
- [x] Da chinh UI Admin: dashboard hien `Tong quan quan tri`, Admin hub bo Tai tai lieu/Bai kiem tra, cac trang chuc nang co nut do `Khu vuc Admin`, danh sach lop Admin hien trang thai bang cham mau va thong tin tom tat, danh sach hoc phan Admin hien metadata day du + Mod quan ly va bo nut Tao/quan ly lop/Mo mo phong.
- [x] Da bo sung thao tac Admin `Giao quan ly` trong danh sach hoc phan: Admin chon Mod active de gan quan ly, he thong cap scope course cho Mod moi va thu hoi scope course active cu; hoc phan do Mod tao qua yeu cau tao hoc phan van tu dong gan Mod tao yeu cau khi Admin duyet.
- [x] Da chuan hoa UI Chuẩn đầu ra học phần va Thành phần đánh giá thanh bang nhap lieu co nut Them/Bot trong form tao/sua hoc phan cho Admin/Mod, dong thoi hien thi readonly dang bang trong card tom tat hoc phan.
- [x] Da apply migration `202606070002_course_update_change_requests.sql` de luong Admin sua hoc phan da giao Mod quan ly tao yeu cau `update` va chi ap dung sau khi Mod dong thuan.
- [x] Da them metadata hoc phan (`credits`, `knowledge_block`, `course_type`, `clo_items`, `assessment_components`) va workflow Mod tao hoc phan qua `course_change_requests` action `create`; Admin duyet se tao hoc phan active va cap scope mac dinh cho Mod tao yeu cau.
- [x] Da chinh quyen Mod: Mod khong tao lop/khong quan ly bai kiem tra, chi xem Tong quan giam sat theo hoc phan duoc cap scope va duyet yeu cau thay doi lop/hoc phan trong pham vi phu hop.
- [x] Da fix luong test role local: Moderator scope nhin thay hoc phan/lop theo `can_manage_course/class`, hoc phan moi duoc seed widget mo phong mac dinh, va hoc phan A-Test da co lop A-Test de test them sinh vien/tai lieu/mo phong.
- [x] Da bo sung UI sinh vien xin tham gia lop active tren `/my-classes`; yeu cau tham gia lop chi do giang vien phu trach lop duyet, con duyet truy cap van do giang vien/Mod/Admin xu ly theo quyen.
- [x] Da nang cap `/admin` thanh admin hub co link den dashboard, hoc phan, lop hoc, Thu vien, tai lieu, bai kiem tra va scope.
- [x] Da bo sung quyen xoa hoc phan admin-only tren UI/service; Mod/teacher khong thay nut xoa hoc phan.
- [x] Da chot va dong bo lai ma tran quyen chinh: teacher chi gui yeu cau mo lop va tao bai kiem tra; Mod quan ly hoc phan/lop theo scope, khong tao lop va khong quan ly Danh muc Thu vien; Admin tao/quan ly hoc phan, giao Mod, quan ly Danh muc Thu vien va duyet native.
- [x] Da them khung Kiem tra trong phong hoc ngay duoi Bang den, chi hien khi co assessment `open`; trang lam bai sinh vien co nut Bat dau lam bai va dong ho dem nguoc theo han nop.
- [x] Da chuan hoa them module assessment hien co: `Thoi han lam bai` thay cho `Han nop`, dong ho `Thoi gian lam bai con lai` lay theo attempt cua tung sinh vien va luu state len database de chong trick refresh/relogin.
- [x] Da cap nhat Result page cho bai kiem tra ngoai: bo filter khong can, them sort theo header, doi import/export sang quy uoc ro rang `Xuất kết quả kiểm tra` va `Xuất thống kê kết quả`, co template CSV/XLSX cho giang vien va doi chieu ket qua bang `student code`.
- [x] Da sua cac loat refresh/mutation de tranh rendering loop; dong thoi them timing log va gom batch truy van cho `Quản lý lớp`, `Phòng học trực quan`, `Tài nguyên lớp`, `Dashboard` va `Lớp mẫu`.
- [x] Da toi uu loading state va dem trang thai cho cac man teacher de giao dien co cam giac tai du lieu ro rang hon trong lan load dau tien.
- [ ] Blocker ngoai workspace: chua co cloud deploy credential/hosting target de chot rollout production that su.

Ghi chu tong ket tien do:

- He thong da xong lop cong viec cu theu: user management, course/class/material/library/simulation, assessment external, result import/export, classroom visual layout va dashboard.
- Phan con lai cua Phase 6 chu yeu la hardening: performance, ops, deploy, smoke test va cleanup UX.
- Uoc tinh hoan thien tong the hien tai nam trong khoang `85% - 90%`, tuy theo cach tinh co tinh ca operations polish hay khong.

---

## 11. Bug tracker ban đầu

| ID | Mô tả | Mức độ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| BUG-001 | Chưa có test RLS đầy đủ | High | Closed | Phase 3.3/4 đã có unit/integration/RLS/E2E coverage theo checklist |
| BUG-002 | Import CSV có thể lệch cột | Medium | Mitigated | Import có mapping cột và row-level error report |
| BUG-003 | Form iframe có thể bị provider chặn | Low | Known | Fallback new tab |

---

## 12. Risk tracker

| ID | Rủi ro | Tác động | Giảm thiểu |
|---|---|---|---|
| RISK-001 | AI Agent code chắp vá, trộn UI và business logic | Khó bảo trì | Bắt buộc đọc START_HERE và architecture boundaries |
| RISK-002 | RLS sai khiến lộ tài liệu/điểm | Rất cao | Test policy, service permission check, private storage |
| RISK-003 | Đồng bộ Google/MS Form không ổn định | Trung bình | V1 hỗ trợ import CSV trước, webhook là phase sau |
| RISK-004 | File storage tăng nhanh | Trung bình | Giới hạn file size, private bucket, lifecycle cleanup |
| RISK-005 | Tên khái niệm không nhất quán | Trung bình | Tuân thủ naming convention trong ARCHITECTURE |
| RISK-006 | Local secret bị commit nhầm | Cao | `.env.local` luôn untracked + script `pnpm security:scan` quét tracked files |
| RISK-007 | Test mặc định phụ thuộc Supabase local | Trung bình | `pnpm test` chỉ chạy unit, integration tách riêng `pnpm test:integration` tự start local stack |
| RISK-008 | Thiếu browser E2E cho login/role redirect | Trung bình | Bổ sung Playwright test `tests/e2e/auth-flow.spec.ts` cho signup/login/logout/role redirect |
| RISK-009 | Sinh viên tự đăng ký nhưng chưa có luồng duyệt rõ ràng | Cao | Thiết kế trạng thái truy cập + workflow duyệt ở Phase 3.3 |
| RISK-010 | Moderator có quyền vượt phạm vi lớp/học phần | Cao | Bắt buộc scope-based permission + audit log cấp quyền |
| RISK-011 | Dữ liệu hồ sơ sinh viên phình to do trộn dữ liệu chi tiết | Trung bình | Tách profile nhẹ + summary table cho thống kê chung |

---

## 13. Definition of Done chung

Một task chỉ được đánh dấu hoàn thành khi:

- [ ] Code chạy được.
- [ ] Không phá luồng hiện có.
- [ ] Có validation input.
- [ ] Có xử lý lỗi rõ.
- [ ] Có test phù hợp với mức độ rủi ro.
- [ ] Không lộ secret.
- [ ] Không bypass RLS/authorization.
- [ ] Nếu đổi schema, đã cập nhật migration và `DATABASE_SCHEMA.md`.
- [ ] Nếu đổi service/API, đã cập nhật `SERVICE_CONTRACT.md`.
- [ ] Nếu đổi architecture/business rule, đã cập nhật `ARCHITECTURE.md` hoặc `SPEC_FINAL.md`.

---

## 14. Trạng thái hiện tại

```text
Current phase: Phase 6 operations polish
Next task: Smoke test role Mod/Admin/Teacher sau migration `202606050004`, sau do execute cloud production rollout va rollback drill khi co credential/hosting target.
```
