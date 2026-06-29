# DATABASE_SCHEMA.md

# Learning Management Platform (LMP) DATABASE SCHEMA

## 1. Vai trò của file này

File này mô tả thiết kế cơ sở dữ liệu chính thức cho Learning Management Platform (LMP). Mọi thay đổi database phải đi qua migration và cập nhật file này. AI Agent không được tự ý thêm bảng/cột nếu chưa xác định business rule và service contract liên quan.

---

## 2. Database engine

- Engine: Supabase PostgreSQL
- Auth source: `auth.users`
- Extension khuyến nghị: `uuid-ossp` hoặc `pgcrypto`
- RLS: Bắt buộc bật cho bảng chứa dữ liệu người dùng/học tập

---

## 3. Quy ước chung

### 3.1. ID và thời gian

- Primary key: `uuid`, default `gen_random_uuid()`.
- Timestamp: `created_at`, `updated_at` dạng `timestamptz`.
- Soft delete/archive: dùng `status` hoặc `archived_at`, không hard-delete dữ liệu quan trọng.

### 3.2. Naming convention

- Tên bảng: snake_case số nhiều, ví dụ `class_members`.
- Tên cột: snake_case.
- Foreign key: `{entity}_id`.
- Enum/status dùng text + check constraint hoặc PostgreSQL enum nếu ổn định.

### 3.3. Triết lý schema

Schema phải làm giảm lỗi ở tầng ứng dụng bằng constraint rõ ràng. Không để mọi lỗi dồn lên UI. Ưu tiên unique index, foreign key, check constraint và RLS để “thiết kế lỗi ra khỏi hệ thống” càng nhiều càng tốt.

---

## 4. ERD khái niệm

```text
auth.users
  └── profiles
  ├── permission_scopes
  ├── enrollment_requests
  ├── global_notifications
  ├── student_profile_stats
  ├── personal_library_settings
        ├── courses
        │     ├── question_bank_items
        │     ├── course_assessment_results
        │     ├── materials
        │     ├── simulations
        │     ├── library_categories
        │     └── classes
        │           ├── class_members
        │           ├── class_resource_links
  │           ├── class_sessions
        │           ├── class_announcements
  │           ├── direct_messages
        │           └── assessments
        │                 ├── assessment_question_links
        │                 ├── assessment_attempts
        │                 │     ├── assessment_answers
        │                 │     └── assessment_answer_scores
        │                 └── submissions
        └── activity_logs
```

---

## 5. Bảng `profiles`

