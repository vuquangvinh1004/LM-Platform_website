# Learning Management Platform (LMP)

Learning Management Platform (LMP) - Nền tảng hỗ trợ học tập và quản lý lớp học cá nhân hóa cho giảng viên

LMP là một website dạng **nền tảng hỗ trợ học tập và quản lý lớp học nhẹ** dành cho giảng viên. Website tập trung vào hai nhóm chức năng cốt lõi: quản lý học phần/tài liệu/mô phỏng đơn giản và quản lý lớp học/bài kiểm tra theo hai mode song song: external qua Google Form/Microsoft Form và internal runtime chuẩn hóa để giảm tải hệ thống.

---

## 1. Mục tiêu

LMP được thiết kế để:

- Tạo một cổng học tập riêng cho giảng viên, không phụ thuộc hoàn toàn vào nền tảng LMS đóng.
- Cho phép giảng viên tổ chức học phần, tài liệu, mô phỏng và lớp học ở một nơi thống nhất.
- Cho phép sinh viên đọc tài liệu, tải tài liệu và truy cập bài kiểm tra theo từng lớp/học phần.
- Ghi nhận kết quả bài kiểm tra từ Google Form/Microsoft Form hoặc từ luồng internal để giảng viên tổng hợp, lọc và xuất dữ liệu.
- Giữ kiến trúc đủ nhẹ cho phiên bản đầu nhưng đủ rõ để mở rộng thành nền tảng quản lý học tập cá nhân hóa về sau.

---

## 2. Người dùng mục tiêu

| Nhóm người dùng | Nhu cầu chính |
|---|---|
| Giảng viên | Vận hành lớp học mình phụ trách, sử dụng học phần được phân công, quản lý tài liệu/bài kiểm tra và theo dõi kết quả học tập |
| Sinh viên | Truy cập học phần, đọc/tải tài liệu, làm bài kiểm tra, theo dõi trạng thái học tập |
| Giám sát viên học phần (`moderator`/`Mod`) | Toàn quyền tạo, chỉnh sửa, lưu trữ và xóa học phần; quản lý tài nguyên dùng chung; theo dõi kết quả theo học phần |
| Quản trị viên hệ thống (`admin`) | Quản lý người dùng, phân quyền, cấu hình hệ thống, kiểm soát dữ liệu, báo cáo tổng hợp |

---

## 3. Phạm vi phiên bản đầu

Phiên bản đầu của ứng dụng tập trung vào:

- Đăng nhập, quản lý người dùng và phân quyền cơ bản: toàn bộ tài khoản sinh viên, giảng viên và giám sát viên do Admin khởi tạo trong `User management`; trang đăng nhập không còn public self-signup.
- Quản lý học phần: moderator tạo/sửa/lưu trữ/xóa học phần trực tiếp, mô tả học phần, danh sách tài liệu.
- Quản lý tài liệu: tải lên PDF/slide/file vào thư viện cá nhân, gửi Mod duyệt vào thư viện dùng chung theo học phần, đọc trực tiếp và tải xuống bằng quyền truy cập hợp lệ.
- Quản lý lớp học: giảng viên gửi yêu cầu mở lớp, Mod/Admin duyệt, gắn lớp với học phần; sinh viên tự gửi yêu cầu tham gia lớp và giảng viên có thể bật `duyệt tự động`; chỉ các lớp được bật `mở đăng ký` mới xuất hiện công khai ở trang đăng nhập.
- Quản lý bài kiểm tra: gắn link Google Form hoặc Microsoft Form, hoặc chạy internal runtime theo snapshot câu hỏi; lưu thời hạn làm bài, thời lượng, trạng thái mở/đóng, dùng ngân hàng đề thi theo học phần và cho giảng viên `NỘP KẾT QUẢ` lên bảng tổng hợp cấp học phần của Mod.
- Ghi nhận kết quả: nhập thủ công, import CSV hoặc đồng bộ qua webhook ở mức tối thiểu.
- Dashboard vai trò vận hành: xem số sinh viên, số bài đã làm, điểm, trạng thái hoàn thành, thông báo chung và xuất Excel.

---

## 4. Ngoài phạm vi phiên bản đầu

