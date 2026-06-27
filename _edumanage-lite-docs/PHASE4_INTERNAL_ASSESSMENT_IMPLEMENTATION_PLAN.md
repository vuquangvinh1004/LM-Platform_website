# PHASE4_INTERNAL_ASSESSMENT_IMPLEMENTATION_PLAN.md

## Mục tiêu

Tài liệu này mô tả kế hoạch nâng cấp module `assessment` của LMP từ trạng thái hiện tại:

- tạo bài kiểm tra bằng liên kết ngoài,
- hiển thị assessment trong lớp học,
- nhận kết quả từ webhook/CSV,
- export và tổng hợp kết quả,

thành một hệ thống hoàn chỉnh theo luồng:

`tạo đề -> làm bài -> nộp bài -> chấm điểm -> tổng hợp`

ngay trong website, **nhưng vẫn giữ nguyên luồng assessment từ Google Form / Microsoft Form** để linh hoạt chuyển đổi.

---

## Trạng thái hiện tại

### Đã có

- Bảng `assessments`
- Bảng `question_bank_items`
- Bảng `assessment_question_links`
- Bảng `submissions`
- Bảng `course_assessment_results`
- Trang giảng viên tạo assessment
- Trang sinh viên mở assessment
- Luồng nhận kết quả từ `google_form` / `microsoft_form`
- Luồng import CSV
- Trang kết quả và export CSV/XLSX

### Chưa có

- Runtime làm bài nội bộ từ câu hỏi snapshot
- Bảng lưu đáp án từng câu
- Attempt lifecycle nội bộ
- Autosave
- Submit nội bộ
- Chấm tự động
- Chấm thủ công tự luận
- Tổng hợp đầy đủ `missing/late/ignored` từ roster của lớp
- Trang sinh viên xem kết quả cá nhân

---

## Nguyên tắc kiến trúc bắt buộc

### 1. Giữ song song hai mode delivery

Assessment phải được phân thành hai mode rõ ràng:

- `external`
  - Google Form
  - Microsoft Form
  - nguồn ngoài khác
- `internal`
  - đề được render và làm trực tiếp trong website

Không thay thế luồng external hiện tại. Chỉ bổ sung internal mode.

### 2. Không phá cấu trúc hiện có

Tận dụng lại các tài nguyên đang có:

- `assessments` là bản ghi trung tâm
- `question_bank_items` và `assessment_question_links` tiếp tục là nguồn đề
- `submissions` tiếp tục là bảng chuẩn hóa đầu ra cuối cùng
- `course_assessment_results` tiếp tục là bảng mirror để dashboard/tổng hợp

### 3. Chuẩn hóa đầu ra

Dù bài kiểm tra đến từ:

- `internal`,
- `google_form`,
- `microsoft_form`,
- `csv_import`,

thì sau cùng vẫn phải hội tụ về:

- `submissions`
- `course_assessment_results`

Điều này giữ nguyên contract của dashboard, export, và thống kê.

---

## Đề xuất mô hình nghiệp vụ mới

### Assessment cấp cao

Thêm khái niệm:

- `deliveryMode = "external" | "internal"`

Vẫn giữ:

- `provider = "google_form" | "microsoft_form" | "manual" | "other"`

Đề xuất sau khi nâng cấp:

- `provider = "google_form" | "microsoft_form" | "internal" | "other"`

Trong giai đoạn chuyển tiếp có thể:

- tạm giữ `manual`
- map `manual` cũ sang `internal`

### Bảng mới cần có

1. `assessment_attempts`
- quản lý từng lượt làm bài của sinh viên
- trạng thái: `in_progress`, `submitted`, `auto_graded`, `graded`, `abandoned`, `expired`

2. `assessment_answers`
- lưu câu trả lời theo từng câu hỏi snapshot
- hỗ trợ objective và subjective answers

3. `assessment_answer_scores`
- lưu điểm chấm từng câu
- hỗ trợ auto-grade + teacher override + rubric note

### Bảng hiện có sẽ được dùng tiếp

- `assessment_question_links`
  - nguồn snapshot câu hỏi của một assessment
- `submissions`
  - bản ghi kết quả cuối cùng
- `course_assessment_results`
  - mirror theo học phần/lớp

---

## Phase A

## Mode internal + data model tối thiểu

### Mục tiêu phase

Tạo đủ nền móng dữ liệu và contract để assessment có thể chạy ở cả hai mode:

- external
- internal

