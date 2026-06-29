# SPEC_FINAL.md

# Learning Management Platform (LMP) PRODUCT SPECIFICATION

## 1. Định nghĩa sản phẩm

LMP là website hỗ trợ học tập và quản lý lớp học dành cho giảng viên. Sản phẩm không phải LMS toàn diện trong phiên bản đầu; sản phẩm là một **learning management hub** nhẹ, có khả năng tổ chức học phần, tài liệu, lớp học, mô phỏng đơn giản và bài kiểm tra theo cả hai mode: liên kết Google Form/Microsoft Form hoặc luồng nội bộ chuẩn hóa theo snapshot câu hỏi và attempt.

---

## 2. Mục tiêu sản phẩm

### 2.1. Mục tiêu chính

- Tập trung tài liệu, lớp học, bài kiểm tra và kết quả vào một website thống nhất.
- Giúp giảng viên quản lý nhiều lớp/học phần mà không cần dùng LMS nặng.
- Giảm độ phức tạp bằng cách tận dụng Google/MS Form cho bài kiểm tra external, đồng thời chuẩn hóa contract cho luồng internal assessment khi cần.
- Tạo nền tảng kỹ thuật rõ để AI Agent có thể phát triển tiếp mà không phá kiến trúc.

### 2.2. Chỉ số thành công MVP

| Chỉ số | Mức đạt yêu cầu |
|---|---|
| Tạo học phần/lớp | Mod tạo học phần trực tiếp, giảng viên gửi yêu cầu mở lớp được mà không cần can thiệp database |
| Upload tài liệu | PDF/slide/file học liệu upload được và sinh viên xem được theo quyền |
| Bài kiểm tra | Lớp có thể gắn bài kiểm tra external hoặc internal và sinh viên truy cập được theo quyền |
| Kết quả | Import hoặc sync kết quả vào dashboard |
| Bảo mật | Sinh viên không xem được lớp/tài liệu/điểm ngoài quyền |
| Xuất dữ liệu | Xuất bảng điểm theo lớp/bài kiểm tra |

---

## 3. Vai trò người dùng

| Vai trò | Quyền chính |
|---|---|
| `admin` | Quản lý toàn hệ thống, User management, dữ liệu, cấu hình, báo cáo tổng hợp |
| `moderator` | Quản lý học phần trực tiếp, vận hành Thư viện dùng chung theo học phần, gửi thông báo chung và theo dõi kết quả đánh giá học phần |
| `teacher` | Gửi yêu cầu mở lớp, quản lý lớp mình phụ trách, tạo tài liệu, ngân hàng đề, bài kiểm tra, xem kết quả lớp phụ trách |
| `student` | Xem lớp đã tham gia, đọc/tải tài liệu được phép, làm bài test, xem kết quả cá nhân nếu được bật |

---

## 4. Mô hình nghiệp vụ cốt lõi

```text
Course/Học phần
  ├── Question Bank/Ngân hàng đề thi
  ├── Course Assessment Publication/Kết quả đánh giá học phần
  ├── Materials/Tài liệu
  ├── Simulations/Mô phỏng
  └── Classes/Lớp học phần
        ├── Class Members/Sinh viên trong lớp
        ├── Assessments/Bài kiểm tra
        └── Submissions/Kết quả bài kiểm tra
```

---

## 5. Cấu trúc giao diện

### 5.1. Ngôn ngữ giao diện

Giao diện người dùng sử dụng tiếng Việt. Tên biến/code dùng tiếng Anh để nhất quán với hệ sinh thái phát triển.

Các thuật ngữ chuẩn trong UI và docs được khóa tại `GLOSSARY.md` để tránh lệch tên giữa các màn hình và service.

### 5.2. Layout tổng quát

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: Logo | Search | Notifications | User menu          │
├───────────────┬──────────────────────────────────────────────┤
│ Sidebar       │ Main content                                 │
│               │                                              │
│ Dashboard     │ Page title                                   │
│ Học phần      │ Filters / Actions                            │
│ Lớp học       │ Data table / Cards / Detail panel            │
│ Bài kiểm tra  │                                              │
│ Bảng điểm     │                                              │
│ Mô phỏng      │                                              │
│ Cài đặt       │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

### 5.3. Điều hướng chính theo giảng viên

- Tổng quan
- Học phần
- Lớp học
- Tài liệu
- Bài kiểm tra
- Bảng điểm
- Mô phỏng
- Cài đặt

### 5.4. Điều hướng chính theo sinh viên

- Lớp của tôi
- Học phần
- Tài liệu
- Bài kiểm tra
- Kết quả của tôi

---

## 6. Chi tiết module chức năng

## 6.1. Module User management và phân quyền

### Mục tiêu

Đảm bảo mỗi người dùng chỉ truy cập đúng dữ liệu thuộc vai trò và lớp/học phần của mình.