Mở rộng thông tin người dùng từ Supabase Auth.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK, FK đến `auth.users.id` |
| `email` | text | Có | Đồng bộ từ auth hoặc nhập ban đầu |
| `full_name` | text | Có | Họ tên hiển thị |
| `role` | text | Có | `admin`, `moderator`, `teacher`, `student` |
| `student_code` | text | Không | Mã sinh viên, unique nếu có |
| `role_code` | text | Không | Mã nhân sự, unique nếu có; dùng cho `admin`, `moderator`, `teacher` |
| `status` | text | Có | `active`, `inactive`, `archived` |
| `access_status` | text | Có | `pending_approval`, `active`, `suspended`, `expired` |
| `access_expires_at` | timestamptz | Không | Mốc hết hạn truy cập tài khoản sinh viên |
| `approved_by` | uuid | Không | FK `profiles.id`, người duyệt truy cập |
| `approved_at` | timestamptz | Không | Thời điểm duyệt truy cập |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
check (role in ('admin', 'moderator', 'teacher', 'student'));
check (status in ('active', 'inactive', 'archived'));
check (access_status in ('pending_approval', 'active', 'suspended', 'expired'));
```

Dong bo voi Supabase Auth:

- Trigger `on_auth_user_created` tren `auth.users` goi function `public.handle_new_auth_user()` de tao/upsert profile tu dong.
- Trigger uu tien lay role tu `raw_app_meta_data.role`, sau do fallback `raw_user_meta_data.role`; neu khong hop le thi fallback role `student`.
- Trigger lay `full_name` tu `raw_user_meta_data.full_name`, neu thieu thi fallback phan truoc dau @ cua email.
- Trong luong hien hanh, tai khoan sinh vien do Admin tao trong `User management`; public self-signup da khoa tren UI login.
- Neu he thong van nhan du lieu `student` tu luong public/legacy, trigger fallback `access_status = 'pending_approval'` de giu tuong thich voi workflow duyet/gia han truy cap.
- `approved_by` chi chap nhan actor role `admin`, `moderator`, hoac `teacher` co scope hop le.
- Tai khoan `admin`, `teacher` va `moderator` dung `role_code`; tai khoan `student` dung `student_code`.

RLS bo sung cho admin:

- Policy `Admins can read all profiles` cho phep doc toan bo `profiles` khi JWT claim `app_metadata.role = 'admin'`.

Nguyen tac profile sinh vien nhe:

- `profiles` chi luu thong tin danh tinh va trang thai truy cap.
- Du lieu ket qua chi tiet luu tai `submissions`.
- Thong ke tong hop profile doc tu `student_profile_stats` (hoac materialized view tuong duong).

---

## 5.1. Bảng `permission_scopes`

Rang buoc quyen theo pham vi cho moderator/teacher khi can delegated access.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `actor_id` | uuid | Có | FK `profiles.id`, nguoi duoc cap quyen |
| `scope_type` | text | Có | `system`, `course`, `class` |
| `scope_id` | uuid | Không | ID cua `course` hoac `class` khi khong phai `system` |
| `permissions` | jsonb | Có | Danh sach quyen, vi du `{"manage_members": true}` |
| `status` | text | Có | `active`, `revoked` |
| `granted_by` | uuid | Có | FK `profiles.id`, nguoi cap quyen |
| `expires_at` | timestamptz | Không | Han hieu luc scope |
| `created_at` | timestamptz | Có | Default now |

Constraint:

```sql
check (scope_type in ('system', 'course', 'class'));
check (status in ('active', 'revoked'));
```

---

## 5.2. Bảng `enrollment_requests`

Luu yeu cau tham gia nhieu hoc phan/lop khi sinh vien tao tai khoan.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `student_id` | uuid | Có | FK `profiles.id` |
| `course_id` | uuid | Có | FK `courses.id` |
| `class_id` | uuid | Không | FK `classes.id`, neu sinh vien chon lop cu the |
| `status` | text | Có | `pending`, `approved`, `rejected`, `cancelled` |
| `requested_at` | timestamptz | Có | Default now |
| `reviewed_by` | uuid | Không | FK `profiles.id` |
| `reviewed_at` | timestamptz | Không | Thoi diem duyet |
| `review_note` | text | Không | Ly do tu choi/ghi chu |

Constraint:

```sql
check (status in ('pending', 'approved', 'rejected', 'cancelled'));
unique(student_id, course_id, class_id, status) where status = 'pending';
```

---

## 6. Bảng `courses`

Quản lý học phần.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `owner_id` | uuid | Có | FK `profiles.id`, giám sát viên phụ trách học phần |
| `code` | text | Có | Mã học phần |
| `title` | text | Có | Tên học phần |
| `description` | text | Không | Mô tả học phần |
| `visibility` | text | Có | `private`, `unlisted`, `public_preview` |
| `status` | text | Có | `draft`, `active`, `archived` |
| `credits` | int | Không | Số tín chỉ, 1-20 |
| `knowledge_block` | text | Không | `general`, `foundation`, `major` tương ứng Đại cương, Cơ sở ngành, Ngành/Chuyên ngành |
| `course_type` | text | Không | `required`, `elective` tương ứng Bắt buộc/Tự chọn |
| `clo_items` | jsonb | Có | Danh sách `{ code, description }` của CLO |
| `assessment_components` | jsonb | Có | Danh sách `{ type, weight, cloCodes }`, với `type` thuộc `diagnostic/frequent/periodic/final`, tổng trọng số nghiệp vụ phải bằng 100% khi nhập |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Index/constraint:

```sql
unique(owner_id, code);
check (visibility in ('private', 'unlisted', 'public_preview'));
check (status in ('draft', 'active', 'archived'));
check (credits is null or credits between 1 and 20);
check (knowledge_block is null or knowledge_block in ('general', 'foundation', 'major'));
check (course_type is null or course_type in ('required', 'elective'));
```

RLS/quyen:

- Moderator la actor van hanh chinh cua hoc phan: tao/cap nhat/lưu trữ/xóa hoc phan truc tiep.
- Admin khong con tham gia luong nghiep vu hoc phan; vai tro nay danh cho quan tri he thong va bao cao tong hop.
- `permission_scopes` van duoc giu cho cac luong lien quan den lop/tai nguyen, nhung khong con dung de buoc Mod phai cho duyet hoc phan.

---

## 7. Bảng `classes`

Quản lý lớp học phần.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `course_id` | uuid | Có | FK `courses.id` |
| `teacher_id` | uuid | Có | FK `profiles.id` |
| `class_code` | text | Có | Mã lớp |
| `title` | text | Có | Tên lớp |
| `semester` | text | Không | Ví dụ: HK1 |
| `academic_year` | text | Không | Ví dụ: 2026-2027 |
| `status` | text | Có | `draft`, `active`, `archived` |
| `is_open_for_enrollment` | boolean | Có | Chỉ khi `true` lớp mới xuất hiện ở khung đăng ký công khai trên trang đăng nhập |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Index/constraint:

```sql
unique(teacher_id, class_code, academic_year, semester);
check (status in ('draft', 'active', 'archived'));
```

Trang thai trien khai:

- Da duoc tao qua migration `202605280006_create_classes.sql` de ho tro membership-based material access.
- Migration `202606290002_class_public_enrollment_visibility.sql` bo sung `is_open_for_enrollment` de tach ro `lop active` va `lop dang mo dang ky`.
- Migration `202606290006_class_auto_enrollment_approval.sql` bo sung `auto_approve_enrollment` de teacher bat/tat che do duyet tu dong yeu cau tham gia lop.
- Migration `202605280009_student_class_read_policy.sql` bo sung helper `public.has_active_membership_for_class(target_class_id uuid)` va policy cho student doc lop theo active membership.
- Migration `202605280013_phase33_student_access_rls_enforcement.sql` cap nhat helper membership de bat buoc `public.is_student_access_active(auth.uid())` truoc khi cho student doc `classes`/`materials`.

---

## 8. Bảng `assessments`

Luu bai kiem tra theo lop hoc, co snapshot thanh phan danh gia va danh sach CLO ap dung.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id` |
| `course_id` | uuid | Có | FK `courses.id` |
| `created_by` | uuid | Có | FK `profiles.id` |
| `title` | text | Có | Tieu de bai kiem tra |
| `description` | text | Không | Mo ta ngan |
| `delivery_mode` | text | Có | `external` hoac `internal` |
| `provider` | text | Có | `google_form`, `microsoft_form`, `manual`, `internal`, `other` |
| `form_url` | text | Không | Link bieu mau ngoai neu co |
| `embed_mode` | text | Có | `iframe`, `new_tab`, `disabled` |
| `assessment_component_type` | text | Không | Snapshot thanh phan danh gia: `diagnostic`, `frequent`, `periodic`, `final` |
| `assessment_clo_codes` | jsonb | Có | Snapshot mang ma CLO cua assessment, mac dinh `[]` |
| `max_score` | numeric | Không | Diem toi da |
| `attempt_limit` | int | Có | So luot lam toi da |
| `shuffle_questions` | boolean | Có | Co tron cau hoi hay khong |
| `show_feedback_after_submit` | boolean | Có | Hien feedback sau nop doi voi internal |
| `time_limit_minutes` | int | Không | Gioi han thoi gian |
| `status` | text | Có | `draft`, `open`, `closed`, `archived` |
| `open_at` | timestamptz | Không | Thoi diem mo |
| `due_at` | timestamptz | Không | Han nop |
| `created_at` | timestamptz | Có | Default now |

Constraint:

```sql
check (delivery_mode in ('external', 'internal'));
check (provider in ('google_form', 'microsoft_form', 'manual', 'internal', 'other'));
check (embed_mode in ('iframe', 'new_tab', 'disabled'));
check (assessment_component_type is null or assessment_component_type in ('diagnostic', 'frequent', 'periodic', 'final'));
check (status in ('draft', 'open', 'closed', 'archived'));
```

Quy tac nghiep vu:

- `assessment_component_type` va `assessment_clo_codes` la snapshot tai thoi diem tao assessment, khong tham chieu dong ve hoc phan luc render ket qua.
- Import ket qua vao `submissions` van luu `score` tong; diem theo tung CLO di kem trong metadata cua submission de phuc vu import/export va dashboard chi tiet.

---

## 7A. Bảng `course_change_requests`