Phase này **chưa cần sinh viên làm bài hoàn chỉnh**, nhưng phải xong:

- dữ liệu,
- service contract,
- quyền truy cập,
- authoring shape.

### Kết quả đầu ra

- Assessment có `deliveryMode`
- Có migration cho `assessment_attempts`, `assessment_answers`, `assessment_answer_scores`
- Có service/repository đọc snapshot câu hỏi theo assessment
- Có contract rõ ràng cho internal attempt lifecycle

### Những gì cần bổ sung

#### Database

Tạo migration mới, ví dụ:

- `supabase/migrations/20260619xxxx_phase4_internal_assessment_runtime.sql`

Nội dung chính:

- alter `assessments`
  - add `delivery_mode`
  - optional add `attempt_limit`
  - optional add `shuffle_questions`
  - optional add `show_feedback_after_submit`
  - optional add `time_limit_minutes`

- create `assessment_attempts`
  - `id`
  - `assessment_id`
  - `student_id`
  - `attempt_number`
  - `status`
  - `started_at`
  - `submitted_at`
  - `expires_at`
  - `auto_graded_at`
  - `graded_at`
  - `metadata`

- create `assessment_answers`
  - `attempt_id`
  - `assessment_id`
  - `question_bank_item_id`
  - `sort_order`
  - `answer_payload`
  - `answered_at`
  - `is_final`

- create `assessment_answer_scores`
  - `attempt_id`
  - `question_bank_item_id`
  - `auto_score`
  - `manual_score`
  - `final_score`
  - `grader_id`
  - `feedback`
  - `graded_at`

#### Service layer

Tạo hoặc mở rộng:

- `lib/services/assessment-service.ts`
  - thêm `getAssessmentAuthoringMode`
  - thêm `getInternalAssessmentDefinition`

- tạo mới `lib/services/assessment-runtime-service.ts`
  - `startAssessmentAttempt`
  - `getAssessmentAttemptForStudent`
  - `saveAssessmentAnswer`
  - `submitAssessmentAttempt`
  - `finalizeAssessmentSubmission`

#### Repository layer

Tạo mới:

- `lib/repositories/assessment-runtime-repository.ts`

Chức năng:

- tạo attempt
- tìm active attempt
- upsert answer
- load snapshot câu hỏi theo assessment
- mark attempt submitted
- aggregate answer score
- write final submission row

#### Validators

Tạo mới:

- `lib/validators/assessment-runtime-validator.ts`

Schema cần có:

- start attempt
- save answer
- submit attempt
- teacher grade answer

#### Type definitions

Tạo mới hoặc mở rộng:

- `lib/types/assessment.ts`
- `lib/types/submission.ts`
- tạo mới `lib/types/assessment-runtime.ts`

### Map vào file hiện tại

#### Sửa trước

- [lib/types/assessment.ts](/abs/path/d:/My_Website/lib/types/assessment.ts)
  - thêm `deliveryMode`
  - thêm config cho internal mode

- [lib/validators/assessment-validator.ts](/abs/path/d:/My_Website/lib/validators/assessment-validator.ts)
  - thêm field cho internal mode

- [lib/services/assessment-service.ts](/abs/path/d:/My_Website/lib/services/assessment-service.ts)
  - normalize external/internal mode

- [lib/repositories/assessment-repository.ts](/abs/path/d:/My_Website/lib/repositories/assessment-repository.ts)
  - lưu field mới của assessment

- [app/(teacher)/assessments/actions.ts](/abs/path/d:/My_Website/app/(teacher)/assessments/actions.ts)
  - nhận thêm form field internal mode

- [app/(teacher)/assessments/assessment-management-client.tsx](/abs/path/d:/My_Website/app/(teacher)/assessments/assessment-management-client.tsx)
  - thêm UI chuyển mode
  - khi `internal` thì ẩn formUrl
  - khi `external` thì giữ UI cũ

#### Thêm mới

- `lib/services/assessment-runtime-service.ts`
- `lib/repositories/assessment-runtime-repository.ts`
- `lib/validators/assessment-runtime-validator.ts`
- `lib/types/assessment-runtime.ts`

### Xong phase này khi

- Tạo được assessment dạng `internal`
- Assessment dạng `internal` có thể load đầy đủ snapshot câu hỏi
- Có thể tạo attempt đầu tiên ở mức dữ liệu
- External flow cũ vẫn chạy bình thường

---

## Phase B

## Sinh viên làm bài + autosave + nộp bài

### Mục tiêu phase

