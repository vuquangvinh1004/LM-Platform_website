# START_HERE_FOR_AI_AGENT.md

# BẮT ĐẦU TỪ ĐÂY CHO AI AGENT

File này là điểm khởi động bắt buộc trước mọi phiên code cho dự án `Learning Management Platform (LMP)`.

---

## 1. Thứ tự đọc bắt buộc

Trước khi code, đọc theo thứ tự:

1. `START_HERE_FOR_AI_AGENT.md` (bạn đang đọc file này)
2. `README.md`
3. `DESIGN.md`
4. `ARCHITECTURE.md`
5. `ROADMAP.md`
6. `SPEC_FINAL.md`
7. `REQUIREMENTS.md`
8. `DATABASE_SCHEMA.md`
9. `SERVICE_CONTRACT.md`

Không bắt đầu code nếu chưa xác định task thuộc phase/sprint nào trong roadmap.

Task-specific docs bo sung:

- Neu task thuoc redesign lop hoc truc quan (Sprint 5.1), bat buoc doc them `_Giao_dien_lop_hoc.md` va `roadmap/plans/SPRINT_5_1_CLASSROOM_VISUAL_BACKLOG.md` truoc khi code.
- Neu task chạm UI/component/theme, bat buoc doi chieu them voi `DESIGN.md`.

---

## 2. Bản chất sản phẩm

`LMP` là:

```text
Website hỗ trợ học tập và quản lý lớp học nhẹ dành cho giảng viên, dùng Next.js + Supabase, hỗ trợ bài kiểm tra external qua Google Form/Microsoft Form và internal runtime chuẩn hóa, tập trung vào học phần, tài liệu, lớp học, kết quả, mô phỏng đơn giản và dashboard vận hành.
```

Trọng tâm của sản phẩm:

1. Quản lý học phần.
2. Quản lý tài liệu học tập và quyền truy cập.
3. Quản lý lớp học và sinh viên.
4. Gắn bài kiểm tra external form hoặc internal runtime và ghi nhận kết quả.
5. Dashboard giảng viên và xuất dữ liệu.
6. Mô phỏng học tập đơn giản, mở rộng dần.

Sản phẩm này không phải:

1. LMS toàn diện như Moodle trong phiên bản đầu.
2. Quiz engine native đầy đủ trong phiên bản đầu.
3. Hệ thống thi trực tuyến chống gian lận.
4. Nền tảng thương mại khóa học.

---

## 3. Quy tắc không được vi phạm

1. Không đổi tech stack nếu chưa cập nhật `ARCHITECTURE.md` và `ROADMAP.md`.
2. Không viết business logic trong UI/component nếu architecture yêu cầu tách service.
3. Không thay đổi database schema nếu chưa có migration hoặc ghi chú schema rõ ràng.
4. Không thay đổi service/API contract nếu chưa cập nhật `SERVICE_CONTRACT.md`.
5. Không thay đổi storage layout nếu chưa cập nhật tài liệu.
6. Không bỏ qua validation dữ liệu đầu vào.
7. Không nuốt lỗi im lặng.
8. Không hard-delete dữ liệu quan trọng nếu chưa có delete policy.
9. Không đánh dấu task hoàn thành nếu chưa có test phù hợp.
10. Không báo “đã xong” nếu chưa nêu files thay đổi, test result và rủi ro còn lại.
11. Không đưa Supabase service role key vào client.
12. Không cho sinh viên truy cập tài liệu, lớp hoặc điểm ngoài membership hợp lệ.

---

## 4. Triết lý thiết kế bắt buộc

AI Agent phải code theo tư duy thiết kế chiến lược, không chỉ làm cho tính năng chạy được.

### 4.1. Mục tiêu trung tâm

Giảm độ phức tạp dài hạn. Code phải dễ đọc, dễ sửa, dễ mở rộng và dễ kiểm tra.

### 4.2. Dấu hiệu cần tránh

- Một thay đổi nhỏ phải sửa quá nhiều nơi.
- Người đọc phải biết quá nhiều chi tiết để sửa một task nhỏ.
- Không rõ phải sửa file nào khi thêm tính năng.
- UI chứa quá nhiều query, business rule và provider logic.
- Tên biến/hàm chung chung như `data`, `item`, `handleStuff`, `processForm`.

