# REQUIREMENTS.md

# Learning Management Platform (LMP) REQUIREMENTS BRIEF

## 1. Tên sản phẩm

Learning Management Platform (LMP)
Learning Management Platform (LMP) - Nền tảng hỗ trợ học tập và quản lý lớp học cá nhân hóa cho giảng viên

---

## 2. Mục tiêu ngắn gọn

LMP là website hỗ trợ giảng viên tổ chức học phần, tài liệu, mô phỏng học tập đơn giản, lớp học và kết quả bài kiểm tra. Phiên bản đầu không cố thay thế LMS lớn như Moodle, mà đóng vai trò cổng học tập riêng, nhẹ, dễ kiểm soát, có thể mở rộng dần. Bài kiểm tra sử dụng Google Form hoặc Microsoft Form, đồng thời có contract cho internal runtime để giảm độ phức tạp; website tập trung vào quản lý cấu trúc học tập, phân quyền, lưu kết quả và tổng hợp dữ liệu.

---

## 3. Bối cảnh vấn đề

Người dùng hiện gặp các vấn đề sau:

1. Tài liệu học tập, link bài kiểm tra, danh sách lớp và kết quả đang phân tán ở nhiều nơi.
2. Google Form/Microsoft Form tiện để kiểm tra nhưng chưa đủ tốt để tổ chức theo học phần, lớp học và dashboard riêng.
3. Các LMS lớn có thể nặng, khó tùy biến hoặc không phù hợp với nhu cầu cá nhân hóa của một giảng viên.
4. Việc tổng hợp điểm, trạng thái làm bài và xuất dữ liệu còn thủ công.
5. Nếu phát triển website không có tài liệu nền tảng, AI Agent dễ code chắp vá, sai kiến trúc và khó mở rộng.

Ứng dụng cần giải quyết bằng cách:

1. Tạo một cổng học tập trung tâm cho học phần, tài liệu, lớp học và bài kiểm tra.
2. Tận dụng Google Form/Microsoft Form cho phần làm bài, nhưng lưu metadata và kết quả trong database riêng.
3. Thiết kế kiến trúc rõ ràng, phân quyền chặt, có service contract và schema ổn định để mở rộng lâu dài.

---

## 4. Người dùng mục tiêu

| Nhóm người dùng | Nhu cầu | Mức ưu tiên |
|---|---|---|
| Giảng viên | Quản lý học phần, lớp, tài liệu, bài kiểm tra, dashboard kết quả | Cao |
| Sinh viên | Truy cập đúng lớp/học phần, đọc/tải tài liệu, làm bài kiểm tra | Cao |
| Admin | Quản lý người dùng, phân quyền, cấu hình hệ thống, quota thư viện cá nhân | Trung bình |
| Moderator | Quản lý học phần theo scope, duyệt yêu cầu và theo dõi hệ thống theo phạm vi | Trung bình |

---

## 5. Chức năng bắt buộc phiên bản đầu

### 5.1. Module 1: User management, đăng nhập và phân quyền

- Đăng nhập/đăng xuất bằng Supabase Auth.
- Phân quyền theo vai trò: `admin`, `moderator`, `teacher`, `student`.
- Gắn profile người dùng với mã sinh viên/mã giảng viên.
- Chặn truy cập theo route và theo database Row Level Security.
- Không cho sinh viên xem tài liệu, bài kiểm tra hoặc kết quả của lớp không tham gia.
- Chỉ sinh viên được tự đăng ký; tài khoản giảng viên và moderator do Admin tạo trong User management.

### 5.2. Module 2: Quản lý học phần và tài liệu

- Moderator gửi yêu cầu tạo học phần; Admin duyệt và cấp scope quản lý phù hợp.
- Giảng viên chỉ thao tác trên học phần thuộc phạm vi được giao hoặc sở hữu hợp lệ.
- Giảng viên tải lên tài liệu: PDF, slide, file Excel, file bài đọc.
- Sinh viên đọc PDF trực tiếp trên trình duyệt nếu có quyền.
- Sinh viên tải file nếu giảng viên bật quyền tải xuống.
- Tài liệu được sắp xếp theo chương, tuần học hoặc chủ đề.
- Lưu metadata tài liệu trong database, file thật trong Supabase Storage.

### 5.3. Module 3: Quản lý lớp học

- Giảng viên gửi yêu cầu mở lớp theo học kỳ/năm học; Mod/Admin duyệt trước khi lớp hoạt động chính thức.
- Gắn lớp với một học phần.
- Thêm sinh viên bằng nhập thủ công hoặc import CSV.
- Xem danh sách sinh viên, trạng thái tham gia, trạng thái làm bài.
- Cho phép archived lớp sau khi kết thúc học kỳ.
- Sinh viên gửi yêu cầu tham gia lớp và chỉ giảng viên phụ trách lớp mới được duyệt.

### 5.4. Module 4: Bài kiểm tra và kết quả

- Giảng viên tạo bài kiểm tra, gắn Google Form hoặc Microsoft Form.
- Mỗi học phần có ngân hàng đề thi riêng để giảng viên tạo và tái sử dụng câu hỏi.
- Giảng viên có thể lấy câu hỏi từ ngân hàng đề của học phần và gắn vào bài kiểm tra của lớp.
- Lưu tên bài, mô tả, loại form, link form, hạn làm bài, trạng thái mở/đóng.
- Sinh viên mở bài kiểm tra từ trang lớp học.
- Ghi nhận kết quả bằng một trong ba cách: nhập tay, import CSV, webhook/API.
- Dashboard hiển thị điểm, thời gian nộp, trạng thái hoàn thành.
- Xuất kết quả sang CSV/XLSX.
- Kết quả của các lớp được tổng hợp thêm vào kho kết quả cấp học phần.