Du lieu lich su cua luong yeu cau thay doi hoc phan cu.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `action` | text | Có | `create`, `archive`, `delete` |
| `target_course_id` | uuid | Không | Có với `archive/delete`, null với `create` |
| `target_code_snapshot` | text | Không | Snapshot mã học phần |
| `target_title_snapshot` | text | Không | Snapshot tên học phần |
| `requested_code` | text | Không | Mã học phần khi Mod đề nghị tạo |
| `requested_title` | text | Không | Tên học phần khi Mod đề nghị tạo |
| `requested_description` | text | Không | Mô tả đề nghị |
| `requested_visibility` | text | Không | Visibility đề nghị |
| `requested_credits` | int | Không | Số tín chỉ đề nghị |
| `requested_knowledge_block` | text | Không | Khối kiến thức đề nghị |
| `requested_course_type` | text | Không | Bắt buộc/Tự chọn |
| `requested_clo_items` | jsonb | Có | CLO đề nghị |
| `requested_assessment_components` | jsonb | Có | Thành phần đánh giá đề nghị |
| `assigned_moderator_id` | uuid | Không | Truong lich su cua luong cu, co the null trong nghiep vu moi |
| `status` | text | Có | `pending_review`, `approved`, `rejected` |
| `requested_by` | uuid | Có | FK `profiles.id` |
| `reviewed_by` | uuid | Không | FK `profiles.id` |

Quy tắc:

- Moderator tạo, sửa, lưu trữ và xóa học phần trực tiếp.
- Bang nay khong con duoc dung trong luong nghiep vu hoc phan hien tai; chi giu lai de doc lich su neu he thong cu da ton tai du lieu.

## 7B. Bảng `class_change_requests`

Luồng yêu cầu mở/lưu trữ/xóa lớp học phần.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `action` | text | Có | `create`, `archive`, `delete` |
| `target_class_id` | uuid | Không | Có với `archive/delete`, null với `create` |
| `course_id` | uuid | Có | Học phần của lớp |
| `class_code` | text | Không | Mã lớp khi tạo |
| `title` | text | Không | Tên lớp khi tạo |
| `semester` | text | Không | Học kỳ |
| `academic_year` | text | Không | Năm học |
| `requested_status` | text | Không | Trạng thái đề nghị khi tạo |
| `requested_open_for_enrollment` | boolean | Không | Cờ đề nghị hiển thị công khai ở trang đăng nhập sau khi lớp được duyệt |
| `status` | text | Có | `pending_review`, `approved`, `rejected` |
| `requested_by` | uuid | Có | Giảng viên tạo yêu cầu mở lớp |

Quy tắc:

- Giảng viên gửi yêu cầu mở lớp; Mod/Admin duyệt mới sinh bản ghi `classes`.
- Lớp được duyệt không tự động xuất hiện ở màn đăng nhập; chỉ xuất hiện khi `requested_open_for_enrollment = true` và được apply sang `classes.is_open_for_enrollment`.
- Mod không tạo lớp trực tiếp; Mod duyệt yêu cầu thay đổi lớp theo scope và xem `Kết quả đánh giá học phần` của các học phần mình vận hành.
- Admin không tạo lớp trực tiếp trong workflow chuẩn; Admin duyệt yêu cầu mở lớp hoặc can thiệp quản trị khi cần.

---

## 8. Bảng `class_members`

Liên kết sinh viên với lớp học.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id` |
| `student_id` | uuid | Có | FK `profiles.id` |
| `student_code_snapshot` | text | Không | Mã SV tại thời điểm import |
| `full_name_snapshot` | text | Không | Tên SV tại thời điểm import |
| `status` | text | Có | `active`, `inactive`, `removed` |
| `joined_at` | timestamptz | Có | Default now |
| `removed_at` | timestamptz | Không | Khi xóa khỏi lớp |

Index/constraint:

```sql
unique(class_id, student_id);
check (status in ('active', 'inactive', 'removed'));
```

Trang thai trien khai:

- Da duoc tao qua migration `202605280007_create_class_members.sql` de ho tro student access control cho materials.
- Migration nay cung bo sung helper `public.has_active_class_membership_for_course(target_course_id uuid)` de tranh recursion trong RLS khi kiem tra membership.
- Migration `202605280008_class_member_profile_lookup.sql` bo sung function `public.find_student_profiles_for_class_membership(...)` de teacher/admin resolve student profiles khi them/import membership ma khong mo rong read access tren toan bo bang `profiles`.
- Migration `202605280013_phase33_student_access_rls_enforcement.sql` bo sung kiem tra `is_student_access_active` trong helper membership de chot luong chong truy cap voi `pending_approval` va `expired`.
- UI teacher khong con them sinh vien thu cong hoac import CSV trong luong van hanh chinh.
- Sinh vien tu gui `enrollment_requests`; teacher phu trach lop duyet thu cong hoac bat co `auto_approve_enrollment` de chap nhan ngay yeu cau moi.

---

## 8.1. Bảng `class_sessions`

Lich hoc chi tiet cua lop hoc phan.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id` |
| `session_index` | int | Có | So buoi hoc trong lop |
| `title` | text | Không | Tieu de buoi hoc |
| `start_at` | timestamptz | Có | Moc bat dau |
| `end_at` | timestamptz | Có | Moc ket thuc |
| `status` | text | Có | `planned`, `completed`, `cancelled` |

Constraint:

```sql
check (session_index >= 1);
check (end_at > start_at);
check (status in ('planned', 'completed', 'cancelled'));
unique(class_id, session_index);
```

---

## 8.2. Bảng `class_announcements`

Thong bao chung theo lop hoc phan.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id` |
| `created_by` | uuid | Có | FK `profiles.id` |
| `title` | text | Có | Tieu de thong bao |
| `content` | text | Có | Noi dung thong bao |
| `status` | text | Có | `published`, `archived` |
| `created_at` | timestamptz | Có | Default now |

---

## 8.3. Bảng `direct_messages`

Tin nhan rieng giua giang vien/moderator va sinh vien trong pham vi lop.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id` |
| `sender_id` | uuid | Có | FK `profiles.id` |
| `recipient_id` | uuid | Có | FK `profiles.id` |
| `content` | text | Có | Noi dung tin nhan |
| `created_at` | timestamptz | Có | Default now |
| `read_at` | timestamptz | Không | Thoi diem da doc |

---

## 8.4. Huong dan classroom visual layout (Sprint 5.1)

Nguyen tac khi trien khai giao dien lop hoc truc quan:

- Khong tao bang moi theo ten `Classrooms`, `Classroom_Students`, `Classroom_Resources`, `Notifications`.
- Tai su dung bang domain hien co: `classes`, `class_members`, `class_announcements`, `direct_messages`, `materials`, `simulations`.

Quy tac xep cho ngoi tu dong (khong luu seat vao DB o phien ban dau):