Các chức năng sau chưa bắt buộc ở phiên bản đầu:

- Tự xây hệ thống quiz/test native toàn diện thay thế Google Form hoặc Microsoft Form trong v1.
- Chấm tự luận tự động bằng AI.
- Diễn đàn thảo luận đầy đủ như Moodle.
- Hệ thống livestream/lớp học trực tuyến.
- Mobile app native.
- Thanh toán học phí hoặc thương mại hóa khóa học.
- SCORM/xAPI đầy đủ.
- Tích hợp SSO quy mô trường đại học.

---

## 5. Bộ tài liệu bắt buộc

AI Agent và người phát triển phải đọc theo thứ tự sau trước khi code:

1. `START_HERE_FOR_AI_AGENT.md`
2. `README.md` (file tham chiếu tổng quan)
3. `ARCHITECTURE.md`
4. `ROADMAP.md`
5. `SPEC_FINAL.md`
6. `REQUIREMENTS.md`
7. `DATABASE_SCHEMA.md`
8. `SERVICE_CONTRACT.md`

---

## 6. Cấu trúc tài liệu

| File | Vai trò |
|---|---|
| `README.md` | Giới thiệu dự án, cách chạy, cách test |
| `START_HERE_FOR_AI_AGENT.md` | File bắt buộc đọc trước mỗi phiên code |
| `REQUIREMENTS.md` | Bản tóm tắt yêu cầu ngắn gọn |
| `SPEC_FINAL.md` | Đặc tả tổng hợp sản phẩm |
| `ARCHITECTURE.md` | Nguồn chân lý kiến trúc, tech stack, boundaries, business rules |
| `ROADMAP.md` | Lộ trình phát triển theo phase/sprint |
| `DATABASE_SCHEMA.md` | Thiết kế cơ sở dữ liệu chính thức |
| `SERVICE_CONTRACT.md` | Chuẩn service/API contract |
| `OPERATIONS_BACKUP_EXPORT_CHECKLIST.md` | Checklist backup/export vận hành Phase 6 |
| `PRODUCTION_READINESS_CHECKLIST.md` | Checklist production readiness: deploy, rollback, smoke test matrix |
| `TEACHER_USER_GUIDE.md` | Hướng dẫn sử dụng cho giảng viên (course/class/import/export) |
| `PHASE6_PRODUCTION_READINESS_EVIDENCE_20260603.md` | Evidence thực thi dry-run deploy, rollback drill và smoke matrix |
| `PHASE6_PRODUCTION_DEPLOY_ATTEMPT_20260604.md` | Evidence lần tiếp tục production deploy thật: pre-deploy gate pass, cloud deploy bị chặn bởi tooling/credential |
| `PHASE6_LOCAL_VALIDATION_EVIDENCE_20260604.md` | Evidence local validation sau khi Supabase/app local chạy: integration pass, admin local user-management/auth-profile pass, E2E browser bị chặn bởi môi trường |

---

## 6A. Thuật ngữ dùng thống nhất

Các file trong bộ tài liệu nội bộ ưu tiên dùng một bộ thuật ngữ cố định:

- `User management`: module quản trị tài khoản, vai trò, vòng đời truy cập và cấp quyền vận hành.
- `Duyệt truy cập`: thao tác duyệt hoặc gia hạn quyền học tập/truy cập của sinh viên.
- `Yêu cầu tạo học phần`: luồng cũ đã bỏ; Mod tạo học phần trực tiếp.
- `Yêu cầu mở lớp`: yêu cầu do giảng viên gửi để Mod/Admin duyệt và sinh lớp chính thức.
- `Lớp mở đăng ký`: lớp học phần được giảng viên bật cờ công khai để hiển thị ở khung đăng ký trên trang đăng nhập; không đồng nghĩa với mọi lớp `active`.
- `Yêu cầu tham gia lớp`: yêu cầu do sinh viên gửi để giảng viên phụ trách lớp duyệt.
- `Duyệt tự động yêu cầu vào lớp`: cờ ở trang Quản lý lớp cho phép giảng viên tự động chấp nhận mọi yêu cầu tham gia lớp mới của sinh viên.
- `Kết quả đánh giá học phần`: bảng tổng hợp theo học phần dành cho Mod, nhận dữ liệu khi giảng viên bấm `NỘP KẾT QUẢ` từ trang kết quả bài kiểm tra.
- `Tài liệu dùng chung`: tài nguyên Thư viện không gắn riêng một học phần nào; khi giảng viên chọn tài nguyên cho lớp, nhóm này luôn được hiển thị cùng với tài nguyên của đúng học phần lớp đó.

