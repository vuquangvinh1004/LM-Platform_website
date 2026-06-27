# GLOSSARY

Use these terms consistently across docs, UI labels, service names, and comments.

## Canonical Terms

- `Học phần` - a course module managed by teacher/mod/admin.
- `Lớp học phần` - a class instance tied to one course and a roster.
- `Phòng học` - the classroom room view for board, announcements, messages, sessions, and templates.
- `Tài nguyên lớp` - class-scoped materials and simulations shared inside a room.
- `Bài kiểm tra` - an assessment, either external or internal.
- `Thời hạn làm bài` - the submission gate time for a student to start an assessment.
- `Thời gian làm bài còn lại` - the live countdown after a student starts an assessment.
- `Kết quả bài kiểm tra` - the results page for one assessment.
- `Kho kết quả theo học phần` - the aggregated course-level assessment result store.
- `Thư viện dùng chung` - the shared library reviewed by moderator/admin.
- `Thư viện cá nhân` - a teacher-owned private library.
- `Lớp mẫu` - a reusable classroom template snapshot.

## Naming Rules

- Prefer Vietnamese labels in the UI and docs.
- Keep English identifiers in code when they map to service contracts, schema fields, or APIs.
- Use `assessment` for code-level entities and `Bài kiểm tra` for the UI/documentation text.
- Use `class` for code-level entities and `Lớp học phần` for the business label when clarity matters.