1. Lay danh sach `class_members` trang thai `active` cua lop.
2. Sort tang dan theo `full_name_snapshot` (fallback `profiles.full_name`).
3. Gan vi tri trai -> phai, tren -> duoi voi layout mac dinh 4 cot x 5 hang cho moi viewport.
4. Moi ban la 1 o chu nhat gom 2 khung hien thi: `Ten - Ho` (khung tren) va `MSSV` (khung duoi).

Neu can luu vi tri co dinh (phase sau):

- Mo rong `class_members` voi `seat_row` + `seat_col` (nullable) hoac tao bang rieng `class_seat_assignments`.
- Bat buoc migration + cap nhat tai lieu nay truoc khi code.

---

## 8.5. Bảng `class_resource_links`

Liên kết tài nguyên Thư viện với từng lớp học phần để giảng viên/Mod/Admin thêm hoặc bớt tài liệu, mô phỏng khỏi Màn chiếu và Tủ tài liệu mà không cần đổi trạng thái tài nguyên gốc.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id`, cascade khi xóa lớp |
| `target_type` | text | Có | `material`, `simulation` |
| `target_id` | uuid | Có | ID của `materials.id` hoặc `simulations.id` |
| `linked_by` | uuid | Không | FK `profiles.id`, người thao tác gần nhất |
| `linked_at` | timestamptz | Có | Default now |

Constraint:

```sql
unique(class_id, target_type, target_id);
check (target_type in ('material', 'simulation'));
```

Trang thai trien khai:

- Da duoc tao qua migration `202606050002_class_resource_links.sql`.
- Migration backfill cac material/simulation published hien co vao cac lop active cung hoc phan.
- Manager doc/quan ly link theo `can_manage_class`; sinh vien doc link cua lop minh theo `has_active_membership_for_class`.
- Trang `Tài nguyên lớp học` chi hien hai nhom tai nguyen de teacher chon: `Tài liệu dùng chung` (`course_id is null`) va tai nguyen gan voi dung `course_id` cua lop hien tai.
- Khi bang nay ton tai, classroom chi hien tai nguyen da duoc link rieng cho lop; neu bang chua ton tai, service fallback ve cach hien thi theo hoc phan de tranh crash trong giai doan chua apply migration.

---

## 9. Bảng `materials`

Metadata tài liệu học tập.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `course_id` | uuid | Không | FK `courses.id`; null khi tài liệu nằm trong thư viện cá nhân |
| `uploaded_by` | uuid | Có | FK `profiles.id` |
| `category_id` | uuid | Không | FK `library_categories.id` |
| `title` | text | Có | Tên tài liệu |
| `description` | text | Không | Mô tả |
| `section_label` | text | Không | Tuần/chương/chủ đề |
| `tags` | text[] | Có | Tags tìm kiếm, nhập UI bằng dấu `;` |
| `file_name` | text | Có | Tên file gốc đã sanitize |
| `file_type` | text | Có | MIME hoặc loại file |
| `file_size` | bigint | Có | Byte |
| `storage_bucket` | text | Có | Mặc định `course-materials` |
| `storage_path` | text | Có | Path private |
| `allow_download` | boolean | Có | Default true |
| `sort_order` | int | Có | Default 0 |
| `status` | text | Có | `draft`, `published`, `archived` |
| `review_status` | text | Có | `pending_review`, `approved`, `rejected`; upload cá nhân mặc định `approved`, upload theo học phần của giảng viên chờ duyệt |
| `reviewed_by` | uuid | Không | FK `profiles.id` |
| `reviewed_at` | timestamptz | Không | Thời điểm duyệt |
| `review_note` | text | Không | Ghi chú duyệt |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
check (file_size >= 0);
check (status in ('draft', 'published', 'archived'));
check (review_status in ('pending_review', 'approved', 'rejected'));
```

Trang thai trien khai:

- Da duoc tao bang qua migration `202605280005_create_materials.sql`.
- Da tao private bucket `course-materials` trong `storage.buckets`.

RLS giai doan Sprint 2.2:

- Teacher (owner cua course) doc/tao/cap nhat metadata `materials` thuoc hoc phan minh.
- Moderator duyet tai nguyen cua giang vien vao Thu vien dung chung va co the an hoac xoa truc tiep tai nguyen dung chung theo pham vi van hanh.
- Admin doc va quan ly tat ca materials qua JWT claim `app_metadata.role = 'admin'`, nhung luong UI van hanh Thu vien cua Admin chi tap trung vao danh muc va governance he thong.
- Student doc duoc materials `published` khi helper membership xac nhan co `class_members.status = active` trong mot `classes.status = active` cua course.
- Storage objects trong bucket `course-materials` cho phep owner thao tac tren object cua chinh minh; admin co policy toan cuc.
- Signed URL viewer hien duoc tao bang user-scoped server client sau khi service qua kiem tra quyen truy cap.
- Migration `202606050003_library_categories_and_tags.sql` bo sung `category_id` va `tags` de loc/tim tai nguyen trong Thu vien.
- Migration `202606070001_personal_library_upload_review.sql` cho phép `course_id` nullable, bổ sung `review_status/reviewed_by/reviewed_at/review_note`: bỏ trống học phần thì lưu thư viện cá nhân; chọn học phần từ giảng viên thì chờ Mod duyệt vào Thư viện dùng chung.

---

## 9A. Bảng `personal_library_settings`

Luu quota va muc su dung cua Thu vien ca nhan theo tung giang vien.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `teacher_id` | uuid | Có | PK/FK `profiles.id` |
| `storage_quota_bytes` | bigint | Có | Mac dinh 52428800 (50 MB) |
| `storage_used_bytes` | bigint | Có | Dong bo tu tai lieu + mo phong HTML ca nhan |
| `updated_by` | uuid | Không | FK `profiles.id`, actor cap nhat gan nhat |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
check (storage_quota_bytes > 0);
check (storage_used_bytes >= 0);
check (storage_used_bytes <= storage_quota_bytes);
```

Quy tac:

- Moi teacher phai co mot ban ghi quota rieng.
- Admin duoc dieu chinh quota.
- Service layer phai kiem tra quota truoc khi teacher upload vao thu vien ca nhan.

---

## 10. Bảng `assessments`

Bài kiểm tra trung tâm, hỗ trợ song song hai mode:

- `external`: Google Form, Microsoft Form, nguồn ngoài khác
- `internal`: render và làm trực tiếp trong website

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `class_id` | uuid | Có | FK `classes.id` |
| `course_id` | uuid | Có | FK `courses.id`, denormalize để query nhanh |
| `created_by` | uuid | Có | FK `profiles.id` |
| `title` | text | Có | Tên bài kiểm tra |
| `description` | text | Không | Mô tả |
| `delivery_mode` | text | Có | `external`, `internal` |
| `provider` | text | Có | `google_form`, `microsoft_form`, `manual`, `internal`, `other` |
| `form_url` | text | Không | Link external form |
| `external_form_id` | text | Không | ID nếu trích xuất được |
| `embed_mode` | text | Có | `iframe`, `new_tab`, `disabled` |
| `max_score` | numeric | Không | Điểm tối đa |
| `attempt_limit` | int | Có | Số lượt làm tối đa, default `1` |
| `shuffle_questions` | boolean | Có | Chỉ áp dụng cho mode `internal` |
| `show_feedback_after_submit` | boolean | Có | Chỉ áp dụng cho mode `internal` |
| `time_limit_minutes` | int | Không | Giới hạn thời gian cho mode `internal` |
| `open_at` | timestamptz | Không | Thời gian mở |
| `due_at` | timestamptz | Không | Hạn làm |
| `status` | text | Có | `draft`, `open`, `closed`, `archived` |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
check (delivery_mode in ('external', 'internal'));
check (provider in ('google_form', 'microsoft_form', 'manual', 'internal', 'other'));
check (embed_mode in ('iframe', 'new_tab', 'disabled'));
check (status in ('draft', 'open', 'closed', 'archived'));
check (max_score is null or max_score > 0);
check (attempt_limit > 0);
check (time_limit_minutes is null or time_limit_minutes > 0);
```