### Trường dữ liệu chính

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `id` | Có | UUID trùng với `auth.users.id` |
| `full_name` | Có | Họ tên hiển thị |
| `role` | Có | `admin`, `moderator`, `teacher`, `student` |
| `student_code` | Không | Bắt buộc nếu là sinh viên |
| `role_code` | Không | Bắt buộc với tài khoản nhân sự (`admin`, `moderator`, `teacher`); sinh viên không dùng |
| `status` | Có | `active`, `inactive`, `archived` |

### Chức năng

- Đăng nhập/đăng xuất.
- Guard route theo vai trò.
- Admin tạo tài khoản `student`, `moderator` và `teacher`, cập nhật role/status và quota thư viện cá nhân.
- Sinh viên không còn tự đăng ký ở trang đăng nhập; tài khoản sinh viên đi qua luồng riêng trong `User management`.
- Kiểm tra membership lớp trước khi truy cập dữ liệu.

### Quy tắc nghiệp vụ

- Người dùng không có profile hợp lệ không được vào dashboard.
- Sinh viên chỉ xem dữ liệu qua `class_members`.
- Giảng viên chỉ quản lý lớp/học phần mình sở hữu hoặc được phân quyền.
- Chỉ giảng viên phụ trách lớp được duyệt yêu cầu tham gia lớp.
- Admin không tạo lớp trực tiếp trong workflow chuẩn; giảng viên gửi yêu cầu mở lớp, Mod/Admin duyệt.
- Tài khoản nhân sự (`admin`, `moderator`, `teacher`) có `role_code`; ví dụ `ADMIN`, `MOD123`, `LEC123`.
- Toàn bộ tài khoản vận hành và học tập đều do Admin khởi tạo trong User management; trang đăng nhập chỉ còn luồng đăng nhập và xem trước lớp mở đăng ký.

---

## 6.2. Module học phần

### Mục tiêu

Cho phép moderator tạo và vận hành không gian học tập theo từng học phần để giảng viên sử dụng trong các luồng lớp, tài liệu và bài kiểm tra.

### Trường dữ liệu chính

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `code` | Có | Mã học phần, unique theo giảng viên hoặc hệ thống |
| `title` | Có | Tên học phần |
| `description` | Không | Mô tả nội dung học phần |
| `owner_id` | Có | Moderator phụ trách học phần |
| `visibility` | Có | `private`, `unlisted`, `public_preview` |
| `status` | Có | `draft`, `active`, `archived` |

### Chức năng

- Tạo/sửa/archive học phần.
- Xem danh sách học phần theo quyền.
- Gắn tài liệu, mô phỏng, lớp học vào học phần.
- Tìm kiếm/lọc học phần.

### Quy tắc nghiệp vụ

- Không hard-delete học phần đã có lớp hoặc kết quả.
- Mỗi học phần có thể có nhiều lớp.
- Sinh viên không truy cập học phần nếu không thuộc lớp của học phần đó, trừ khi học phần bật preview công khai.
- Mỗi học phần có một ngân hàng đề riêng và một bảng `Kết quả đánh giá học phần` dành cho Mod.
- Moderator tạo, sửa, lưu trữ và xóa học phần trực tiếp; Admin không tham gia luồng nghiệp vụ học phần.

---

## 6.3. Module tài liệu

### Mục tiêu

Quản lý tài liệu học tập theo học phần/lớp, hỗ trợ đọc trực tiếp và tải xuống có kiểm soát.

### Chức năng

- Upload file vào Supabase Storage.
- Lưu metadata trong bảng `materials`.
- Tạo signed URL khi người dùng có quyền.
- Bật/tắt quyền tải xuống.
- Sắp xếp tài liệu theo tuần/chương/chủ đề.

### Quy tắc nghiệp vụ

- File mặc định private.
- Không hiển thị storage path thật cho client nếu không cần.
- Giới hạn định dạng file trong v1: PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, ZIP tùy cấu hình.
- Khi archive tài liệu, không xóa file vật lý ngay.

---

## 6.4. Module lớp học

### Mục tiêu

Quản lý lớp học phần, danh sách sinh viên và liên kết giữa sinh viên với học phần.

### Chức năng

- Tạo/sửa/archive lớp.
- Gắn lớp với học phần.
- Bật/tắt trạng thái `mở đăng ký` để quyết định lớp có xuất hiện công khai ở trang đăng nhập hay không.
- Nhận yêu cầu tham gia lớp do sinh viên gửi.
- Bật/tắt `duyệt tự động` để chấp nhận ngay yêu cầu tham gia lớp mới.
- Xem trạng thái tham gia và trạng thái hoàn thành bài kiểm tra.

### Quy tắc nghiệp vụ