Biến assessment `internal` thành bài làm được ngay trong website.

### Kết quả đầu ra

- Sinh viên mở assessment internal và thấy câu hỏi
- Có thể trả lời từng câu
- Có autosave
- Có submit
- Có resume attempt đang dở
- Sau submit tạo ra `submission`

### Những gì cần bổ sung

#### UI sinh viên

Mở rộng:

- [app/(student)/my-classes/assessments/[assessmentId]/assessment-taking-client.tsx](/abs/path/d:/My_Website/app/(student)/my-classes/assessments/%5BassessmentId%5D/assessment-taking-client.tsx)

Hiện trạng:

- chỉ mở iframe hoặc tab mới

Sau nâng cấp:

- nếu `deliveryMode === "external"`:
  - giữ nguyên logic hiện tại
- nếu `deliveryMode === "internal"`:
  - render câu hỏi từ snapshot
  - hiển thị tiến độ
  - autosave theo thay đổi
  - submit bài

#### Student page loader

Sửa:

- [app/(student)/my-classes/assessments/[assessmentId]/page.tsx](/abs/path/d:/My_Website/app/(student)/my-classes/assessments/%5BassessmentId%5D/page.tsx)

Cần:

- load definition nếu internal
- load active attempt nếu có
- truyền state vào client

#### Actions / API

Tạo mới:

- `app/(student)/my-classes/assessments/[assessmentId]/actions.ts`

Action cần có:

- `startAssessmentAttemptAction`
- `saveAssessmentAnswerAction`
- `submitAssessmentAttemptAction`

Nếu autosave tần suất cao, nên dùng:

- API route riêng cho answer autosave

ví dụ:

- `app/api/assessments/[assessmentId]/attempts/[attemptId]/answers/route.ts`

để tránh server action bị nặng và khó debounce.

#### Service layer

Mở rộng `assessment-runtime-service.ts`:

- `startAssessmentAttempt`
- `saveAssessmentAnswer`
- `getOrCreateActiveAttempt`
- `submitAssessmentAttempt`

#### Repository layer

Mở rộng `assessment-runtime-repository.ts`:

- load question snapshots
- upsert answers
- lock attempt after submit
- compute attempt completeness

### Map vào file hiện tại

#### Sửa trước

- [app/(student)/my-classes/assessments/[assessmentId]/assessment-taking-client.tsx](/abs/path/d:/My_Website/app/(student)/my-classes/assessments/%5BassessmentId%5D/assessment-taking-client.tsx)
- [app/(student)/my-classes/assessments/[assessmentId]/page.tsx](/abs/path/d:/My_Website/app/(student)/my-classes/assessments/%5BassessmentId%5D/page.tsx)
- [lib/services/assessment-service.ts](/abs/path/d:/My_Website/lib/services/assessment-service.ts)
  - phân nhánh external/internal khi load detail

#### Thêm mới

- `app/(student)/my-classes/assessments/[assessmentId]/actions.ts`
- optional `app/api/assessments/[assessmentId]/attempts/[attemptId]/answers/route.ts`

### Xong phase này khi

- Sinh viên làm được bài internal ngay trong website
- Có thể refresh rồi quay lại làm tiếp
- Submit xong tạo attempt trạng thái `submitted`
- External mode không bị ảnh hưởng

---

## Phase C

## Chấm điểm + tổng hợp + dashboard kết quả

### Mục tiêu phase

Sau khi sinh viên submit bài internal, hệ thống phải:

- chấm tự động phần objective,
- chấm tay phần subjective,
- ghi ra `submissions`,
- mirror sang `course_assessment_results`,
- hiển thị được ở trang kết quả và dashboard.

Trang thai trien khai hien tai:

- [x] Hoan thanh Phase C o muc luong chinh, bao gom grading, result lifecycle theo roster, dashboard/export va trang sinh vien xem ket qua ca nhan.
- [x] Da hoan thien them luong hardening cho assessment external: import template CSV/XLSX, export CSV ket qua va XLSX thong ke tach rieng, sort cot ket qua, doi chieu theo `student code`, va fix refresh/relogin khong lam reset thoi gian lam bai cua tung sinh vien.

### Kết quả đầu ra

- objective questions được auto-grade
- essay questions có UI cho giảng viên chấm
- `submissions` được finalize chuẩn
- `missing/late/ignored` được tính đúng
- sinh viên xem được kết quả cá nhân

### Những gì cần bổ sung

#### Auto-grade engine