Trang thai trien khai:

- Da duoc tao qua migration `202605280016_phase33_assessments_foundation_rls.sql`.
- Da duoc mo rong qua migration `202606190001_phase4_internal_assessment_runtime.sql` de ho tro `delivery_mode` va runtime metadata cho de noi bo.
- Da bat RLS cho manager theo `can_manage_class` va student doc assessment khi co `has_active_membership_for_class`.

---

## 10A. Bảng `question_bank_items`

Ngan hang de thi theo hoc phan.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `course_id` | uuid | Có | FK `courses.id` |
| `created_by` | uuid | Có | FK `profiles.id` |
| `prompt` | text | Có | Noi dung cau hoi |
| `question_type` | text | Có | `multiple_choice`, `true_false`, `short_answer`, `essay` |
| `choices` | text[] | Không | Lua chon dap an neu can |
| `answer_key` | jsonb | Không | Dap an dung |
| `explanation` | text | Không | Giai thich |
| `difficulty` | text | Có | `easy`, `medium`, `hard` |
| `default_points` | numeric | Có | Diem mac dinh |
| `status` | text | Có | `active`, `archived` |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

## 10B. Bảng `assessment_question_links`

Lien ket cau hoi ngan hang de voi assessment cua lop hoc.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `assessment_id` | uuid | Có | FK `assessments.id` |
| `question_bank_item_id` | uuid | Có | FK `question_bank_items.id` |
| `sort_order` | int | Có | Thu tu cau hoi |
| `points_override` | numeric | Không | Override diem mac dinh |
| `snapshot_prompt` | text | Có | Snapshot noi dung cau hoi |
| `snapshot_question_type` | text | Có | Snapshot loai cau hoi |
| `snapshot_choices` | jsonb | Không | Snapshot lua chon |
| `snapshot_answer_key` | jsonb | Không | Snapshot dap an |
| `snapshot_explanation` | text | Không | Snapshot giai thich |

---

## 10C. Bảng `assessment_attempts`

Luu tung luot lam bai cua sinh vien doi voi assessment mode `internal`.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `assessment_id` | uuid | Có | FK `assessments.id` |
| `student_id` | uuid | Có | FK `profiles.id` |
| `attempt_number` | int | Có | Thu tu lan lam, bat dau tu `1` |
| `status` | text | Có | `in_progress`, `submitted`, `auto_graded`, `graded`, `abandoned`, `expired` |
| `started_at` | timestamptz | Có | Thoi diem bat dau |
| `submitted_at` | timestamptz | Không | Thoi diem nop |
| `expires_at` | timestamptz | Không | Moc het han attempt neu co |
| `auto_graded_at` | timestamptz | Không | Thoi diem cham tu dong |
| `graded_at` | timestamptz | Không | Thoi diem chot diem cuoi |
| `metadata` | jsonb | Không | Metadata runtime phu tro |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Quy tac:

- Unique theo `(assessment_id, student_id, attempt_number)`.
- RLS:
  - manager manage theo `can_manage_assessment`
  - student chi duoc thao tac attempt cua chinh minh va chi khi con membership active voi class cua assessment

---

## 10D. Bảng `assessment_answers`

Luu dap an tung cau trong moi `assessment_attempt`.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `attempt_id` | uuid | Có | FK `assessment_attempts.id` |
| `assessment_id` | uuid | Có | FK `assessments.id` |
| `question_bank_item_id` | uuid | Có | FK `question_bank_items.id` |
| `sort_order` | int | Có | Snapshot thu tu cau hoi |
| `answer_payload` | jsonb | Có | Noi dung dap an da normalize |
| `answered_at` | timestamptz | Không | Lan cap nhat gan nhat |
| `is_final` | boolean | Có | Danh dau dap an da khoa khi nop bai |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Quy tac:

- Unique theo `(attempt_id, question_bank_item_id)`.
- Co rang buoc FK tong hop `(assessment_id, question_bank_item_id)` vao `assessment_question_links` de dam bao dap an chi tro toi cau hoi da duoc snapshot vao assessment.

---

## 10E. Bảng `assessment_answer_scores`

Luu diem va feedback tung cau hoi cua assessment noi bo.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `attempt_id` | uuid | Có | FK `assessment_attempts.id` |
| `question_bank_item_id` | uuid | Có | FK `question_bank_items.id` |
| `auto_score` | numeric | Không | Diem cham tu dong |
| `manual_score` | numeric | Không | Diem override/cham tay |
| `final_score` | numeric | Không | Diem cuoi cung cua cau |
| `grader_id` | uuid | Không | FK `profiles.id` |
| `feedback` | text | Không | Ghi chu cham bai |
| `graded_at` | timestamptz | Không | Thoi diem cham |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Quy tac:

- Unique theo `(attempt_id, question_bank_item_id)`.
- Student chi doc score cua chinh minh; manager duoc manage trong scope assessment.

---

## 11. Bảng `submissions`

