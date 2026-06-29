# GLOSSARY

Use these terms consistently across docs, UI labels, service names, and comments.

## Canonical Terms

- `Học phần` - a course module managed directly by moderator; teachers use it as the academic container for classes, materials, assessments, and results.
- `Lớp học phần` - a class instance tied to one course and a roster.
- `Phòng học` - the classroom room view for board, announcements, messages, sessions, and templates.
- `Tài nguyên lớp` - class-scoped materials and simulations shared inside a room.
- `Bài kiểm tra` - an assessment, either external or internal.
- `Thời hạn làm bài` - the submission gate time for a student to start an assessment.
- `Thời gian làm bài còn lại` - the live countdown after a student starts an assessment.
- `Kết quả bài kiểm tra` - the results page for one assessment.
- `Kết quả đánh giá học phần` - the moderator-facing course-level aggregate board that only shows rows after a teacher presses `NỘP KẾT QUẢ`.
- `Kho kết quả theo học phần` - the internal aggregate/publish store behind the course-level result board; not a separate teacher-facing module anymore.
- `Lớp mở đăng ký` - a class whose public enrollment flag is enabled so it can appear on the login-page registration list; an `active` class is not automatically public.
- `Thư viện dùng chung` - the shared library surface that contains either `Tài liệu dùng chung` or course-linked resources after approval/curation; when a teacher opens `Tài nguyên lớp học`, only shared resources plus resources of the class's own course are shown.
- `Thư viện cá nhân` - a teacher-owned private library for materials or HTML simulations that are not yet submitted into the shared library.
- `Tài liệu dùng chung` - tài nguyên Thư viện không gắn riêng một học phần nào (`course_id = null`); luôn được phép xuất hiện trong danh sách chọn tài nguyên của giảng viên ở mọi lớp.
- `Duyệt tự động yêu cầu vào lớp` - cờ ở trang Quản lý lớp cho phép giảng viên tự động chấp nhận các yêu cầu tham gia lớp mới thay vì duyệt thủ công từng yêu cầu.
- `Giảng viên` - the `teacher` role in code and service contracts; UI badge chuẩn là `GIẢNG VIÊN`.
- `Giám sát viên` - the `moderator` role in code and service contracts; có thể viết tắt là `Mod` trong note kỹ thuật ngắn, nhưng UI badge chuẩn là `GIÁM SÁT VIÊN`.
- `Quản trị viên` - the `admin` role in code and service contracts; UI badge chuẩn là `QUẢN TRỊ VIÊN`.
- `Role code` - mã nhân sự dùng cho tài khoản `admin`, `moderator`, `teacher`, ví dụ `ADMIN`, `MOD123`, `LEC123`; thay cho thuật ngữ cũ `teacher_code`.
- `Moderator (Mod)` - legacy English/code-facing alias of `Giám sát viên`; the operational role that creates/updates/archives/deletes courses directly, uploads or reviews shared-library resources tied to courses, links approved HTML simulations to courses, and monitors course-level results.
- `Admin` - legacy English/code-facing alias of `Quản trị viên`; the system governance role responsible for user management, scopes, personal-library quota, shared-library categories, system-wide configuration, and future aggregate reporting.
- `Governance` - cross-system control responsibilities such as account administration, category management, quota control, auditability, and high-level policy enforcement; this is distinct from moderator day-to-day course operations.
- `Lớp mẫu` - a reusable classroom template snapshot.

## Naming Rules

- Prefer Vietnamese labels in the UI and docs.
- Keep English identifiers in code when they map to service contracts, schema fields, or APIs.
- Use `assessment` for code-level entities and `Bài kiểm tra` for the UI/documentation text.
- Use `class` for code-level entities and `Lớp học phần` for the business label when clarity matters.
