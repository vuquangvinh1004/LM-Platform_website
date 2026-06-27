# SERVICE_CONTRACT.md

# Learning Management Platform (LMP) SERVICE CONTRACT

## 1. Vai trò của file này

File này định nghĩa contract giữa UI, service layer, repository layer và các integration adapter. AI Agent không được thay đổi tên service, input/output shape hoặc error behavior nếu chưa cập nhật file này.

---

## 2. Nguyên tắc contract

- Service contract phải ổn định hơn implementation.
- UI chỉ phụ thuộc vào contract, không phụ thuộc vào chi tiết Supabase/Google/MS Form.
- Service trả về lỗi có cấu trúc, không throw lỗi thô ra UI.
- Tên method phải rõ hành động và domain.
- Contract nên đủ sâu: một method service nên che giấu nhiều bước kỹ thuật phía dưới nếu đó là một nghiệp vụ thống nhất.

---

## 3. Kiểu dữ liệu chung

```ts
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

type AppError = {
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'CONFLICT'
    | 'EXTERNAL_PROVIDER_ERROR'
    | 'STORAGE_ERROR'
    | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  details?: unknown;
};

type UserRole = 'admin' | 'moderator' | 'teacher' | 'student';
type EntityStatus = 'draft' | 'active' | 'archived';
type AccessStatus = 'pending_approval' | 'active' | 'suspended' | 'expired';
```

---

## 4. `AuthService`

### 4.1. `getCurrentProfile()`

```ts
getCurrentProfile(): Promise<ServiceResult<Profile>>
```

Mục đích: lấy profile của người dùng hiện tại.

Lỗi có thể có:

- `UNAUTHORIZED`: chưa đăng nhập.
- `NOT_FOUND`: auth user có nhưng chưa có profile.

### 4.2. `requireRole(allowedRoles)`

```ts
requireRole(allowedRoles: UserRole[]): Promise<ServiceResult<Profile>>
```

Mục đích: guard route/server action theo vai trò.

### 4.3. `approveStudentAccess()`

```ts
approveStudentAccess(input: {
  studentId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  expiresAt?: string;
}): Promise<ServiceResult<{ studentId: string; accessStatus: 'active' }>>
```

Mục đích: duyệt quyền truy cập học tập cho sinh viên ở trạng thái chờ duyệt.

Quy tắc bo sung:

- Sau khi duyet thanh cong, ghi `activity_logs` voi action `student.access.approved`.

### 4.4. `renewStudentAccess()`

```ts
renewStudentAccess(input: {
  studentId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  expiresAt: string;
}): Promise<ServiceResult<{ studentId: string; accessExpiresAt: string }>>
```

Mục đích: gia hạn truy cập cho tài khoản sinh viên đã hoặc sắp hết hạn.

Quy tắc bo sung:

- Sau khi gia han thanh cong, ghi `activity_logs` voi action `student.access.renewed`.

---

## 4A. `UserManagementService`

### 4A.1. `createManagedUser()`

```ts
createManagedUser(input: {
  actorId: string;
  actorRole: Extract<UserRole, 'admin'>;
  role: Extract<UserRole, 'moderator' | 'teacher'>;
  fullName: string;
  email: string;
  password?: string;
  accessExpiresAt?: string;
}): Promise<ServiceResult<{
  userId: string;
  role: 'moderator' | 'teacher';
  profileId: string;
}>>
```

Mục đích: Admin tạo tài khoản `moderator` hoặc `teacher` từ module User management.

Quy tắc:

- Chỉ `admin` được gọi.
- `teacher` và `moderator` không tự đăng ký qua public auth flow.
- Service phải tạo đồng bộ auth user, profile và trạng thái truy cập mặc định phù hợp.
- Sau khi tạo thành công, ghi `activity_logs` với action `user.management.created`.

### 4A.2. `updateManagedUserRole()`

```ts
updateManagedUserRole(input: {
  actorId: string;
  actorRole: Extract<UserRole, 'admin'>;
  userId: string;
  role: Extract<UserRole, 'moderator' | 'teacher' | 'student'>;
}): Promise<ServiceResult<{ userId: string; role: UserRole }>>
```

Mục đích: Admin điều chỉnh vai trò vận hành của tài khoản trong UI quản trị.

### 4A.3. `listManagedUsers()`

```ts
listManagedUsers(input: {
  actorId: string;
  actorRole: Extract<UserRole, 'admin'>;
  role?: UserRole;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<Profile>>>
```

Mục đích: cấp dữ liệu cho màn hình “User management”.

---

## 5. `CourseService`

### 5.1. `listCoursesForUser()`

```ts
listCoursesForUser(input: {
  userId: string;
  role: UserRole;
  query?: string;
  status?: 'draft' | 'active' | 'archived';
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<CourseSummary>>>
```

Mục đích: trả về danh sách học phần theo quyền.

### 5.2. `createCourse()`

```ts
createCourse(input: {
  ownerId: string;
  actorRole: UserRole;
  code: string;
  title: string;
  description?: string;
  visibility?: 'private' | 'unlisted' | 'public_preview';
  credits?: number;
  knowledgeBlock?: 'general' | 'foundation' | 'major';
  courseType?: 'required' | 'elective';
  cloItems?: Array<{ code: string; description: string }>;
  assessmentComponents?: Array<{ type: string; weight: number }>;
}): Promise<ServiceResult<Course | CourseChangeRequest>>
```

Quy tắc:

- Chỉ `moderator` hoặc `admin` được xử lý yêu cầu tạo học phần ở UI hiện tại.
- `admin` không đi theo luồng tạo trực tiếp ở UI vận hành tiêu chuẩn; `admin` duyệt yêu cầu tạo học phần để hệ thống sinh học phần thật.
- `moderator` tạo `course_change_requests(action='create')` như một yêu cầu tạo học phần; chỉ `admin` duyệt, sau đó hệ thống tạo course `active` và cấp scope mặc định cho Mod được giao.
- Tổng `assessmentComponents.weight` phải bằng 100% nếu có nhập thành phần đánh giá.
- `code` unique theo `owner_id`.
- Default `status = draft`.