Kết quả bài kiểm tra.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `assessment_id` | uuid | Có | FK `assessments.id` |
| `student_id` | uuid | Có | FK `profiles.id` |
| `student_identifier` | text | Có | Dinh danh idempotent (studentCode/email/fallback) |
| `external_response_id` | text | Không | ID response từ provider nếu có |
| `attempt_number` | int | Có | Default 1 |
| `raw_score` | numeric | Không | Điểm thô |
| `max_score` | numeric | Không | Điểm tối đa tại thời điểm import |
| `normalized_score` | numeric | Không | Điểm quy đổi nếu có |
| `submitted_at` | timestamptz | Không | Thời gian nộp |
| `status` | text | Có | `submitted`, `late`, `missing`, `ignored` |
| `source` | text | Có | `manual`, `internal`, `csv_import`, `google_webhook`, `microsoft_webhook`, `lifecycle` |
| `import_job_id` | uuid | Không | FK `import_jobs.id`, null voi luong webhook/manual |
| `metadata` | jsonb | Không | Metadata import/webhook can thiet |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Index/constraint:

```sql
check (attempt_number >= 1);
check (source in ('manual', 'internal', 'csv_import', 'google_webhook', 'microsoft_webhook', 'lifecycle'));
check (status in ('submitted', 'late', 'missing', 'ignored'));
check (raw_score is null or raw_score >= 0);
check (max_score is null or max_score > 0);
check (normalized_score is null or (normalized_score >= 0 and normalized_score <= 100));
unique(assessment_id, external_response_id) where external_response_id is not null;
unique(assessment_id, student_identifier, attempt_number);
```

Trang thai trien khai:

- Da duoc tao qua migration `202605280018_phase42_submissions_import_jobs.sql`.
- Da bat RLS cho manager manage submissions theo `can_manage_assessment`.
- Student chi doc duoc submission cua chinh minh khi con membership active voi class cua assessment.

---

## 11A. Bảng `course_assessment_results`

Bang mirror va publish cho `Kết quả đánh giá học phần`, duoc nap tu `submissions`.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `course_id` | uuid | Có | FK `courses.id` |
| `class_id` | uuid | Có | FK `classes.id` |
| `assessment_id` | uuid | Có | FK `assessments.id` |
| `submission_id` | uuid | Có | FK `submissions.id`, unique |
| `student_id` | uuid | Có | FK `profiles.id` |
| `student_identifier` | text | Có | Dinh danh mirror |
| `student_code_snapshot` | text | Không | Snapshot ma sinh vien dung cho bang tong hop hoc phan |
| `student_full_name_snapshot` | text | Không | Snapshot ho ten sinh vien |
| `academic_year_snapshot` | text | Không | Snapshot nam hoc cua lop gui ket qua |
| `class_code_snapshot` | text | Không | Snapshot ma lop |
| `class_title_snapshot` | text | Không | Snapshot ten lop |
| `assessment_component_type` | text | Không | Snapshot thanh phan danh gia cua assessment |
| `assessment_clo_codes` | text[] | Có | Danh sach CLO snapshot de render cot dong cho bang tong hop |
| `clo_scores` | jsonb | Có | Diem theo CLO sau khi import/submit, mac dinh `{}` |
| `attempt_number` | int | Có | Lan nop |
| `raw_score` | numeric | Không | Diem tho |
| `max_score` | numeric | Không | Diem toi da |
| `normalized_score` | numeric | Không | Diem quy doi |
| `status` | text | Có | `submitted`, `late`, `missing`, `ignored` |
| `source` | text | Có | `manual`, `internal`, `csv_import`, `google_webhook`, `microsoft_webhook`, `lifecycle` |
| `submitted_at` | timestamptz | Không | Thoi diem nop |
| `published_at` | timestamptz | Không | Thoi diem giang vien bam `NỘP KẾT QUẢ` de dua vao bang tong hop hoc phan |
| `published_by` | uuid | Không | FK `profiles.id`, actor da nap ket qua len hoc phan |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Quy tac:

- Moi submission hop le co the duoc mirror sang day de chuan bi cho tong hop ket qua theo hoc phan.
- Submission noi bo sau khi sinh vien bam nop bai cung duoc mirror vao day tuong tu luong import/webhook.
- Ban ghi tong hop sinh tu `assessment-result-lifecycle-service` co the dung `source = 'lifecycle'` de bieu thi cac truong hop roster chua nop bai sau deadline.
- `submission_id` la khoa dong bo chinh; service import/webhook phai upsert vao bang nay cung luc voi `submissions`.
- Bang `Kết quả đánh giá học phần` chi doc cac dong co `published_at` khac null; neu giang vien chua bam `NỘP KẾT QUẢ` thi bang tong hop cap hoc phan chua hien dong du lieu do.
- Neu assessment khong gan CLO thi `assessment_clo_codes = []` va bang tong hop chi hien cot diem tong; neu co CLO thi hien them cac cot CLO tu `clo_scores`.

---

## 12. Bảng `simulations`

Đăng ký mô phỏng gắn với học phần.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `course_id` | uuid | Có | FK `courses.id` |
| `category_id` | uuid | Không | FK `library_categories.id` |
| `slug` | text | Có | Trùng với registry trong code |
| `title` | text | Có | Tên mô phỏng |
| `description` | text | Không | Mô tả |
| `tags` | text[] | Có | Tags tìm kiếm, nhập UI bằng dấu `;` |
| `config` | jsonb | Không | Cấu hình tham số |
| `sort_order` | int | Có | Default 0 |
| `status` | text | Có | `draft`, `published`, `archived` |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
unique(course_id, slug);
check (status in ('draft', 'published', 'archived'));
```

Trang thai trien khai:

- Da duoc tao qua migration `202606020001_phase51_simulations_registry.sql`.
- Da bat RLS cho course owner/moderator scoped/admin manage va student read published theo membership active.
- Học phần mới được seed widget native mặc định ở service layer; migration `202606040005_scoped_course_visibility_and_widget_seed.sql` bổ sung backfill cho các học phần đã có và policy scoped course visibility.
- Migration `202606050003_library_categories_and_tags.sql` bo sung `category_id` va `tags` de loc/tim mo phong trong Thu vien.

---

## 12.0. Bảng `library_categories`

Danh mục dùng chung cho tài liệu, mô phỏng native và mô phỏng HTML upload trong Thư viện.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `name` | text | Có | Tên hiển thị |
| `slug` | text | Có | Slug unique sinh từ tên |
| `description` | text | Không | Mô tả ngắn |
| `sort_order` | int | Có | Thứ tự hiển thị |
| `status` | text | Có | `active`, `archived` |
| `created_by` | uuid | Không | FK `profiles.id` |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
unique(slug);
check (status in ('active', 'archived'));
```

Trang thai trien khai:

- Da duoc tao qua migration `202606050003_library_categories_and_tags.sql`.
- Giang vien doc danh muc active de gan tai nguyen khi upload.
- Admin duoc tao, sua va luu tru danh muc; Moderator chi su dung danh muc trong cac luong upload/duyet, khong quan ly danh muc.