### 5.5. Module 5: Mô phỏng đơn giản

- Cho phép gắn mô phỏng vào học phần theo dạng widget JavaScript/React.
- Mỗi mô phỏng có `slug`, tên, mô tả, tham số đầu vào và component hiển thị.
- Mô phỏng v1 chỉ chạy client-side, không lưu dữ liệu phức tạp.
- Ví dụ: bình quân di động, san bằng mũ, hồi quy tuyến tính, phân phối chuẩn, hàng chờ đơn giản.

### 5.6. Module 6: Thông báo chung, thư viện cá nhân và User management

- Có khối thông báo chung ở dashboard cho Admin, Moderator và Giảng viên.
- Admin và Moderator được gửi thông báo; Giảng viên chỉ được đọc.
- Mỗi giảng viên có thư viện cá nhân riêng, quota mặc định 50 MB.
- Admin có thể điều chỉnh quota thư viện cá nhân theo từng giảng viên.
- Admin có UI quản trị tài khoản để tạo Moderator, tạo Giảng viên, đổi role/status.

---

## 6. Chức năng không bắt buộc ở phiên bản đầu

- Tự xây ngân hàng câu hỏi và engine chấm điểm đầy đủ.
- Random đề, chống gian lận, giám sát thi trực tuyến.
- AI tutor/chatbot học tập.
- Forum thảo luận nhiều cấp.
- SCORM/xAPI/LTI đầy đủ.
- Mobile app native.
- Hệ thống thanh toán.
- SSO cấp trường.

---

## 7. Yêu cầu dữ liệu

Các thực thể dữ liệu chính:

| Thực thể | Mô tả | Ghi chú |
|---|---|---|
| `profiles` | Thông tin người dùng mở rộng từ Supabase Auth | Không lưu mật khẩu |
| `courses` | Học phần | Do giảng viên/admin tạo |
| `classes` | Lớp học phần | Gắn với học kỳ, năm học, học phần |
| `class_members` | Sinh viên thuộc lớp | Dùng làm nền tảng phân quyền |
| `materials` | Metadata tài liệu học tập | File lưu trong Storage |
| `assessments` | Bài kiểm tra gắn với lớp/học phần | Link Google/MS Form |
| `question_bank_items` | Ngân hàng câu hỏi theo học phần | Nguồn để gắn vào assessment |
| `submissions` | Kết quả bài kiểm tra | Nhập tay/import/webhook |
| `course_assessment_results` | Kho kết quả tổng hợp theo học phần | Mirror từ submissions |
| `simulations` | Registry mô phỏng | Gắn với học phần |
| `global_notifications` | Thông báo chung dashboard | Admin/Moderator gửi |
| `personal_library_settings` | Quota thư viện cá nhân của giảng viên | Admin điều chỉnh |
| `activity_logs` | Nhật ký hoạt động quan trọng | Phục vụ audit và dashboard |

---

## 8. Yêu cầu bảo mật và quyền riêng tư

- Supabase service role key chỉ được dùng ở server-side.
- Tất cả bảng dữ liệu có dữ liệu người dùng phải bật Row Level Security.
- File tài liệu mặc định lưu trong private bucket; sinh viên nhận signed URL khi có quyền.
- Kết quả bài kiểm tra chỉ giảng viên phụ trách, admin và chính sinh viên đó được xem theo policy.
- API webhook nhận kết quả từ Google/MS Form phải có shared secret hoặc token xác thực.
- Không ghi log thông tin nhạy cảm như access token, service key, dữ liệu phản hồi đầy đủ nếu không cần thiết.

---

## 9. Yêu cầu phi chức năng

| Nhóm yêu cầu | Mô tả |
|---|---|
| Hiệu năng | Trang danh sách tài liệu/lớp/bảng điểm tải nhanh với pagination |
| Dễ dùng | Giao diện tiếng Việt, ít bước, phù hợp giảng viên không chuyên kỹ thuật |
| Mở rộng | Có thể thêm module mới mà không phá module cũ |
| Dễ bảo trì | Code chia service/repository rõ, tên nhất quán, test tối thiểu |
| Sao lưu | Có kế hoạch export dữ liệu điểm và danh sách lớp |
| Khả năng phục hồi | Import kết quả có thể chạy lại mà không tạo bản ghi trùng |

---

## 10. Triết lý thiết kế áp dụng cho yêu cầu

Yêu cầu sản phẩm phải được hiểu theo hướng **giảm độ phức tạp tích lũy**. AI Agent không được triển khai nhanh bằng cách trộn UI, database query và business rule trong cùng một component. Mỗi module cần có interface hẹp, hành vi rõ, tên gọi nhất quán và có test cho luồng quan trọng. Khi có hai phương án, ưu tiên phương án khiến thay đổi sau này ít lan sang nhiều file hơn.

---

## 11. Tiêu chí hoàn thành MVP

MVP được xem là đạt khi:

- Giảng viên đăng nhập, gửi yêu cầu mở lớp, thêm sinh viên và quản lý lớp được duyệt.
- Giảng viên upload tài liệu và sinh viên trong lớp xem/tải được theo quyền.
- Giảng viên tạo bài kiểm tra bằng link Google Form/Microsoft Form.
- Sinh viên truy cập bài kiểm tra từ lớp của mình.
- Giảng viên import hoặc đồng bộ kết quả vào bảng điểm.
- Dashboard hiển thị kết quả và xuất được file CSV/XLSX.
- RLS chặn được truy cập trái phép cơ bản.
- Có test cho auth guard, quyền truy cập lớp, quyền truy cập tài liệu, import submission.