### 5.3. `updateCourse()`

```ts
updateCourse(input: {
  courseId: string;
  actorId: string;
  actorRole: UserRole;
  title: string;
  description?: string;
  visibility: 'private' | 'unlisted' | 'public_preview';
  status: 'draft' | 'active' | 'archived';
  credits?: number;
  knowledgeBlock?: 'general' | 'foundation' | 'major';
  courseType?: 'required' | 'elective';
  cloItems?: Array<{ code: string; description: string }>;
  assessmentComponents?: Array<{ type: string; weight: number }>;
}): Promise<ServiceResult<Course>>
```

Quy tắc:

- Chỉ `moderator` hoặc `admin` dùng màn hình quản lý học phần.
- `moderator` chỉ sửa được học phần trong scope được cấp.
- Nếu không tìm thấy hoặc không đủ quyền, trả `NOT_FOUND`.

### 5.4. `archiveCourse()`

```ts
archiveCourse(input: {
  courseId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<{ archived: true }>>
```

Quy tắc:

- Không hard-delete.
- Chỉ `teacher`, `moderator` hoặc `admin` được archive.
- `teacher` chỉ archive được học phần do mình sở hữu.
- `teacher` gửi yêu cầu lưu trữ; `moderator/admin` xử lý theo scope. Xóa học phần là Admin-only.

---

## 5A. `SimulationService`

### 5A.1. `listSimulationsForCourse()`

```ts
listSimulationsForCourse(input: {
  courseId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<Array<{
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}>>>
```

Quy tắc:

- Dùng RLS theo course scope; nếu actor không thấy được course thì trả `NOT_FOUND`.
- Không hard-delete; danh sách mặc định không trả item `archived`.
- Dùng cho trang simulation theo course và projector panel theo class-course context.

---

## 6. `ClassService`

### 6.1. `createClass()`

```ts
createClass(input: {
  courseId: string;
  teacherId: string;
  teacherRole: UserRole;
  classCode: string;
  title: string;
  semester?: string;
  academicYear?: string;
  status?: 'draft' | 'active' | 'archived';
}): Promise<ServiceResult<CourseClass>>
```

Quy tắc:

- Chỉ `teacher` hoặc `admin` được dùng service cho luồng yêu cầu mở lớp.
- `teacher` tạo `class_change_requests(action='create')` như một yêu cầu mở lớp; Mod/Admin duyệt mới sinh lớp thật.
- `admin` không dùng luồng tạo trực tiếp trong UI vận hành tiêu chuẩn; Admin chỉ xử lý yêu cầu mở lớp của giảng viên.
- `moderator` không tạo lớp; Mod chỉ duyệt yêu cầu thay đổi lớp và xem thống kê theo scope.
- Nếu học phần đã `archived`, trả `CONFLICT`.
- `classCode` phải unique theo học phần + học kỳ + năm học.

### 6.2. `addStudentsToClass()`

```ts
addStudentsToClass(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
  students: Array<{
    email?: string;
    studentCode?: string;
    fullName: string;
  }>;
}): Promise<ServiceResult<AddStudentsResult>>
```

Output:

```ts
type AddStudentsResult = {
  added: number;
  skipped: number;
  needsReview: Array<{ row: number; reason: string }>;
};
```

Quy tắc:

- Import không được tạo duplicate active membership.
- Nếu chưa tìm thấy user theo email/student code, trả `needsReview` cho từng dòng.
- Chỉ `teacher`, `moderator` hoặc `admin` được thêm sinh viên.

### 6.3. `importStudentsToClass()`

```ts
importStudentsToClass(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
  csvContent: string;
}): Promise<ServiceResult<AddStudentsResult>>
```

Quy tắc:

- CSV phải có cột `fullName` hoặc `ho ten`.
- CSV phải có ít nhất một cột định danh: `email` hoặc `studentCode`/`ma sinh vien`.
- Import tái sử dụng cùng rule duplicate và permission của `addStudentsToClass()`.

### 6.4. `listClassesForUser()`

```ts
listClassesForUser(input: {
  actorId: string;
  actorRole: UserRole;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<CourseClassSummary>>>
```

Quy tắc:

- `teacher`: chỉ thấy lớp của học phần mình quản lý.
- `moderator`: chỉ thấy lớp thuộc scope được cấp.
- `student`: chỉ thấy lớp có active membership.
- `admin`: thấy tất cả lớp.

### 6.5. `listClassMembers()`

```ts
listClassMembers(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<ClassMemberSummary>>>
```

### 6.6. `getClassroomLayout()`

```ts
getClassroomLayout(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<{
  classInfo: CourseClassSummary;
  seats: Array<{
    seatOrder: number;
    row: number;
    column: number;
    studentId: string;
    fullName: string;
    studentCode?: string;
    isOnline?: boolean;
  }>;
  seatRules: {
    sortBy: 'fullNameAsc';
    fillDirection: 'left-to-right-then-top-to-bottom';
    columns: 4;
    rowsPerViewport: 5;
  };
}>>
```

Quy tắc:

- Chỉ actor có quyền trong lớp mới được lấy layout.
- Dữ liệu seat được tạo tự động từ `class_members` (không ghi DB ở phiên bản đầu).
- Mỗi seat phải map đúng thông tin hiển thị: `Tên - Họ` và `MSSV`.

### 6.7. `listClassAnnouncements()`

```ts
listClassAnnouncements(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<{
  id: string;
  title: string;
  content: string;
  status: 'published' | 'archived';
  createdAt: string;
  createdBy: string;
}>>>
```

### 6.8. `createClassAnnouncement()`

```ts
createClassAnnouncement(input: {
  classId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  title: string;
  content: string;
}): Promise<ServiceResult<{ announcementId: string }>>
```

Quy tắc:

- Chỉ actor có quyền quản lý lớp mới được tạo.
- Mặc định tạo với `status = 'published'`.
- Sau khi tạo thành công, ghi `activity_logs` với action `class.announcement.created`.