---

## 12A. Bảng `simulation_uploads`

Lưu mô phỏng HTML độc lập được tải lên Thư viện trước khi gắn vào học phần.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `uploaded_by` | uuid | Có | FK `profiles.id` |
| `requested_course_id` | uuid | Không | FK `courses.id`; học phần giảng viên muốn đưa mô phỏng vào Thư viện dùng chung |
| `category_id` | uuid | Không | FK `library_categories.id` |
| `title` | text | Có | Tên mô phỏng |
| `description` | text | Không | Mô tả ngắn |
| `original_file_name` | text | Có | Tên file đã chuẩn hóa |
| `file_type` | text | Có | V1: `text/html` |
| `file_size` | bigint | Có | Kích thước byte |
| `tags` | text[] | Có | Tags tìm kiếm, nhập UI bằng dấu `;` |
| `storage_bucket` | text | Có | Default `simulation-packages` |
| `storage_path` | text | Có | Private path, không trả về UI |
| `review_status` | text | Có | `pending_review`, `approved`, `rejected`; upload mới mặc định `approved` |
| `native_integration_status` | text | Có | `not_requested`, `requested`, `accepted`, `rejected` |
| `reviewed_by` | uuid | Không | FK `profiles.id` |
| `reviewed_at` | timestamptz | Không | Thời điểm duyệt |
| `review_note` | text | Không | Ghi chú duyệt |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
unique(storage_bucket, storage_path);
check (review_status in ('pending_review', 'approved', 'rejected'));
check (native_integration_status in ('not_requested', 'requested', 'accepted', 'rejected'));
```

Trang thai trien khai:

- Da duoc tao qua migration `202606040001_library_simulation_uploads.sql`.
- Bucket private `simulation-packages` chi nhan `text/html` trong V1.
- Uploaders doc upload cua minh; Moderator duyet cac ban ghi `pending_review`; Admin doc toan cuc va xu ly thao tac quan tri.
- Giang vien de xuat hoc phan muc tieu; Moderator co the gan upload approved vao hoc phan de tao simulation published; sinh vien mo file qua signed URL sau khi simulation duoc link vao lop.
- De xuat tich hop native dung `native_integration_status`; Admin quyet dinh chap nhan/tu choi de dua vao backlog chuyen thanh widget chinh thuc.
- Migration `202606050003_library_categories_and_tags.sql` bo sung `category_id` va `tags`.
- Migration `202606070001_personal_library_upload_review.sql` bo sung `requested_course_id`; upload co hoc phan cua giang vien cho Mod duyet, khi approved he thong co the tu gan upload vao hoc phan duoc yeu cau.

---

## 13. Bảng `activity_logs`

Ghi nhận hoạt động quan trọng.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `actor_id` | uuid | Không | FK `profiles.id` |
| `action` | text | Có | Ví dụ: `material.uploaded` |
| `entity_type` | text | Có | `course`, `class`, `material`, `assessment`, `submission` |
| `entity_id` | uuid | Không | ID thực thể |
| `metadata` | jsonb | Không | Dữ liệu phụ |
| `created_at` | timestamptz | Có | Default now |

Trang thai trien khai:

- Da duoc tao qua migration `202605280014_phase33_activity_logs.sql`.
- Da bat RLS cho insert/select theo actor va admin read-all.

---

## 13B. Bảng `global_notifications`

Thong bao chung hien o dashboard cho `admin`, `moderator`, `teacher`.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `title` | text | Có | Tieu de |
| `content` | text | Có | Noi dung |
| `status` | text | Có | `published`, `archived` |
| `audience_roles` | text[] | Có | Mac dinh `admin`, `moderator`, `teacher` |
| `created_by` | uuid | Có | FK `profiles.id` |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Quy tac:

- Chi `admin` va `moderator` duoc tao/sua thong bao.
- `teacher` chi doc thong bao `published`.

---

## 13A. Bảng `library_change_requests`

Luồng yêu cầu ẩn/xóa tài nguyên Thư viện, tránh thao tác trực tiếp thiếu kiểm soát và yêu cầu xác nhận theo vai trò.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `target_type` | text | Có | `material`, `simulation` |
| `target_id` | uuid | Có | ID tài nguyên đích |
| `action` | text | Có | `archive`, `delete` |
| `target_title_snapshot` | text | Có | Snapshot tiêu đề lúc tạo yêu cầu |
| `target_course_label_snapshot` | text | Không | Snapshot học phần/lớp liên quan |
| `status` | text | Có | `pending_review`, `approved`, `rejected` |
| `reason` | text | Không | Lý do người yêu cầu nhập |
| `review_note` | text | Không | Ghi chú Mod/Admin |
| `requested_by` | uuid | Có | FK `profiles.id` |
| `reviewed_by` | uuid | Không | FK `profiles.id` |
| `reviewed_at` | timestamptz | Không | Thời điểm duyệt |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |

Constraint:

```sql
check (target_type in ('material', 'simulation'));
check (action in ('archive', 'delete'));
check (status in ('pending_review', 'approved', 'rejected'));
unique(target_type, target_id, action) where status = 'pending_review';
```

Trang thai trien khai:

- Da duoc tao qua migration `202606040003_library_change_requests.sql`; action `delete` duoc bo sung trong migration `202606040004_library_delete_requests.sql`.
- Requester doc yeu cau cua minh; Mod/Admin doc yeu cau.
- Luong nay chu yeu phuc vu teacher request va audit trail; Moderator van co the an hoac xoa truc tiep tai nguyen dung chung trong luong van hanh hien hanh.
- Neu di qua request thi Mod/Admin duyet `archive`; chi Admin duyet `delete`.
- Khi duyet approved `archive`, service doi tai nguyen dich sang `archived`; khi duyet approved `delete`, service xoa metadata tai nguyen theo quyen Admin.

## 13.0. Ham RPC quan tri truy cap sinh vien

Ham `public.approve_student_access(target_student_id, target_expires_at)` va `public.renew_student_access(target_student_id, target_expires_at)`:

- Da duoc tao qua migration `202605280015_phase33_access_control_rpc.sql`.
- Chay voi `security definer` de tranh phu thuoc service-role key trong luong app runtime.
- Chi cho phep actor role `admin`, `moderator`, `teacher` thuc thi.

---

## 13.1. Bảng `student_profile_stats`

Thong ke tong hop de hien thi profile sinh vien gon nhe.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `student_id` | uuid | Có | PK/FK `profiles.id` |
| `total_assessments` | int | Có | Tong bai kiem tra da giao |
| `completed_assessments` | int | Có | So bai da lam |
| `average_score` | numeric | Không | Diem trung binh toan bo |
| `weekly_active_count` | int | Không | Tan suat truy cap theo tuan |
| `monthly_active_count` | int | Không | Tan suat truy cap theo thang |
| `total_access_minutes` | int | Không | Tong thoi luong truy cap |
| `updated_at` | timestamptz | Có | Lan cap nhat gan nhat |

Ghi chu:

- Bang nay la tong hop, khong thay the du lieu goc trong `submissions`.
- Badge se tach bang rieng (`student_badges`) o phase sau.

Trang thai trien khai:

- Da duoc tao qua migration `202605280012_phase33_class_ops_profile_stats.sql`.

## 13.2. Bảng `student_course_stats`

Thong ke tong hop theo tung hoc phan cho profile sinh vien.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `student_id` | uuid | Có | PK/FK `profiles.id` |
| `course_id` | uuid | Có | PK/FK `courses.id` |
| `completed_assessments` | int | Có | So bai da lam theo hoc phan |
| `average_score` | numeric | Không | Diem trung binh theo hoc phan |
| `updated_at` | timestamptz | Có | Lan cap nhat gan nhat |

Trang thai trien khai:

- Da duoc tao qua migration `202605280017_phase33_student_course_stats.sql`.

---

## 14. Bảng `import_jobs`

Theo dõi các lần import kết quả.

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `id` | uuid | Có | PK |
| `assessment_id` | uuid | Có | FK `assessments.id` |
| `created_by` | uuid | Có | FK `profiles.id` |
| `source` | text | Có | `csv`, `google_webhook`, `microsoft_webhook`, `manual` |
| `status` | text | Có | `pending`, `completed`, `partial`, `failed` |
| `total_rows` | int | Có | Tổng dòng hợp lệ để xử lý |
| `success_rows` | int | Có | Dòng thành công |
| `error_rows` | int | Có | Dòng lỗi |
| `error_report` | jsonb | Không | Báo cáo lỗi |
| `started_at` | timestamptz | Có | Thời điểm bắt đầu |
| `created_at` | timestamptz | Có | Default now |
| `updated_at` | timestamptz | Có | Auto update |
| `completed_at` | timestamptz | Không | Khi hoàn thành |

Trang thai trien khai:

- Da duoc tao qua migration `202605280018_phase42_submissions_import_jobs.sql`.
- Da bat RLS cho manager manage import jobs theo `can_manage_assessment`.

---

## 15. RLS policy khái niệm

### 15.1. Profiles

- User xem được profile của chính mình.
- Admin xem tất cả.
- Moderator xem profile sinh viên trong pham vi scope duoc cap.
- Teacher xem profile sinh viên thuộc lớp/học phần mình phụ trách.
- Sinh viên `access_status <> active` hoac qua han khong duoc truy cap tai nguyen hoc tap.

### 15.2. Courses

- Moderator xem/sửa course do mình quản lý trực tiếp.
- Teacher chỉ đọc course gắn với lớp mình phụ trách hoặc được cấp scope phù hợp; teacher không sửa metadata học phần.
- Student xem course nếu có membership active trong lớp thuộc course đó.
- Admin xem tất cả.

### 15.3. Classes

- Teacher xem/sửa class do mình phụ trách.
- Moderator xem/sửa class trong scope duoc cap.
- Student xem class nếu có membership active.
- Admin xem tất cả.

### 15.4. Materials

- Teacher quản lý material của course mình sở hữu.
- Moderator quan ly material theo scope.
- Student xem material published nếu thuộc lớp active của course.

### 15.5. Assessments/Submissions

- Teacher xem assessment/submission của lớp mình phụ trách.
- Moderator xem assessment/submission trong scope duoc cap.
- Student xem assessment open của lớp mình và submission của chính mình nếu được phép.
- Admin xem tất cả.

### 15.6. Enrollment requests

- Student tao yeu cau tham gia cho hoc phan/lop dang mo.
- Chi teacher phu trach lop muc tieu duyet yeu cau tham gia lop.
- Moderator/Admin khong duyet yeu cau tham gia lop.

---

## 16. Migration skeleton tham khảo

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'moderator', 'teacher', 'student')),
  student_code text unique,
  role_code text unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  access_status text not null default 'pending_approval' check (access_status in ('pending_approval', 'active', 'suspended', 'expired')),
  access_expires_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
```