- Một sinh viên không được có hai membership active trùng cùng lớp.
- Lớp archived không cho sinh viên mới tham gia nếu không được mở lại.
- Giảng viên chỉ xem lớp mình sở hữu hoặc được cấp quyền.
- Yêu cầu tham gia lớp của sinh viên chỉ do giảng viên phụ trách lớp đó duyệt.

---

## 6.5. Module bài kiểm tra

### Mục tiêu

Tạo điểm truy cập bài kiểm tra nhẹ bằng cách liên kết Google Form hoặc Microsoft Form, đồng thời chuẩn hóa sẵn contract cho luồng internal assessment theo snapshot câu hỏi.

### Chức năng

- Tạo bài kiểm tra với tên, mô tả, form provider, form URL.
- Tạo và quản lý ngân hàng đề thi theo từng học phần.
- Chọn câu hỏi từ ngân hàng đề học phần để gắn vào bài kiểm tra của lớp học.
- Nhúng form bằng iframe nếu được provider cho phép.
- Mở link mới nếu form không cho nhúng.
- Lưu deadline, thời lượng làm bài, trạng thái mở/đóng và mode `external/internal`.
- Cho phép đồng bộ/import kết quả vào `submissions`.
- Giảng viên chủ động `NỘP KẾT QUẢ` để đồng bộ kết quả lớp lên bảng `Kết quả đánh giá học phần` của Mod.
- Chuẩn hóa số lượt làm, attempt, autosave, submit, grading và feedback cho nội bộ.

### Quy tắc nghiệp vụ

- V1 không tự xây quiz engine.
- Form URL phải được validate domain cơ bản.
- Bài kiểm tra đóng thì sinh viên không thấy nút làm bài, trừ khi giảng viên bật override.
- Bài kiểm tra internal phải tính thời gian theo từng sinh viên dựa trên lần bấm bắt đầu làm bài, không được reset chỉ bằng refresh hoặc đăng nhập lại.
- Một submission được định danh bằng `assessment_id + student_identifier + attempt_number` hoặc `external_response_id`.
- Câu hỏi gắn vào assessment được lưu theo snapshot để tránh lệch khi ngân hàng đề thay đổi về sau.
- Thành phần đánh giá của học phần dùng enum cố định `diagnostic`, `frequent`, `periodic`, `final`; giảng viên không nhập text tự do khi tạo bài kiểm tra.
- Mỗi thành phần đánh giá có thể gắn nhiều CLO của học phần; assessment snapshot lại danh sách CLO đó tại thời điểm tạo bài kiểm tra để kết quả không bị lệch nếu học phần đổi mapping sau này.
- Import/export kết quả bài kiểm tra phải chèn các cột điểm CLO ngay sau cột `Điểm`, chỉ cho những CLO thuộc thành phần đánh giá đã chọn của assessment.

---

## 6.6. Module kết quả và dashboard

### Mục tiêu

Giúp giảng viên xem nhanh tình trạng học tập ở cấp lớp/bài kiểm tra, đồng thời giúp Mod theo dõi bảng tổng hợp kết quả cấp học phần.

### Chức năng

- Xem bảng điểm theo lớp, bài kiểm tra, sinh viên.
- Mod xem bảng `Kết quả đánh giá học phần`, gom các kết quả đã được giảng viên `NỘP KẾT QUẢ` từ nhiều lớp học phần.
- Lọc theo trạng thái: đã làm, chưa làm, trễ hạn, cần kiểm tra.
- Import CSV từ Google Sheets/Excel.
- Nhận webhook đồng bộ kết quả ở giai đoạn sau.
- Xuất CSV/XLSX.
- Hiển thị biểu đồ phân bố điểm và tỷ lệ hoàn thành.

### Quy tắc nghiệp vụ

- Import phải idempotent: chạy lại không tạo bản ghi trùng.
- Điểm phải có `raw_score`, `max_score`, tùy chọn `normalized_score`.
- Dữ liệu lỗi khi import phải được báo rõ, không nuốt lỗi im lặng.

---

## 6.7. Module mô phỏng

### Mục tiêu

Cung cấp các mô phỏng học tập nhỏ, chạy trực tiếp trên website để tăng tính tương tác.

### Chức năng

- Registry mô phỏng theo `slug`.
- Gắn mô phỏng với học phần hoặc bài học.
- Component mô phỏng chạy client-side.
- Có mô tả, hướng dẫn sử dụng và tham số đầu vào.

### Quy tắc nghiệp vụ

- Mô phỏng không được phụ thuộc trực tiếp vào database nếu không cần.
- Mô phỏng phải tách khỏi module course/material.
- Tên mô phỏng và tham số phải rõ để người khác dễ mở rộng.

---

## 6.8. Module thông báo chung và thư viện cá nhân

### Chức năng