### 4.3. Nguyên tắc phải áp dụng

- Module sâu, interface hẹp.
- Che giấu thông tin implementation.
- Tách UI, service, repository và integration adapter.
- Kéo phức tạp xuống service/adapter thay vì đẩy lên UI.
- Dùng constraint và validation để giảm lỗi phát sinh.
- Đặt tên chính xác, nhất quán.
- Comment cho lý do thiết kế và business rule, không comment lặp lại code.
- Mỗi lần sửa code nên cải thiện thiết kế ít nhất một điểm nhỏ nếu có thể.

---

## 5. Câu hỏi bắt buộc trước khi code

Trước mỗi task, xác định:

| Câu hỏi | Trả lời |
|---|---|
| Task thuộc phase nào? | Ghi rõ theo `ROADMAP.md` |
| Task chạm module nào? | Auth/Course/Class/Material/Assessment/Submission/Dashboard/Simulation |
| Có đổi schema không? | Có/Không |
| Có đổi business rule không? | Có/Không |
| Có đổi service/API contract không? | Có/Không |
| Có ảnh hưởng file/storage không? | Có/Không |
| Cần test loại nào? | Unit/Integration/UI/E2E |
| Có cần cập nhật docs không? | Có/Không |
| Có làm tăng complexity không? | Nếu có, nêu cách giảm |

### 5.1. Preflight checklist cho task nhỏ (quick mode)

Dùng checklist này cho task nhỏ (ví dụ fix typo, chỉnh UI nhẹ, đổi validator nhỏ) để giảm overhead nhưng vẫn giữ chất lượng:

- [ ] Đã xác định phase/sprint trong `ROADMAP.md`.
- [ ] Đã xác định module/layer bị chạm (UI, Service, Repository hoặc Integration Adapter).
- [ ] Không vi phạm boundary (đặc biệt: không đưa business logic vào UI).
- [ ] Không đổi schema/contract nếu chưa có kế hoạch cập nhật docs tương ứng.
- [ ] Có kế hoạch test tối thiểu và cách xác thực kết quả.

---

## 6. Quy trình làm việc chuẩn

```text
1. Đọc tài liệu liên quan
2. Xác định phase/sprint
3. Xác định files cần sửa
4. Đề xuất phương án ngắn
5. Với module lớn, cân nhắc ít nhất 2 thiết kế
6. Code theo architecture boundaries
7. Viết test phù hợp
8. Chạy test
9. Cập nhật tài liệu nếu cần
10. Báo cáo kết quả
```

---

## 7. Báo cáo sau task

Báo cáo tối thiểu:

```text
Task đã thực hiện:
Phase/Sprint:
Files đã thay đổi:
Kết quả test:
Migration/schema change:
Ảnh hưởng service/API contract:
Ảnh hưởng business rule:
Ảnh hưởng storage/file:
Rủi ro còn lại:
Docs đã cập nhật:
Decision log (2-3 dòng: phương án A/B và lý do chọn):
```

---

## 8. Prompt mẫu cho task tính năng mới

```text
Đọc START_HERE_FOR_AI_AGENT.md, ARCHITECTURE.md, ROADMAP.md, SPEC_FINAL.md, DATABASE_SCHEMA.md và SERVICE_CONTRACT.md trước khi code.

Nhiệm vụ: [mô tả task]

Yêu cầu:
- Xác định task thuộc phase/sprint nào.
- Tuân thủ architecture boundaries.
- Không viết business logic sai lớp.
- Nếu đổi schema, cập nhật DATABASE_SCHEMA.md và migration.
- Nếu đổi API/service, cập nhật SERVICE_CONTRACT.md.
- Viết test phù hợp.
- Sau khi hoàn thành, cập nhật ROADMAP và CHANGELOG nếu cần.
- Báo cáo files thay đổi, test result và rủi ro còn lại.
```

---

## 8A. Prompt bootstrap ngắn cho Cursor/GitHub Copilot Agent