### 6.9. `listClassroomMaterials()`

```ts
listClassroomMaterials(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<Array<{
  materialId: string;
  title: string;
  fileType: string;
  sectionLabel?: string;
}>>>
```

Quy tắc:

- Lấy material theo context học phần của lớp.
- Không trả storage path private trực tiếp.

### 6.10. `listClassroomSimulations()`

```ts
listClassroomSimulations(input: {
  classId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<Array<{
  simulationId: string;
  slug: string;
  title: string;
  description?: string;
}>>>
```

Quy tắc:

- Luồng này phụ thuộc Sprint 5.1 simulation registry.

---

## 6A. `MessageService` (classroom private messaging)

### 6A.1. `sendClassDirectMessage()`

```ts
sendClassDirectMessage(input: {
  classId: string;
  senderId: string;
  senderRole: UserRole;
  recipientId: string;
  content: string;
}): Promise<ServiceResult<{ messageId: string; createdAt: string }>>
```

Quy tắc:

- Người gửi phải thuộc lớp hoặc có quyền quản lý lớp.
- Không cho gửi message rỗng.
- Khi gửi thành công, ghi `activity_logs` với action `class.direct_message.sent`.

### 6A.2. `listClassDirectMessages()`

```ts
listClassDirectMessages(input: {
  classId: string;
  actorId: string;
  counterpartId: string;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<{
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt?: string;
}>>>
```

Quy tắc:

- Chỉ trả conversation mà actor là participant.
- Tôn trọng RLS của `direct_messages`.

---

## 7. `MaterialService`

### 7.1. `createUploadIntent()`

```ts
createUploadIntent(input: {
  courseId?: string;
  actorId: string;
  actorRole: UserRole;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<ServiceResult<MaterialUploadIntent>>
```

Mục đích: chuẩn hóa upload path và kiểm tra quyền trước khi upload.

Output:

```ts
type MaterialUploadIntent = {
  courseId: string | null;
  storageBucket: 'course-materials';
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};
```

Quy tac:

- Neu `courseId` rong va actor la `teacher`, upload intent thuoc Thu vien ca nhan va phai qua kiem tra quota.

### 7.2. `registerUploadedMaterial()`

```ts
registerUploadedMaterial(input: {
  courseId?: string;
  actorId: string;
  actorRole: UserRole;
  categoryId?: string;
  title: string;
  description?: string;
  sectionLabel?: string;
  tags?: string[];
  storageBucket: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  allowDownload: boolean;
}): Promise<ServiceResult<Material>>
```

Quy tắc:

- Chỉ `teacher`, `moderator` hoặc `admin` được lưu metadata tài liệu.
- `storageBucket` phải là `course-materials`.
- `storagePath` phải nằm trong namespace của `courseId` hoac `personal/{actorId}`.
- `categoryId` là tùy chọn, lấy từ `library_categories` active.
- `tags` được parse từ chuỗi người dùng nhập, phân cách bằng dấu `;`, tối đa 20 tag.
- Neu `courseId` rong, tai lieu nam trong Thu vien ca nhan.
- Neu `courseId` co gia tri va actor la `teacher`, service dat `review_status = 'pending_review'`.

### 7.3. `getReadableMaterial()`

```ts
getReadableMaterial(input: {
  materialId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<ReadableMaterial>>
```

Output:

```ts
type ReadableMaterial = {
  id: string;
  title: string;
  fileType: string;
  viewUrl: string;
  downloadUrl?: string;
  allowDownload: boolean;
};
```

Quy tắc:

- Service phải kiểm tra quyền xem trước khi tạo signed URL.
- Nếu `allow_download = false`, không trả `downloadUrl`.
- Student chỉ xem được material `published` khi có `class_members.status = active` trong lớp active của course tương ứng.
- Đồng thời tài khoản student phải có `access_status = active` và chưa quá hạn truy cập.

---

## 8. `EnrollmentService`

### 8.1. `createEnrollmentRequests()`

```ts
createEnrollmentRequests(input: {
  studentId: string;
  requests: Array<{
    courseId: string;
    classId?: string;
  }>;
}): Promise<ServiceResult<{
  created: number;
  skipped: number;
  duplicates: Array<{ courseId: string; classId?: string }>;
}>>
```

Mục đích: sinh viên gửi yêu cầu tham gia nhiều học phần/lớp cùng lúc.

Quy tắc:

- Payload duplicate theo cặp `(courseId, classId)` được tự động gom nhóm trước khi ghi DB.
- Duplicate đang `pending` trong DB được trả về `duplicates` thay vì làm hỏng toàn bộ batch.

### 8.2. `reviewEnrollmentRequest()`

```ts
reviewEnrollmentRequest(input: {
  requestId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'teacher'>;
  decision: 'approved' | 'rejected';
  note?: string;
}): Promise<ServiceResult<{ requestId: string; status: 'approved' | 'rejected' }>>
```

Quy tắc:

- Chỉ `teacher` được duyệt yêu cầu tham gia lớp.
- `teacher` chỉ duyệt yêu cầu tham gia lớp thuộc lớp/học phần mình phụ trách.
- `moderator` và `admin` không duyệt yêu cầu tham gia lớp của sinh viên.
- Khi `decision = approved`, service phải kích hoạt membership lớp học theo hướng idempotent (không tạo duplicate).
- Nếu yêu cầu chưa chỉ định `classId`, service chỉ tự map khi học phần có đúng 1 lớp active; trường hợp còn lại trả `CONFLICT`.
- Sau khi duyệt yêu cầu (approved/rejected), ghi `activity_logs` với action tương ứng.

### 8.3. `reviewEnrollmentRequestsBatch()`

```ts
reviewEnrollmentRequestsBatch(input: {
  actorId: string;
  actorRole: Extract<UserRole, 'teacher'>;
  decision: 'approved' | 'rejected';
  note?: string;
  requests: Array<{ requestId: string }>;
}): Promise<ServiceResult<{
  reviewed: number;
  failed: number;
  results: Array<{
    requestId: string;
    ok: boolean;
    status?: 'approved' | 'rejected';
    errorCode?: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'UNKNOWN_ERROR';
    message?: string;
  }>;
}>>
```