Tạo mới:

- `lib/services/assessment-grading-service.ts`

Chức năng:

- chấm `multiple_choice`
- chấm `true_false`
- chấm `short_answer` theo normalized rule cơ bản
- bỏ qua `essay` để chấm tay

#### Teacher grading UI

Mở rộng:

- [app/(teacher)/assessments/[assessmentId]/results/page.tsx](/abs/path/d:/My_Website/app/(teacher)/assessments/%5BassessmentId%5D/results/page.tsx)

Cần thêm:

- mở chi tiết 1 attempt
- xem từng câu và câu trả lời
- nhập điểm tay từng câu tự luận
- feedback
- finalize grade

Nên tách thêm:

- `app/(teacher)/assessments/[assessmentId]/results/[attemptId]/page.tsx`
- hoặc component chi tiết riêng

#### Submission finalization

Mở rộng:

- [lib/services/submission-service.ts](/abs/path/d:/My_Website/lib/services/submission-service.ts)

Hiện tại file này mạnh về external ingest.

Sau nâng cấp cần:

- nhận output từ internal grading
- upsert `submissions` với `source = manual` hoặc `internal`
- mirror sang `course_assessment_results`

Khuyến nghị:

- đổi type `SubmissionSource`
  - thêm `internal`

Sửa:

- [lib/types/submission.ts](/abs/path/d:/My_Website/lib/types/submission.ts)
- [lib/repositories/submission-repository.ts](/abs/path/d:/My_Website/lib/repositories/submission-repository.ts)
- [lib/repositories/question-bank-repository.ts](/abs/path/d:/My_Website/lib/repositories/question-bank-repository.ts)
- migration constraint liên quan `source`

#### Late / missing / ignored lifecycle

Tạo mới:

- `lib/services/assessment-result-lifecycle-service.ts`

Chức năng:

- dựa trên `class_members` active
- dựa trên `openAt`, `dueAt`
- nếu không có submission sau deadline -> `missing`
- nếu submit sau deadline -> `late`
- nếu được miễn/loại khỏi thống kê -> `ignored`

Điểm này cần áp dụng cho:

- internal mode
- external mode

để kết quả cuối cùng thống nhất.

#### Student result page

Tạo mới:

- `app/(student)/my-classes/assessments/[assessmentId]/results/page.tsx`

Cần hiển thị:

- điểm
- trạng thái
- attempt history
- feedback
- đáp án đúng/sai nếu cấu hình cho phép

#### Dashboard aggregation

Rà và mở rộng:

- [lib/repositories/dashboard-repository.ts](/abs/path/d:/My_Website/lib/repositories/dashboard-repository.ts)

Cần đảm bảo:

- completion rate tính cả `submitted` + `late`
- có denominator là tổng sinh viên expected của lớp
- có thể thêm breakdown:
  - not started
  - in progress
  - submitted
  - graded

### Map vào file hiện tại

#### Sửa trước

- [lib/types/submission.ts](/abs/path/d:/My_Website/lib/types/submission.ts)
- [lib/services/submission-service.ts](/abs/path/d:/My_Website/lib/services/submission-service.ts)
- [lib/repositories/submission-repository.ts](/abs/path/d:/My_Website/lib/repositories/submission-repository.ts)
- [lib/repositories/question-bank-repository.ts](/abs/path/d:/My_Website/lib/repositories/question-bank-repository.ts)
- [app/(teacher)/assessments/[assessmentId]/results/page.tsx](/abs/path/d:/My_Website/app/(teacher)/assessments/%5BassessmentId%5D/results/page.tsx)
- [lib/services/export-service.ts](/abs/path/d:/My_Website/lib/services/export-service.ts)
- [lib/repositories/dashboard-repository.ts](/abs/path/d:/My_Website/lib/repositories/dashboard-repository.ts)

#### Thêm mới

- `lib/services/assessment-grading-service.ts`
- `lib/services/assessment-result-lifecycle-service.ts`
- `app/(teacher)/assessments/[assessmentId]/results/[attemptId]/page.tsx`
- `app/(student)/my-classes/assessments/[assessmentId]/results/page.tsx`

### Xong phase này khi

- Bài internal được chấm và sinh submission cuối cùng
- Bài external vẫn ingest bình thường như cũ
- `missing/late/ignored` được sinh ra đúng nghiệp vụ
- Trang teacher results và dashboard dùng chung một nguồn kết quả chuẩn hóa
- UI kết quả external đã chuẩn hóa import/export, tiếng Việt hiển thị đúng trong CSV/XLSX, và luồng làm bài theo thời gian được gắn với từng sinh viên thay vì chỉ lưu ở client.

