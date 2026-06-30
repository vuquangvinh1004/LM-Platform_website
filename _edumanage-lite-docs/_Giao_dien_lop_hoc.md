# Giao diện lớp học trực quan (Visual Classroom Layout)

Tài liệu này là đặc tả chính thức để AI Agent thiết kế lại trải nghiệm lớp học theo dạng sơ đồ phòng học trực quan, đồng thời vẫn tuân thủ kiến trúc hiện tại của LMP.

## 1. Mục tiêu thiết kế

- Thay thế trải nghiệm danh sách đơn điệu bằng một không gian lớp học trực quan, tương tác cao.
- Vẫn giữ boundary chuẩn: UI -> Service -> Repository -> DB.
- Không tạo khái niệm dữ liệu mới gây lệch naming convention hiện tại (`class`, `classMember`, `material`, `assessment`).

## 2. Bố cục UI mục tiêu

```
+-----------------------------------------------------------------------------------+
|                                  [ BẢNG ĐEN ]                                     |
|                          (Thông báo lớp + badge thông báo mới)                    |
|                                                                                   |
|    [ MÀN CHIẾU ]                                                [ TỦ TÀI LIỆU ]   |
| (Mô phỏng/slide)                                              (Tài liệu theo lớp)  |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                               [ BÀN GIẢNG VIÊN ]                                  |
|                      (Liên hệ nhanh, chat nhanh, giờ tiếp sinh viên)              |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|                      [ KHU SƠ ĐỒ CHỖ NGỒI SINH VIÊN ]                              |
|     [Bàn SV] [Bàn SV] [Bàn SV] [Bàn SV] ...                                       |
+-----------------------------------------------------------------------------------+
```

## 3. Quy tắc xếp chỗ ngồi tự động (bắt buộc)

Áp dụng sắp xếp tự động cho toàn bộ sinh viên của lớp theo quy tắc deterministic:

1. Sắp xếp tăng dần theo tên đầy đủ (`fullName`) sau khi trim khoảng trắng và normalize lowercase.
2. Gán thứ tự chỗ ngồi từ trái sang phải, từ trên xuống dưới.
3. Bố cục hiển thị mặc định: 4 cột x 5 hàng cho mỗi viewport (20 bàn).
4. Nếu số lượng sinh viên > 20, tiếp tục render hàng mới theo cùng quy tắc (hoặc phân trang UI tùy lựa chọn implementation).

Mỗi bàn sinh viên là một ô chữ nhật gồm 2 khung nhỏ:

- Khung trên: `Tên - Họ`.
- Khung dưới: `MSSV`.

Gợi ý shape dữ liệu chỗ ngồi cho UI:

```ts
type ClassroomSeat = {
  seatOrder: number;
  row: number;
  column: number;
  studentId: string;
  fullName: string;
  studentCode?: string;
  isOnline?: boolean;
};
```

## 4. Tương tác theo từng vật thể

### 4.1. Bảng đen (class announcements)

- Teacher/moderator/admin: mở composer để tạo thông báo.
- Student: mở modal danh sách thông báo published mới nhất.
- Có badge thông báo mới + tooltip hover hiển thị tiêu đề/thời gian thông báo gần nhất.

### 4.2. Bàn giảng viên

- Student click: xem thông tin liên hệ (email, giờ tiếp sinh viên) hoặc mở quick chat.

### 4.3. Tủ tài liệu

- Mở danh sách tài liệu liên quan lớp (ưu tiên map từ materials của course chứa lớp đó).

### 4.4. Màn chiếu

- Mở danh sách simulation widgets theo course/class context.

### 4.5. Bàn sinh viên

- Hiển thị `Tên - Họ` và `MSSV` đúng quy cách 2 khung.
- Trạng thái online (nếu có) hiển thị bằng ring xanh.
- Teacher click bàn sinh viên: mở private message composer.

## 5. Mapping dữ liệu theo schema hiện có (không tạo bảng lệch domain)

Không dùng các bảng giả định `Classrooms`, `Classroom_Students`, `Classroom_Resources`, `Notifications`.

Thay vào đó dùng bảng hiện tại:

1. `classes`: thông tin lớp học phần.
2. `class_members`: danh sách sinh viên của lớp.
3. `class_announcements`: thông báo lớp.
4. `direct_messages`: nhắn tin riêng trong phạm vi lớp.
5. `materials` + quan hệ course-class để hiển thị tài liệu lớp.
6. `simulations` (Phase 5.1) để hiển thị màn chiếu mô phỏng.

## 6. Contract triển khai đề xuất cho AI Agent

AI Agent cần ưu tiên thêm/reuse các service sau khi build UI:

- `ClassroomService.getClassroomLayout(classId, actor)`
- `ClassroomService.listClassAnnouncements(classId, actor)`
- `ClassroomService.createClassAnnouncement(classId, actor, input)`
- `ClassroomService.listClassroomMaterials(classId, actor)`
- `ClassroomService.listClassroomSimulations(classId, actor)`
- `MessageService.sendClassDirectMessage(classId, actor, recipientId, content)`

## 7. Yêu cầu UI implementation

- Dùng token trong `_edumanage-lite-docs/DESIGN.md`, không hardcode palette ngẫu nhiên.
- Responsive: desktop hiển thị đầy đủ sơ đồ; mobile chuyển sang block vertical nhưng giữ thứ tự bàn.
- Accessibility: bàn sinh viên có focus state, keyboard navigation, aria-label rõ ràng.
- Không query Supabase trực tiếp trong client component cho business rules.

## 8. Prompt gợi ý cho AI Agent

```text
Hãy thiết kế trang classroom visual layout cho LMP theo tài liệu docs/classroom-visual-design.md.

Ràng buộc bắt buộc:
- Dùng classes/class_members/class_announcements/direct_messages hiện có, không tạo bảng Classrooms/Classroom_Students mới.
- Chỗ ngồi tự động: sort fullName tăng dần, xếp trái sang phải, trên xuống dưới, layout mặc định 4 cột x 5 hàng.
- Mỗi bàn là ô chữ nhật gồm 2 khung: khung trên Tên - Họ, khung dưới MSSV.
- UI không chứa business logic truy cập dữ liệu; gọi service layer.
- Có loading/error/empty state cho từng khu vực bảng đen, tủ tài liệu, màn chiếu, bàn sinh viên.
```