Quy tắc:

- Duyệt hàng loạt theo một `decision`, nhưng kết quả trả về theo từng `requestId`.
- Chỉ `teacher` được dùng batch duyệt cho các yêu cầu tham gia lớp thuộc lớp/học phần mình phụ trách.
- Request ngoài scope hoặc không hợp lệ không làm fail toàn bộ batch.

### 8.4. `listOpenEnrollmentOptions()`

```ts
listOpenEnrollmentOptions(): Promise<ServiceResult<{
  options: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    classId: string;
    classCode: string;
    classTitle: string;
    semester?: string;
    academicYear?: string;
  }>;
}>>
```

Mục đích: hiển thị danh sách lớp/học phần đang mở trên màn hình đăng ký.

---

## 9. `AssessmentService`

### 8.1. `createAssessment()`

```ts
createAssessment(input: {
  classId: string;
  courseId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
  actorId: string;
  title: string;
  description?: string;
  deliveryMode: 'external' | 'internal';
  provider: 'google_form' | 'microsoft_form' | 'manual' | 'internal' | 'other';
  formUrl?: string;
  embedMode?: 'iframe' | 'new_tab' | 'disabled';
  maxScore?: number;
  attemptLimit?: number;
  shuffleQuestions?: boolean;
  showFeedbackAfterSubmit?: boolean;
  timeLimitMinutes?: number;
  openAt?: string;
  dueAt?: string;
  status?: 'draft' | 'open' | 'closed' | 'archived';
}): Promise<ServiceResult<Assessment>>
```

Quy tắc:

- Chi `teacher` duoc tao assessment trong UI hien tai.
- Validate provider domain nếu là Google/MS Form.
- Neu `deliveryMode = 'internal'` thi service normalize `provider = 'internal'`, xoa `formUrl` va force `embedMode = 'disabled'`.
- Neu `deliveryMode = 'external'` thi van giu nguyen luong Google Form / Microsoft Form / external source hien co.
- Nếu form không hỗ trợ iframe, dùng `new_tab`.
- Default status: `draft` hoặc `open` theo input.
- Mỗi assessment thuộc đúng một `courseId` và một `classId`.
- Assessment có thể liên kết nhiều câu hỏi từ ngân hàng đề thi của học phần qua `assessment_question_links`.

### 8.1A. `getAssessmentAuthoringMode()`

```ts
getAssessmentAuthoringMode(input: {
  assessmentId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
}): Promise<ServiceResult<{
  assessmentId: string;
  deliveryMode: 'external' | 'internal';
  provider: 'google_form' | 'microsoft_form' | 'manual' | 'internal' | 'other';
  embedMode: 'iframe' | 'new_tab' | 'disabled';
}>>
```

Mục đích:

- Tra ve co hieu authoring/runtime de UI biet assessment dang di theo luong external hay internal.

Quy tắc:

- Chi `teacher`, `moderator`, `admin` duoc dung contract nay.

### 8.1B. `getInternalAssessmentDefinition()`

```ts
getInternalAssessmentDefinition(input: {
  assessmentId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
}): Promise<ServiceResult<{
  assessmentId: string;
  classId: string;
  classCode: string;
  classTitle: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description?: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  attemptLimit: number;
  shuffleQuestions: boolean;
  showFeedbackAfterSubmit: boolean;
  timeLimitMinutes?: number;
  openAt?: string;
  dueAt?: string;
  questions: Array<{
    questionBankItemId: string;
    sortOrder: number;
    prompt: string;
    questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    choices: string[];
    answerKey: unknown;
    explanation: string | null;
    points: number;
  }>;
}>>
```

Mục đích:

- Doc snapshot cau hoi cua assessment noi bo de cap cho UI lam bai/cham bai o cac phase tiep theo.

Quy tắc:

- Neu assessment khong phai mode `internal`, tra `NOT_FOUND`.
- Student chi doc duoc khi co quyen xem assessment theo membership/RLS.

## 9A. `QuestionBankService`

### 9A.1. `listQuestionBankItems()`

```ts
listQuestionBankItems(input: {
  courseId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  query?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<QuestionBankItem>>>
```

Mục đích: trả về ngân hàng đề thi theo học phần.

### 9A.2. `upsertQuestionBankItem()`

```ts
upsertQuestionBankItem(input: {
  questionId?: string;
  courseId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  content: string;
  questionType: 'single_choice' | 'multiple_choice' | 'short_answer' | 'essay' | 'other';
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  answerOptions?: Array<{ key: string; content: string; isCorrect?: boolean }>;
  explanation?: string;
  tags?: string[];
}): Promise<ServiceResult<QuestionBankItem>>
```

Quy tắc:

- `teacher` chỉ thêm/sửa câu hỏi trong học phần mình phụ trách.
- `moderator` và `admin` được xem và quản lý theo scope/phạm vi toàn cục.
- Câu hỏi chỉ được gắn vào assessment cùng `courseId`.

### 9A.3. `assignQuestionsToAssessment()`

```ts
assignQuestionsToAssessment(input: {
  assessmentId: string;
  courseId: string;
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  questionIds: string[];
}): Promise<ServiceResult<{ assessmentId: string; linked: number }>>
```

Quy tắc:

- Chỉ cho phép lấy câu hỏi từ ngân hàng đề thi của đúng học phần.
- Lệnh này không xóa bài kiểm tra; chỉ đồng bộ liên kết `assessment_question_links`.

### 8.2. `getAssessmentForStudent()`

```ts
getAssessmentForStudent(input: {
  assessmentId: string;
  studentId: string;
}): Promise<ServiceResult<StudentAssessmentView>>
```

Quy tắc:

- Student phải là member active của class.
- Assessment phải `open` hoặc policy cho phép xem.

## 9B. `AssessmentRuntimeService`

### 9B.1. `startAssessmentAttempt()`