- Có khối `Thông báo` chung trên dashboard cho `admin`, `moderator`, `teacher`.
- `admin` và `moderator` được gửi thông báo chung; `teacher` chỉ được đọc.
- Mỗi giảng viên có một `Thư viện cá nhân` riêng cho tài liệu và mô phỏng HTML chưa đưa vào Thư viện dùng chung.
- Quota mặc định của `Thư viện cá nhân` là 50 MB và `admin` có thể điều chỉnh.

### Quy tắc nghiệp vụ

- Tài nguyên không gắn học phần được xem là tài nguyên thư viện cá nhân.
- Tài nguyên gắn học phần do giảng viên tải lên phải qua bước Mod duyệt trước khi vào Thư viện dùng chung.
- Xóa tài nguyên cá nhân chỉ áp dụng cho tài nguyên chưa đi vào Thư viện dùng chung.
- Mod vận hành Thư viện dùng chung: duyệt tài nguyên gắn học phần, ẩn hoặc xóa trực tiếp tài nguyên dùng chung khi cần và gắn mô phỏng HTML đã duyệt vào học phần.
- Admin giữ vai trò governance hệ thống: quản lý danh mục Thư viện và quyết định tích hợp mô phỏng native ở giai đoạn sau.
- Khi giảng viên mở trang `Tài nguyên lớp học`, danh sách chọn tài nguyên chỉ hiển thị `Tài liệu dùng chung` và tài nguyên gắn với đúng học phần của lớp hiện tại.

---

## 7. Workflow chính

### 7.1. Moderator quản lý học phần và giảng viên quản lý tài liệu

```text
Login → Dashboard → Học phần → Tạo học phần trực tiếp → Upload tài liệu → Cấu hình quyền xem/tải → Publish
```

### 7.2. Giảng viên gửi yêu cầu mở lớp và vận hành tham gia lớp

```text
Login → Lớp học → Gửi yêu cầu mở lớp → Mod/Admin duyệt → Chọn học phần → Bật mở đăng ký nếu cần → Sinh viên gửi yêu cầu tham gia lớp → Giảng viên duyệt hoặc bật duyệt tự động → Publish lớp
```

### 7.3. Sinh viên học và làm bài kiểm tra

```text
Login → Lớp của tôi → Chọn lớp → Xem tài liệu → Mở bài kiểm tra → Làm trên Google/MS Form hoặc trong website nếu là internal → Quay lại website xem trạng thái
```

### 7.4. Giảng viên tổng hợp điểm

```text
Bài kiểm tra → Import/Sync kết quả → NỘP KẾT QUẢ → Mod xem Kết quả đánh giá học phần → Dashboard/Export theo phạm vi phù hợp
```

---

## 8. Nguyên tắc thiết kế sản phẩm

- Giữ MVP nhỏ: không xây quiz engine native ở v1.
- Mọi tích hợp bên ngoài phải đi qua adapter, không rải logic Google/MS Form khắp codebase.
- Business logic nằm ở service layer; component chỉ render và gọi action.
- Mỗi bảng dữ liệu phải có mục đích rõ, tránh tạo bảng vì “có thể cần”.
- Tránh special cases bằng dữ liệu chuẩn hóa và constraint rõ.
- Nếu phải chọn giữa “nhanh nhưng chắp vá” và “chậm hơn nhưng rõ module”, chọn phương án rõ module.

---

## 9. Acceptance criteria tổng thể

- [ ] Tài khoản giảng viên đăng nhập và vào dashboard.
- [ ] Tài khoản sinh viên chỉ thấy lớp mình tham gia.
- [ ] Moderator tạo/sửa/lưu trữ/xóa học phần trực tiếp; giảng viên gửi yêu cầu mở lớp, tạo tài liệu, bài kiểm tra.
- [ ] Sinh viên đọc/tải tài liệu theo quyền.
- [ ] Sinh viên truy cập bài kiểm tra từ lớp.
- [ ] Kết quả có thể import hoặc sync vào dashboard.
- [ ] Xuất được bảng điểm.
- [ ] RLS và route guard hoạt động đúng.
- [ ] Có test tối thiểu cho các business rules quan trọng.

---

## 10. Trạng thái hiện tại của sản phẩm

- Website đã hoàn thiện phần lõi quản lý học phần, lớp học, tài liệu, mô phỏng, thư viện, dashboard và bài kiểm tra external.
- Luồng kết quả kiểm tra đã được chuẩn hóa cho import CSV/XLSX, export CSV/XLSX, dashboard và bảng `Kết quả đánh giá học phần` theo học phần.
- Các thay đổi gần đây tập trung vào hardening: performance, loading state, refresh sau mutation, và tính nhất quán của dữ liệu kết quả theo sinh viên.
- Ước tính tổng thể sản phẩm đang ở mức khoảng `85% - 90%` hoàn thiện tùy cách tính phần operations polish.
