# AI_AGENT_FIRST_PROMPT.md

Dùng prompt này trong Cursor/GitHub Copilot Agent sau khi đặt các file tài liệu vào root dự án.

```text
Bạn là AI Agent phụ trách khởi tạo dự án LMP (Learning Management Platform).

Bắt buộc đọc theo thứ tự:
1. START_HERE_FOR_AI_AGENT.md
2. README.md
3. ARCHITECTURE.md
4. ROADMAP.md
5. SPEC_FINAL.md
6. REQUIREMENTS.md
7. DATABASE_SCHEMA.md
8. SERVICE_CONTRACT.md

Nếu nhiệm vụ liên quan thiết kế lại lớp học trực quan, đọc thêm:

9. _Giao_dien_lop_hoc.md
10. SPRINT_5_1_CLASSROOM_VISUAL_BACKLOG.md

Nhiệm vụ đầu tiên:
- Không code ngay.
- Tóm tắt lại bản chất sản phẩm trong 10 dòng.
- Xác định task đang thuộc Phase 0.
- Liệt kê cấu trúc thư mục sẽ tạo.
- Liệt kê dependencies cần cài.
- Liệt kê file sẽ tạo/sửa.
- Liệt kê migration đầu tiên cần tạo.
- Nêu rủi ro bảo mật cần tránh.
- Ghi `Decision log` ngắn (2-3 dòng): phương án đã cân nhắc và lý do chọn.

Sau khi tôi xác nhận, mới bắt đầu khởi tạo Next.js + Supabase theo tài liệu.
```