```ts
startAssessmentAttempt(input: {
  assessmentId: string;
  studentId: string;
}): Promise<ServiceResult<{
  attempt: {
    id: string;
    assessmentId: string;
    studentId: string;
    attemptNumber: number;
    status: 'in_progress' | 'submitted' | 'auto_graded' | 'graded' | 'abandoned' | 'expired';
    startedAt: string;
    submittedAt?: string;
    expiresAt?: string;
    autoGradedAt?: string;
    gradedAt?: string;
    metadata: Record<string, unknown>;
  } | null;
  answers: Array<{
    attemptId: string;
    assessmentId: string;
    questionBankItemId: string;
    sortOrder: number;
    answerPayload: Record<string, unknown>;
    answeredAt?: string;
    isFinal: boolean;
  }>;
}>>
```

### 9B.2. `getAssessmentAttemptForStudent()`

```ts
getAssessmentAttemptForStudent(input: {
  assessmentId: string;
  studentId: string;
  attemptId?: string;
}): Promise<ServiceResult<{
  attempt: {
    id: string;
    assessmentId: string;
    studentId: string;
    attemptNumber: number;
    status: 'in_progress' | 'submitted' | 'auto_graded' | 'graded' | 'abandoned' | 'expired';
    startedAt: string;
    submittedAt?: string;
    expiresAt?: string;
    autoGradedAt?: string;
    gradedAt?: string;
    metadata: Record<string, unknown>;
  } | null;
  answers: Array<{
    attemptId: string;
    assessmentId: string;
    questionBankItemId: string;
    sortOrder: number;
    answerPayload: Record<string, unknown>;
    answeredAt?: string;
    isFinal: boolean;
  }>;
}>>
```

### 9B.3. `saveAssessmentAnswer()`

```ts
saveAssessmentAnswer(input: {
  studentId: string;
  attemptId: string;
  assessmentId: string;
  questionBankItemId: string;
  sortOrder: number;
  answerPayload: Record<string, unknown>;
  isFinal?: boolean;
}): Promise<ServiceResult<{
  attemptId: string;
  assessmentId: string;
  questionBankItemId: string;
  sortOrder: number;
  answerPayload: Record<string, unknown>;
  answeredAt?: string;
  isFinal: boolean;
}>>
```

### 9B.4. `submitAssessmentAttempt()`

```ts
submitAssessmentAttempt(input: {
  assessmentId: string;
  attemptId: string;
  studentId: string;
}): Promise<ServiceResult<{
  attemptId: string;
  submissionId: string;
  submissionStatus: 'submitted' | 'late' | 'missing' | 'ignored';
  rawScore: number;
  maxScore: number;
  normalizedScore?: number;
  pendingManualReview: boolean;
}>>
```

### 9B.5. `finalizeAssessmentSubmission()`

```ts
finalizeAssessmentSubmission(input: {
  attemptId: string;
  questionBankItemId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher';
  autoScore?: number;
  manualScore?: number;
  finalScore?: number;
  feedback?: string;
}): Promise<ServiceResult<{
  attemptId: string;
  questionBankItemId: string;
  rawScore: number;
  maxScore: number;
  normalizedScore?: number;
  pendingManualReview: boolean;
}>>
```

Mục đích:

- Giang vien cham tay cau tu luan va he thong dong bo lai tong diem cuoi cung vao:
  - `submissions`
  - `course_assessment_results`

Quy tắc:

- Chi `teacher`, `moderator`, `admin` duoc su dung.
- Hien tai chi ho tro cham tay cho cau `essay`.
- `finalScore` khong duoc vuot qua so diem snapshot cua cau hoi.
- Sau moi lan cham, service recompute tong diem cua attempt.
- Neu van con cau tu luan chua co `finalScore`, attempt giu `submitted`; neu da cham xong tat ca thi chuyen sang `graded`.

### 9B.6. `listAssessmentAttemptsForGrading()`

```ts
listAssessmentAttemptsForGrading(input: {
  assessmentId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
}): Promise<ServiceResult<Array<{
  attempt: {
    id: string;
    assessmentId: string;
    studentId: string;
    attemptNumber: number;
    status: 'in_progress' | 'submitted' | 'auto_graded' | 'graded' | 'abandoned' | 'expired';
    startedAt: string;
    submittedAt?: string;
    expiresAt?: string;
    autoGradedAt?: string;
    gradedAt?: string;
    metadata: Record<string, unknown>;
  };
  studentId: string;
  studentFullName: string;
  studentEmail?: string;
  studentCode?: string;
  studentIdentifier: string;
  answers: Array<{
    attemptId: string;
    assessmentId: string;
    questionBankItemId: string;
    sortOrder: number;
    answerPayload: Record<string, unknown>;
    answeredAt?: string;
    isFinal: boolean;
  }>;
  scores: Array<{
    attemptId: string;
    questionBankItemId: string;
    autoScore?: number;
    manualScore?: number;
    finalScore?: number;
    graderId?: string;
    feedback?: string;
    gradedAt?: string;
  }>;
}>>>
```

Mục đích:

- Cung cap hang cho cham bai tu luan cho trang ket qua assessment noi bo.

### 9B.7. `getStudentAssessmentReview()`

```ts
getStudentAssessmentReview(input: {
  assessmentId: string;
  studentId: string;
}): Promise<ServiceResult<{
  attemptId: string;
  attemptNumber: number;
  status: 'in_progress' | 'submitted' | 'auto_graded' | 'graded' | 'abandoned' | 'expired';
  submittedAt?: string;
  gradedAt?: string;
  rawScore: number;
  maxScore: number;
  normalizedScore?: number;
  pendingManualReview: boolean;
  questions: Array<{
    questionBankItemId: string;
    sortOrder: number;
    prompt: string;
    questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    choices: string[];
    points: number;
    answerText?: string;
    finalScore?: number;
    feedback?: string;
    explanation?: string | null;
  }>;
}>>
```

Mục đích:

- Sinh vien xem ket qua ca nhan cua bai internal, gom diem hien tai/cuoi cung va feedback tu luan.

Quy tắc:

- Chi tra ket qua khi `showFeedbackAfterSubmit = true`.
- Dap an dung khong bi lo cho cau `essay`; voi cau objective chi hien thi explanation neu cau hinh cho phep.
- Neu van con cau tu luan chua cham, `pendingManualReview = true` de UI thong bao diem chua cuoi cung.

- Runtime hien da ho tro:
  - tao/resume attempt,
  - upsert dap an tung cau,
  - nop bai noi bo,
  - cham tu dong cau objective,
  - mirror ket qua sang `submissions` va `course_assessment_results` voi `source = 'internal'`.
- cham tay tu luan va dong bo lai tong diem cuoi cung.

---

## 10. `SubmissionService`

### 9.1. `importSubmissionsFromCsv()`

```ts
importSubmissionsFromCsv(input: {
  assessmentId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
  csvContent: string;
}): Promise<ServiceResult<ImportJobResult>>
```

Output:

```ts
type ImportJobResult = {
  importJobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: 'completed' | 'partial' | 'failed';
  errors: Array<{
    row: number;
    reason: string;
    email?: string;
    studentCode?: string;
    fullName?: string;
  }>;
};
```

Quy tắc:

- Chi `teacher`, `moderator`, `admin` duoc import.
- Idempotent theo `assessment_id + student_identifier + attempt_number`.
- Dòng lỗi khong lam hong toan bo import; ket qua tra ve danh sach `errors` theo tung dong.
- Import job duoc ghi vao bang `import_jobs` voi summary `successRows/errorRows/status`.
- Sau khi hoan tat import (completed/partial/failed), ghi `activity_logs` voi action `submission.import_csv.completed`.
- Sau khi import thanh cong, service dong bo bang tong hop `course_assessment_results` theo `courseId` cua assessment.

### 9.2. `upsertExternalSubmission()`

```ts
upsertExternalSubmission(input: {
  assessmentId: string;
  provider: 'google_form' | 'microsoft_form';
  sharedSecret: string;
  payload: unknown;
}): Promise<ServiceResult<{ submissionId: string; created: boolean; updated: boolean }>>
```

Mục đích: endpoint webhook/server-only cho Google/MS Form automation.

Quy tắc:

- Shared secret bat buoc hop le theo provider (`GOOGLE_FORM_WEBHOOK_SECRET` hoac `MICROSOFT_FORM_WEBHOOK_SECRET`).
- Payload duoc normalize boi integration adapter truoc khi upsert.
- Upsert idempotent uu tien theo `assessment_id + external_response_id`; fallback theo `assessment_id + student_identifier + attempt_number`.
- Sau khi upsert thanh cong, service cap nhat ban ghi tong hop `course_assessment_results`.

---

## 11. `DashboardService`

### 10.1. `getTeacherDashboard()`

```ts
getTeacherDashboard(input?: {
  courseId?: string;
  classId?: string;
}): Promise<ServiceResult<TeacherDashboard>>
```

Output chính:

```ts
type TeacherDashboard = {
  totalCourses: number;
  totalClasses: number;
  totalStudents: number;
  totalAssessments: number;
  completionRate: number;
  completionSeries: DashboardCompletionPoint[];
  recentActivities: DashboardActivityItem[];
  selectedCourseId?: string;
  selectedClassId?: string;
  courses: DashboardCourseOption[];
  classes: DashboardClassOption[];
  notifications: GlobalNotificationSummaryItem[];
};

type DashboardCourseOption = {
  id: string;
  code: string;
  title: string;
};

type DashboardClassOption = {
  id: string;
  classCode: string;
  title: string;
  courseId: string;
};

type DashboardCompletionPoint = {
  assessmentId: string;
  assessmentTitle: string;
  classId: string;
  completionRate: number;
  completedCount: number;
  expectedCount: number;
  averageScore: number;
};

type DashboardActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
  metadata?: unknown;
};

type GlobalNotificationSummaryItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  createdBy: string;
};
```

### 10.2. `getAssessmentResults()`

```ts
getAssessmentResults(input: {
  assessmentId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
  page?: number;
  pageSize?: number;
  status?: 'submitted' | 'late' | 'missing' | 'ignored';
}): Promise<ServiceResult<Paginated<SubmissionSummary>>>
```

Quy tắc:

- Chi `teacher`, `moderator`, `admin` duoc xem ket qua assessment.
- Truoc khi tra ve, service dong bo result lifecycle theo roster active cua lop:
  - chua co bai nop sau deadline -> `missing`
  - nop sau deadline -> `late`
  - ban ghi da duoc loai khoi thong ke thi giu `ignored`
- Read-model tra ve 1 dong ket qua cuoi cung cho moi sinh vien trong roster/bai kiem tra, co pagination va co the loc theo `status`.

---

## 12. `ExportService`

### 11.1. `exportAssessmentResults()`

```ts
exportAssessmentResults(input: {
  assessmentId: string;
  actorId: string;
  actorRole: 'admin' | 'moderator' | 'teacher' | 'student';
  format: 'csv' | 'xlsx';
  status?: 'submitted' | 'late' | 'missing' | 'ignored';
}): Promise<ServiceResult<ExportFileResult>>
```

Quy tắc:

- Chi `teacher`, `moderator`, `admin` duoc export ket qua.
- Export ton trong bo loc `status` giong read-model `getAssessmentResults()`.
- Export dua tren tap ket qua da duoc chuan hoa boi roster lifecycle, nen co day du `missing/late/ignored` theo danh sach sinh vien active.

Output:

```ts
type ExportFileResult = {
  fileName: string;
  contentType: string;
  content: Buffer;
};
```

Quy tắc:

- CSV export gom danh sach ket qua theo bo loc `status` (neu co).
- XLSX export gom 2 sheet: `summary` (overview, completion rate, score bands, status breakdown) va `raw` (du lieu chi tiet tung submission).
- Không export nếu actor không có quyền với assessment.

---

## 12A. `LibraryService`

### 12A.1. `getLibraryOverview()`

```ts
getLibraryOverview(): Promise<ServiceResult<LibraryOverview>>
```