Nếu cần một prompt ngắn để khởi tạo phiên làm việc trong agent tool, dùng trực tiếp mẫu dưới đây thay cho file riêng:

```text
Bạn là AI Agent phụ trách dự án LMP (Learning Management Platform).

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
10. roadmap/plans/SPRINT_5_1_CLASSROOM_VISUAL_BACKLOG.md

Nhiệm vụ đầu tiên:
- Không code ngay.
- Tóm tắt bản chất sản phẩm trong 10 dòng.
- Xác định task thuộc phase/sprint nào.
- Liệt kê files sẽ tạo/sửa.
- Liệt kê migration/service contract/docs nào có thể bị chạm.
- Nêu test cần chạy và rủi ro chính cần tránh.

Chỉ bắt đầu code sau khi đã tóm tắt và chốt hướng tiếp cận.
```

---

## 9. Prompt mẫu cho fix bug

```text
Trước khi bắt đầu:
1. Đọc ARCHITECTURE.md mục business rules, data safety và error handling.
2. Đọc ROADMAP.md mục bug tracker và risk tracker.
3. Xác định root cause trước khi sửa.

Nhiệm vụ: Fix [BUG_ID] - [mô tả bug]

Sau khi hoàn thành:
1. Cập nhật bug tracker.
2. Thêm regression test.
3. Ghi root cause và solution vào CHANGELOG nếu cần.
4. Báo cáo test pass.
```

---

## 10. Prompt mẫu cho tạo module mới

```text
Hãy thiết kế module [tên module] cho LMP.

Trước khi code:
- Đọc ARCHITECTURE.md để xác định layer đúng.
- Đọc DATABASE_SCHEMA.md để xem có cần bảng/cột mới không.
- Đọc SERVICE_CONTRACT.md để xác định contract.
- Đề xuất 2 phương án thiết kế ngắn.
- Chọn phương án có interface đơn giản hơn, ít phụ thuộc hơn và dễ test hơn.

Khi code:
- Tạo validator bằng Zod nếu có input.
- Tạo service method rõ tên.
- Tạo repository nếu chạm database.
- Không query database trực tiếp trong component.
- Viết test tối thiểu cho business rule quan trọng.
```

---

## 11. Definition of Done cho AI Agent

Một task chỉ được xem là hoàn thành khi:

- [ ] Code chạy được.
- [ ] Không phá hành vi hiện có.
- [ ] Có test phù hợp.
- [ ] Test liên quan pass.
- [ ] Có rollback/error handling phù hợp.
- [ ] Không lộ secret.
- [ ] Không bypass RLS/authorization.
- [ ] Cập nhật ROADMAP nếu task thuộc phase/sprint.
- [ ] Cập nhật ARCHITECTURE nếu thay đổi kiến trúc/business rule.
- [ ] Cập nhật DATABASE_SCHEMA nếu đổi schema.
- [ ] Cập nhật SERVICE_CONTRACT nếu đổi interface.
- [ ] Báo cáo files đã thay đổi và rủi ro còn lại.

---

## 12. Lệnh đầu tiên đề xuất cho AI Agent

```text
Hãy đọc toàn bộ tài liệu nền tảng trong thư mục root. Sau đó tạo kế hoạch Phase 0 cho dự án LMP, bao gồm cấu trúc thư mục Next.js, dependencies cần cài, .env.example, Supabase setup checklist và migration đầu tiên cho bảng profiles. Chưa code ngay nếu chưa liệt kê rõ files sẽ tạo/sửa.

---

## 13. Trạng thái hiện tại

- Website đã vượt qua giai đoạn MVP kỹ thuật cơ bản và hiện tập trung vào hardening, performance và chuẩn hóa docs/contract.
- Bài kiểm tra đã có external flow ổn định và contract cho internal runtime, nhưng internal end-to-end vẫn cần được hoàn thiện theo roadmap phase sau nếu muốn dùng rộng rãi.
- Khi code mới, ưu tiên xem đây là nền tảng đang vận hành thật chứ không phải demo, vì vậy phải giữ tính nhất quán giữa docs, schema, service contract và UI.
```