---

## Thứ tự ưu tiên sửa file

### Ưu tiên 1: nền móng mode internal

1. `supabase/migrations/*internal_assessment_runtime.sql`
2. [lib/types/assessment.ts](/abs/path/d:/My_Website/lib/types/assessment.ts)
3. [lib/validators/assessment-validator.ts](/abs/path/d:/My_Website/lib/validators/assessment-validator.ts)
4. [lib/services/assessment-service.ts](/abs/path/d:/My_Website/lib/services/assessment-service.ts)
5. [lib/repositories/assessment-repository.ts](/abs/path/d:/My_Website/lib/repositories/assessment-repository.ts)
6. [app/(teacher)/assessments/assessment-management-client.tsx](/abs/path/d:/My_Website/app/(teacher)/assessments/assessment-management-client.tsx)

### Ưu tiên 2: runtime sinh viên

1. `lib/types/assessment-runtime.ts`
2. `lib/validators/assessment-runtime-validator.ts`
3. `lib/repositories/assessment-runtime-repository.ts`
4. `lib/services/assessment-runtime-service.ts`
5. [app/(student)/my-classes/assessments/[assessmentId]/page.tsx](/abs/path/d:/My_Website/app/(student)/my-classes/assessments/%5BassessmentId%5D/page.tsx)
6. [app/(student)/my-classes/assessments/[assessmentId]/assessment-taking-client.tsx](/abs/path/d:/My_Website/app/(student)/my-classes/assessments/%5BassessmentId%5D/assessment-taking-client.tsx)

### Ưu tiên 3: grading và result lifecycle

1. `lib/services/assessment-grading-service.ts`
2. `lib/services/assessment-result-lifecycle-service.ts`
3. [lib/types/submission.ts](/abs/path/d:/My_Website/lib/types/submission.ts)
4. [lib/services/submission-service.ts](/abs/path/d:/My_Website/lib/services/submission-service.ts)
5. [lib/repositories/submission-repository.ts](/abs/path/d:/My_Website/lib/repositories/submission-repository.ts)
6. [app/(teacher)/assessments/[assessmentId]/results/page.tsx](/abs/path/d:/My_Website/app/(teacher)/assessments/%5BassessmentId%5D/results/page.tsx)
7. [lib/services/export-service.ts](/abs/path/d:/My_Website/lib/services/export-service.ts)
8. [lib/repositories/dashboard-repository.ts](/abs/path/d:/My_Website/lib/repositories/dashboard-repository.ts)

---

## Rủi ro chính cần tránh

### 1. Trộn logic internal và external vào cùng một UI path mà không tách mode

Hậu quả:

- code khó đọc,
- validation chồng chéo,
- regression với Google/Microsoft Form.

### 2. Ghi trực tiếp điểm vào `submissions` trước khi có attempt/answers

Hậu quả:

- mất khả năng review,
- không regrade được,
- không audit được.

### 3. Tính `missing` chỉ từ bảng submissions

Sai vì `missing` phải dựa trên:

- roster sinh viên active của lớp
- assessment deadline

### 4. Chấm tự động dựa trên prompt thay vì snapshot

Phải chấm dựa trên snapshot trong `assessment_question_links`, không dùng câu hỏi gốc từ `question_bank_items`.

---

## Definition of Done cho toàn bộ roadmap này

Module assessment chỉ được coi là hoàn chỉnh khi:

- tạo được assessment `external` và `internal`
- internal assessment render được trong website
- sinh viên làm bài, autosave, submit được
- objective questions auto-grade được
- subjective questions teacher-grade được
- `submissions` là output chuẩn cuối cùng
- `course_assessment_results` mirror đúng
- `missing/late/ignored` tính đúng
- dashboard và export không phân biệt nguồn internal/external

---

## Khuyến nghị thực thi

Nên triển khai theo 3 PR hoặc 3 batch công việc tách biệt:

1. **PR1 / Phase A**
   - chỉ chạm schema + type + service contract + authoring mode

2. **PR2 / Phase B**
   - chỉ chạm runtime sinh viên + autosave + submit

3. **PR3 / Phase C**
   - chỉ chạm grading + lifecycle + reporting

Làm như vậy sẽ giảm rủi ro regression lên luồng Google/Microsoft Form đang có.