Mục đích: trả về màn hình tổng hợp Thư viện cho `teacher`, `moderator`, `admin`, gồm tài liệu, mô phỏng đã gắn học phần và mô phỏng HTML upload đang nhìn thấy theo RLS hiện tại.

Quy tắc:

- UI không được nhận `storage_path` private.
- Tài liệu/mô phỏng `archived` không hiển thị trong danh sách mặc định.
- Liên kết lớp học phần đi qua `class_resource_links`: giảng viên/Mod/Admin thêm hoặc bớt tài nguyên theo từng lớp, không cần duyệt.
- Tài liệu hoặc mô phỏng HTML upload không chọn học phần được lưu vào thư viện cá nhân của người tải lên.
- Tài liệu hoặc mô phỏng HTML upload có chọn học phần được ghi `review_status = 'pending_review'`; Mod/Admin duyệt thì tài nguyên mới vào Thư viện dùng chung của học phần.
- Mô phỏng HTML đã `approved` được gắn vào học phần; thao tác gắn tạo/cập nhật một dòng `simulations` với `config.source = 'html_upload'`.
- Sinh viên mở mô phỏng HTML bằng route signed URL `/api/library/simulation-uploads/[uploadId]/open`, mở tab mới, không nhận storage path.
- Tài liệu, mô phỏng native và mô phỏng HTML đều có `category_id` và `tags`; UI nhập tags bằng dấu `;`.
- Mod/Admin quản lý danh mục Thư viện; giảng viên chỉ chọn danh mục khi upload và lọc/tìm theo danh mục hoặc tag.
- Ẩn tài nguyên cần Mod/Admin duyệt; xóa tài nguyên chỉ Admin được duyệt.
- Đánh giá file `_Mo_phong_VL6.html` trả về như một review tích hợp, không nhúng raw HTML vào runtime.

Output chính:

```ts
type LibraryOverview = {
  categories: LibraryCategoryItem[];
  materials: LibraryMaterialItem[];
  simulations: LibrarySimulationItem[];
  simulationUploads: LibrarySimulationUploadItem[];
  personalLibrary?: {
    quotaMb: number;
    usedBytes: number;
    remainingBytes: number;
  };
  changeRequests: LibraryChangeRequestItem[];
  pendingWorkflow: {
    uploadPolicy: string;
    linkPolicy: string;
    deletePolicy: string;
  };
  vl6IntegrationReview: {
    fileName: string;
    verdict: 'integratable_with_refactor' | 'not_recommended_as_raw_embed';
    summary: string;
    risks: string[];
    recommendedSteps: string[];
  };
};
```

### 12A.2. Upload và duyệt mô phỏng HTML

```ts
createSimulationUploadIntent(input): Promise<ServiceResult<SimulationUploadIntent>>
registerSimulationUpload(input): Promise<ServiceResult<LibrarySimulationUploadItem>>
reviewSimulationUpload(input): Promise<ServiceResult<LibrarySimulationUploadItem>>
linkSimulationUploadToCourse(input): Promise<ServiceResult<LibrarySimulationItem>>
requestNativeSimulationIntegration(input): Promise<ServiceResult<LibrarySimulationUploadItem>>
getSimulationUploadOpenUrl(input): Promise<ServiceResult<string>>
```

Quy tắc:

- V1 chỉ nhận file `.html`/`text/html`, tối đa 10 MB, lưu trong bucket private `simulation-packages`.
- `reviewSimulationUpload` chỉ cho `moderator` và `admin`.
- `linkSimulationUploadToCourse` chỉ chạy khi upload đã `approved` và actor có quyền quản lý học phần.
- `registerSimulationUpload` nhận `courseId` tùy chọn, `categoryId` tùy chọn và `tags` đã parse từ chuỗi phân cách bằng dấu `;`.
- Nếu `courseId` rỗng, upload thuộc thư viện cá nhân và bị ràng buộc quota mặc định 50 MB của giảng viên.
- Nếu `courseId` có giá trị và actor là `teacher`, upload chuyển sang `pending_review` và giữ `requested_course_id` để tự gắn học phần khi được duyệt.
- `getSimulationUploadOpenUrl` chỉ trả signed URL ngắn hạn nếu upload đã `approved` và actor là uploader/Mod/Admin hoặc nhìn thấy simulation đã published qua RLS.
- `requestNativeSimulationIntegration` chỉ đánh dấu nhu cầu chuyển thành widget native; developer vẫn phải refactor thủ công sang `simulations/widgets`.

### 12A.3. Danh mục Thư viện

```ts
upsertLibraryCategory(input): Promise<ServiceResult<LibraryCategoryItem>>
archiveLibraryCategory(input): Promise<ServiceResult<LibraryCategoryItem>>
```

Quy tắc:

- Chỉ `moderator` và `admin` được tạo, sửa hoặc lưu trữ danh mục.
- Danh mục dùng `status = archived` thay vì hard-delete để tài nguyên cũ không mất tham chiếu.
- `teacher`, `moderator`, `admin` được đọc danh mục active để upload và lọc tài nguyên.

### 12A.4. Yêu cầu ẩn/xóa tài nguyên Thư viện

```ts
createLibraryArchiveRequest(input): Promise<ServiceResult<LibraryChangeRequestItem>>
reviewLibraryArchiveRequest(input): Promise<ServiceResult<LibraryChangeRequestItem>>
```

Quy tắc:

- `teacher`, `moderator`, `admin` có thể tạo yêu cầu ẩn hoặc xóa tài liệu/mô phỏng mà họ đang nhìn thấy theo RLS.
- Một tài nguyên chỉ có một yêu cầu `pending_review` cho cùng action.
- `moderator` và `admin` được duyệt/từ chối yêu cầu ẩn.
- Chỉ `admin` được duyệt yêu cầu xóa.
- Khi duyệt `approved` với action `archive`, hệ thống đổi `materials.status` hoặc `simulations.status` sang `archived`.
- Khi duyệt `approved` với action `delete`, hệ thống xóa metadata tài nguyên; material storage object được gỡ trước nếu có thể.