Khi cần nhắc đến nền tảng kỹ thuật, dùng `Supabase Auth` theo nghĩa hạ tầng đăng nhập; khi nhắc đến nghiệp vụ quản trị tài khoản, dùng `User management`.

---

## 6B. Quy trình đồng bộ policy và thuật ngữ cho toàn bộ docs

Mỗi khi phát triển tính năng mới hoặc điều chỉnh tính năng cũ có liên quan đến quyền, workflow nghiệp vụ, route truy cập, trạng thái dữ liệu, thuật ngữ UI hoặc service contract, phải chạy đủ quy trình đồng bộ tài liệu sau:

1. `Docs sweep`
   Mục tiêu: cập nhật các file nguồn chân lý chính để phản ánh đúng thay đổi nghiệp vụ hoặc kỹ thuật.
   File ưu tiên rà soát: `ARCHITECTURE.md`, `SPEC_FINAL.md`, `DATABASE_SCHEMA.md`, `SERVICE_CONTRACT.md`, `ROADMAP.md`, `README.md`.
2. `Policy sweep`
   Mục tiêu: tách rõ quyền theo vai trò, đặc biệt giữa `admin`, `moderator`, `teacher`, `student`, và loại bỏ các câu mô tả quyền cũ còn sót.
   Trọng tâm: actor nào tạo, actor nào duyệt, actor nào vận hành trực tiếp, actor nào chỉ giữ governance hệ thống.
3. `Consistency sweep` riêng cho `REQUIREMENTS.md`
   Mục tiêu: đồng bộ role matrix, module scope, thực thể dữ liệu và tiêu chí MVP để file yêu cầu ngắn gọn này không mâu thuẫn với các file chi tiết hơn.
4. `Final glossary sweep` cho `GLOSSARY.md`
   Mục tiêu: khóa lại thuật ngữ chuẩn dùng xuyên suốt UI, docs, service names, comments và test notes.

Checklist thực thi:

- Xác định thay đổi có chạm tới `role`, `permission`, `approval flow`, `shared/personal library`, `assessment`, `CLO`, `import/export`, `storage visibility`, `route access` hay không.
- Nếu có, cập nhật file chi tiết trước rồi mới cập nhật file tóm tắt.
- Sau mỗi sweep, chạy tìm kiếm theo từ khóa cũ để bắt câu mô tả legacy còn sót.
- Nếu thay đổi làm xuất hiện thuật ngữ mới hoặc đổi nghĩa thuật ngữ cũ, bắt buộc cập nhật `GLOSSARY.md`.
- Không xem task hoàn tất nếu code đã đổi nhưng bộ docs còn mô tả hai policy khác nhau.

Nguyên tắc áp dụng:

- `Moderator` là actor vận hành học phần và các tài nguyên dùng chung theo học phần, trừ khi một tài liệu đặc tả mới ghi ngoại lệ rõ ràng.
- `Admin` mặc định là actor governance hệ thống: user management, scope, quota, category, auditability, cấu hình và báo cáo tổng hợp.
- `README.md` là nơi giữ quy trình; `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `SERVICE_CONTRACT.md` là nơi giữ sự thật chi tiết; `REQUIREMENTS.md` và `GLOSSARY.md` là hai bước khóa cuối để tránh drift.

---

## 7. Tech stack chính thức

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ chính | TypeScript |
| Giao diện | Next.js App Router, React, Tailwind CSS, shadcn/ui |
| Backend/API | Next.js Server Actions/API Routes |
| Database | Supabase PostgreSQL |
| User management & login | Supabase Auth + profile/role layer |
| Storage | Supabase Storage |
| ORM/Query layer | Supabase JS client, SQL migration rõ ràng |
| Migration | Supabase CLI migrations |
| Test | Vitest, React Testing Library, Playwright cho E2E tối thiểu |
| Chart/Dashboard | Recharts hoặc Tremor/Shadcn-compatible chart components |
| Export | SheetJS/xlsx hoặc server-side CSV export |
| Deploy | Vercel cho frontend, Supabase Cloud cho database/storage/Supabase Auth |

---

## 8. Cấu trúc thư mục dự kiến

```text
learning-management-platform/
│
├── README.md
├── START_HERE_FOR_AI_AGENT.md
├── REQUIREMENTS.md
├── SPEC_FINAL.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── DATABASE_SCHEMA.md
├── SERVICE_CONTRACT.md
│
├── app/
│   ├── (auth)/
│   ├── (teacher)/
│   ├── (student)/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── course/
│   ├── class/
│   ├── material/
│   ├── assessment/
│   └── dashboard/
│
├── lib/
│   ├── supabase/
│   ├── services/
│   ├── repositories/
│   ├── integrations/
│   ├── validators/
│   └── utils/
│
├── simulations/
│   ├── registry.ts
│   └── widgets/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── tests/
├── docs/
└── scripts/
```

---

## 9. Cách chạy ứng dụng

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

---

## 10. Cách chạy test

```bash
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm security:scan
pnpm ops:export:critical
pnpm local:start
pnpm local:stop
```

Khoi dong nhanh local website (du full stack Supabase + Next.js):

1. Cach nhanh bang lenh:

```bash
pnpm local:start
```

1. Cach nhanh bang shortcut Windows:

- Chay file `start-local-website.cmd` de khoi dong nhanh.
- Chay file `stop-local-website.cmd` de dung stack local.

Ghi chú:

- `pnpm test`: chỉ chạy unit test, không phụ thuộc Supabase local stack.
- `pnpm test:integration`: tự đảm bảo Supabase local đang chạy rồi mới chạy integration test.
- `pnpm security:scan`: quét file đang được track để chặn commit nhầm local secret.

---

## 11. Quy tắc cứng

- Không đưa Supabase service role key vào client component hoặc browser bundle.
- Không cho sinh viên truy cập tài liệu/lớp/điểm nếu không có bản ghi trong `class_members`.
- Không hard-delete học phần, lớp, tài liệu, bài kiểm tra và kết quả; dùng soft delete hoặc trạng thái archived.
- Không viết business logic trực tiếp trong component UI; UI chỉ gọi service/action rõ ràng.
- Không thay đổi schema, storage layout hoặc service contract nếu chưa cập nhật tài liệu tương ứng.
- Không coi “code chạy được” là hoàn thành nếu thiếu validation, xử lý lỗi và test tối thiểu.
- Không xây quiz engine native toàn diện trong v1; external vẫn là đường mặc định, internal runtime chỉ bổ sung contract và luồng làm bài chuẩn hóa.

---

## 11A. Quy tắc thành phần đánh giá, CLO và import điểm

- `assessment_components` của học phần không còn là text tự do; Mod cấu hình theo 4 loại cố định: `diagnostic`, `frequent`, `periodic`, `final`.
- Mỗi thành phần đánh giá phải khai báo `weight` và danh sách `cloCodes` được gắn với thành phần đó.
- Khi giảng viên tạo bài kiểm tra cho lớp, bắt buộc chọn một `Thành phần`; bài kiểm tra sẽ snapshot `assessmentComponentType` và `assessmentCloCodes` từ học phần tại thời điểm tạo.
- Màn hình kết quả và file mẫu import phải sinh cột động theo thứ tự: `Mã sinh viên | Họ tên | Email | Điểm | CLO... | Nộp lúc | Nguồn | Ghi chú`.
- Các cột `CLO...` chỉ xuất hiện với những CLO đã gắn cho thành phần đánh giá của bài kiểm tra đó. Ví dụ thành phần `final` gắn `CLO3`, `CLO4` thì sau cột `Điểm` là `CLO3`, `CLO4`.
- Điểm tổng vẫn lưu ở `score`; điểm theo CLO được lưu kèm trong metadata của submission để phục vụ import/export và hiển thị kết quả chi tiết.

---

## 12. Triết lý thiết kế phần mềm áp dụng

Dự án này ưu tiên **giảm độ phức tạp dài hạn** hơn là chỉ làm cho tính năng chạy được trước mắt. Khi AI Agent code, phải áp dụng các nguyên tắc sau:

- Thiết kế module sâu: interface đơn giản, phần xử lý phức tạp nằm bên trong service/repository/integration.
- Che giấu thông tin: UI không biết chi tiết Supabase Storage, Google Form hay Microsoft Form hoạt động như thế nào.
- Tách lớp đúng trừu tượng: UI, service, repository, integration adapter và validation không trộn lẫn trách nhiệm.
- Kéo phức tạp xuống dưới: người dùng và component giao diện không phải xử lý nhiều ngoại lệ kỹ thuật.
- Đặt tên chính xác, nhất quán: dùng `course`, `class`, `material`, `assessment`, `submission` xuyên suốt.
- Viết comment cho interface, business rules và quyết định thiết kế không hiển nhiên; không comment lặp lại code.
- Mỗi lần sửa code là cơ hội giảm một phần phức tạp, không tích lũy giải pháp chắp vá.

---

## 13. Khởi động dự án với AI Agent

Dùng prompt sau:

```text
Đọc START_HERE_FOR_AI_AGENT.md, ARCHITECTURE.md, ROADMAP.md, SPEC_FINAL.md, REQUIREMENTS.md, DATABASE_SCHEMA.md và SERVICE_CONTRACT.md trước khi code.
Tuân thủ tech stack, cấu trúc thư mục, business rules, data rules, service boundaries, roadmap phase, acceptance criteria và checklist sau mỗi task.
Không tự ý thay đổi schema, stack, storage layout, API contract hoặc business rules nếu chưa cập nhật tài liệu tương ứng.
Ưu tiên thiết kế đơn giản, module sâu, interface rõ, code dễ đọc và dễ mở rộng.
```

---

## 14. Trạng thái hiện tại

Đã hoàn thành bộ tài liệu nền tảng để chuẩn bị cho AI Agent khởi tạo dự án.

---

## 15. Trạng thái hoàn thiện hiện tại

Ước tính tổng thể website đang ở mức khoảng `85% - 90%` hoàn thiện theo roadmap hiện tại.

### Đã ổn định

- User management, phân quyền, approval workflow và access lifecycle.
- Học phần, tài liệu, mô phỏng, thư viện cá nhân và thư viện dùng chung.
- Lớp học, yêu cầu tham gia lớp của sinh viên, `duyệt tự động`, classroom visual layout và direct message.
- Bài kiểm tra external, import kết quả, webhook đồng bộ, dashboard và export.
- Phòng học trực quan, bảng đen, bàn giảng viên, tủ tài liệu và màn chiếu.

### Đang được siết chặt thêm

- Tối ưu render và giảm truy vấn lặp/N+1 ở các màn quản lý lớp, phòng học, thư viện và dashboard.
- Chuẩn hóa luồng import/export kết quả kiểm tra cho file tiếng Việt và đối chiếu theo `student code`.
- Hoàn thiện loading state, refresh sau mutation và timing log để truy vết điểm nghẽn.

### Ý nghĩa thực tế

- Tính năng lõi đã chạy được end-to-end.
- Phần còn lại chủ yếu là tối ưu vận hành, độ ổn định UI/UX và giảm tải truy vấn thay vì xây thêm module mới lớn.

---

## 16. Trạng thái nền tảng dữ liệu

- Schema đã phản ánh cả external assessment lẫn internal assessment runtime.
- Các bảng trung tâm hiện bao gồm `assessment_attempts`, `assessment_answers`, `assessment_answer_scores`, `submissions`, `course_assessment_results`, `class_resource_links`, `library_categories`, `library_change_requests` và các bảng vận hành liên quan.
- `profiles` dùng role `admin`, `moderator`, `teacher`, `student` và trạng thái truy cập `pending_approval`, `active`, `suspended`, `expired`.
- `submissions` và bảng mirror theo học phần là nguồn chuẩn cho dashboard, export và lịch sử kết quả.

---

## 17. Giấy phép

Private/internal academic project. Chưa mở mã nguồn công khai.