Các bảng còn lại cần được tạo bằng migration riêng theo phase roadmap để dễ review.

---

## 17. Index khuyến nghị

```sql
create index idx_courses_owner_id on public.courses(owner_id);
create index idx_classes_course_id on public.classes(course_id);
create index idx_classes_teacher_id on public.classes(teacher_id);
create index idx_class_members_class_id on public.class_members(class_id);
create index idx_class_members_student_id on public.class_members(student_id);
create index idx_materials_course_id on public.materials(course_id);
create index idx_assessments_class_id on public.assessments(class_id);
create index idx_submissions_assessment_id on public.submissions(assessment_id);
create index idx_submissions_student_id on public.submissions(student_id);
```

---

## 18. Seed data tối thiểu

- 1 admin.
- 1 teacher demo.
- 3 student demo.
- 1 course demo.
- 1 class demo.
- 2 materials demo.
- 1 assessment demo dùng link form giả.

---

## 19. Quy tắc thay đổi schema

Trước khi thay đổi schema, AI Agent phải trả lời:

| Câu hỏi | Yêu cầu |
|---|---|
| Thay đổi giải quyết business rule nào? | Phải nêu rõ |
| Có phá service contract không? | Nếu có, cập nhật `SERVICE_CONTRACT.md` |
| Có cần migration rollback không? | Có nếu thay đổi không tương thích |
| Có ảnh hưởng RLS không? | Phải kiểm tra |
| Có cần index mới không? | Nêu lý do theo query pattern |
| Có cần cập nhật seed/test không? | Có nếu test phụ thuộc schema |

---

## 20. Trạng thái hiện tại của schema

- Schema đã bao phủ đầy đủ user management, course, class, material, simulation, classroom room, library, assessment external/internal, submission import/export và dashboard mirror.
- Phần assessment hiện đã có mode `external` và `internal`, cùng runtime tables cho attempt/answer/score để hỗ trợ làm bài và chấm điểm nội bộ.
- Các thay đổi gần đây tập trung vào dữ liệu kết quả theo `student_identifier`/`student code`, mirror `course_assessment_results`, và các bảng phục vụ hardening vận hành như `class_resource_links`, `library_change_requests`, `student_profile_stats`.