---

## 12B. `GlobalNotificationService`

### 12B.1. `listGlobalNotifications()`

```ts
listGlobalNotifications(input: {
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator' | 'teacher'>;
  page?: number;
  pageSize?: number;
}): Promise<ServiceResult<Paginated<GlobalNotificationSummaryItem>>>
```

Mục đích: trả dữ liệu khối “Thông báo” chung ở dashboard của `admin`, `moderator`, `teacher`.

### 12B.2. `publishGlobalNotification()`

```ts
publishGlobalNotification(input: {
  actorId: string;
  actorRole: Extract<UserRole, 'admin' | 'moderator'>;
  title: string;
  message: string;
}): Promise<ServiceResult<{ notificationId: string }>>
```

Quy tắc:

- `admin` và `moderator` được gửi thông báo.
- `teacher` chỉ có quyền đọc.
- Thông báo mới phải hiển thị được trên dashboard của cả ba nhóm vai trò ngay sau khi publish.

---

## 13. Integration provider contract

### 12.1. `ExternalFormAdapter`

```ts
interface ExternalFormAdapter {
  provider: 'google_form' | 'microsoft_form';

  validateFormUrl(url: string): ServiceResult<{
    normalizedUrl: string;
    externalFormId?: string;
    embedMode: 'iframe' | 'new_tab';
  }>;

  normalizeSubmissionPayload(payload: unknown): ServiceResult<NormalizedSubmission>;
}
```

### 12.2. `NormalizedSubmission`

```ts
type NormalizedSubmission = {
  externalResponseId?: string;
  studentCode?: string;
  studentEmail?: string;
  studentName?: string;
  rawScore?: number;
  maxScore?: number;
  submittedAt?: string;
  rawPayload?: unknown;
};
```

---

## 14. API routes dự kiến

| Method | Route | Mục đích | Auth |
|---|---|---|---|
| `POST` | `/api/webhooks/google-form` | Nhận kết quả Google Form từ Apps Script/automation | Shared secret |
| `POST` | `/api/webhooks/microsoft-form` | Nhận kết quả MS Form từ Power Automate | Shared secret |
| `GET` | `/api/assessments/:assessmentId/results/export` | Tra ve file export assessment (csv/xlsx) | Supabase Auth |
| `POST` | `/api/imports/submissions` | Import CSV kết quả | Supabase Auth |
| `GET` | `/api/enrollment/options` | Danh sách học phần/lớp active cho màn hình đăng ký | Public read |
| `POST` | `/api/enrollment/requests` | Sinh viên gửi yêu cầu đăng ký học phần/lớp | Supabase Auth |
| `POST` | `/api/enrollment/requests/:id/review` | Giảng viên duyệt một yêu cầu đăng ký thuộc lớp mình phụ trách | Supabase Auth |
| `POST` | `/api/enrollment/requests/review-batch` | Giảng viên duyệt hàng loạt yêu cầu đăng ký thuộc lớp mình phụ trách | Supabase Auth |
| `POST` | `/api/access/students/:id/approve` | Duyệt kích hoạt tài khoản sinh viên | Supabase Auth |
| `POST` | `/api/access/students/:id/renew` | Gia hạn truy cập tài khoản sinh viên | Supabase Auth |
| `POST` | `/api/admin/users` | Admin tạo tài khoản giảng viên hoặc moderator | Supabase Auth |
| `GET` | `/api/notifications/global` | Lấy danh sách thông báo chung cho dashboard | Supabase Auth |
| `POST` | `/api/notifications/global` | Admin/Mod gửi thông báo chung | Supabase Auth |

---

## 15. `AccessControlService`

### 15.1. `checkScopedPermission()`

```ts
checkScopedPermission(input: {
  actorId: string;
  actorRole: UserRole;
  resourceType: 'course' | 'class';
  resourceId: string;
  permission: string;
}): Promise<ServiceResult<{ allowed: boolean; reason?: string }>>
```

Mục đích: chuẩn hóa kiểm tra quyền theo scope cho moderator/delegated access.

---

## 16. `StudentProfileService`

### 16.1. `getStudentProfileOverview()`

```ts
getStudentProfileOverview(input: {
  studentId: string;
  actorId: string;
  actorRole: UserRole;
}): Promise<ServiceResult<{
  personalInfo: {
    fullName: string;
    studentCode?: string;
    classLabel?: string;
    groupLabel?: string;
  };
  access: {
    accessStatus: AccessStatus;
    accessExpiresAt?: string;
  };
  summary: {
    totalAssessments: number;
    completedAssessments: number;
    averageScore?: number;
    weeklyActiveCount?: number;
    monthlyActiveCount?: number;
    totalAccessMinutes?: number;
  };
  courseBreakdown: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    averageScore?: number;
    completedAssessments: number;
  }>;
  badges: Array<{
    badgeCode: string;
    badgeTitle: string;
    earnedAt?: string;
    source: 'system' | 'manual';
  }>;
}>>
```

Mục đích: profile sinh viên nhẹ, thống nhất giữa dữ liệu cá nhân, thống kê chung và kết quả theo học phần.

---

## 17. Contract change policy

Khi đổi contract, AI Agent phải:

1. Cập nhật file này.
2. Cập nhật service implementation.
3. Cập nhật validator/schema liên quan.
4. Cập nhật test.
5. Cập nhật `ROADMAP.md` nếu task thuộc phase/sprint.
6. Báo cáo rõ breaking change nếu có.

---

## 18. Trạng thái hiện tại của contract

- Contract hiện đã đồng bộ với các luồng đang dùng trong website: User management, course/class/material/library/simulation, dashboard, assessment external và result import/export.
- Contract cũng đã chuẩn hóa sẵn phần internal assessment runtime, attempt lifecycle, grading và student review để các phase sau có thể triển khai mà không phá external flow.
- Các contract gần đây tập trung thêm vào dữ liệu tiếng Việt, import/export kết quả theo `student code`, và hardening performance/refresh ở các màn teacher.
