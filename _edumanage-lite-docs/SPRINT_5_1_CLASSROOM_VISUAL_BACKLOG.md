# SPRINT 5.1 - Classroom Visual Redesign Backlog

Tai lieu nay la backlog chi tiet de AI Agent trien khai classroom visual layout theo _Giao_dien_lop_hoc.md, khong pha vo boundary va contract hien tai.

## 1. Scope va out-of-scope

In-scope:

- Classroom detail page cho teacher/student (route rieng).
- Visual classroom layout: bang den, man chieu, tu tai lieu, ban giang vien, khu ban sinh vien.
- Auto-seat deterministic theo fullName.
- Class announcements read/write.
- Private message composer theo class scope.
- Material list theo class-course context.
- Simulation list theo class-course context.

Out-of-scope cho Sprint 5.1:

- Drag-drop seat customization luu xuong DB.
- Presence realtime toan dien va socket chat realtime.
- Native quiz engine.

## 2. Backlog chi tiet

### BL-5.1-01: Route va shell UI classroom

- Tao route server page cho teacher:
  - app/(teacher)/classes/[classId]/room/page.tsx
- Tao route server page cho student:
  - app/(student)/my-classes/[classId]/room/page.tsx
- Tao component UI chung:
  - components/classroom/classroom-layout.tsx
  - components/classroom/classroom-seat-grid.tsx
  - components/classroom/classroom-seat-card.tsx
  - components/classroom/classroom-board-panel.tsx
  - components/classroom/classroom-material-cabinet.tsx
  - components/classroom/classroom-projector-panel.tsx
  - components/classroom/classroom-teacher-desk.tsx

Acceptance:

- Co loading/error/empty state cho tung panel.
- Responsive desktop/mobile.

### BL-5.1-02: Service/Repository classroom layout

- Tao type:
  - lib/types/classroom.ts
- Tao validator:
  - lib/validators/classroom-validator.ts
- Tao repository:
  - lib/repositories/classroom-repository.ts
- Tao service:
  - lib/services/classroom-service.ts

Chuc nang toi thieu:

- getClassroomLayout(classId, actor)
- listClassAnnouncements(classId, actor, page, pageSize)
- createClassAnnouncement(classId, actor, title, content)
- listClassroomMaterials(classId, actor)
- listClassroomSimulations(classId, actor)

Acceptance:

- Tat ca service tra ve ServiceResult.
- Khong throw raw error ra UI.

### BL-5.1-03: Thuat toan auto-seat

- Input: class members active.
- Sort: fullName asc (trim + lowercase).
- Fill: left->right, top->down.
- Viewport default: 4 columns x 5 rows.
- Seat card 2 khung:
  - tren: Ten - Ho
  - duoi: MSSV

Cong thuc goi y:

- seatOrder = index + 1
- row = floor(index / 4) + 1
- column = (index % 4) + 1

Acceptance:

- Deterministic: cung input -> cung vi tri.
- Tranh random layout.

### BL-5.1-04: Class announcements panel

- Teacher/moderator/admin co form tao thong bao.
- Student xem danh sach announcements published.
- Hien badge thong bao moi + tooltip thong bao moi nhat.

File-level:

- app/(teacher)/classes/[classId]/room/actions.ts
- app/(student)/my-classes/[classId]/room/page.tsx
- lib/services/classroom-service.ts
- lib/repositories/classroom-repository.ts

### BL-5.1-05: Teacher desk + private message composer

- Hien thong tin lien he giang vien.
- Teacher click ban SV mo quick composer.
- Student click ban giang vien mo lien he/quick composer.

File-level:

- components/classroom/classroom-teacher-desk.tsx
- components/classroom/classroom-seat-card.tsx
- lib/services/message-service.ts
- lib/repositories/message-repository.ts
- lib/validators/message-validator.ts

### BL-5.1-06: Material cabinet panel

- Hien materials theo context course cua class.
- Khong tra storage path private.

File-level:

- components/classroom/classroom-material-cabinet.tsx
- lib/services/classroom-service.ts
- lib/repositories/classroom-repository.ts

### BL-5.1-07: Projector panel

- Hien danh sach simulation theo context class-course.
- Neu chua co simulation registry thi hien empty state ro rang.

File-level:

- components/classroom/classroom-projector-panel.tsx
- lib/services/classroom-service.ts
- simulations/registry.ts

### BL-5.1-08: Navigation integration

- Tu trang list class -> them nut "Vao phong hoc".
- Tu trang my-classes -> them nut "Vao phong hoc".

File-level:

- app/(teacher)/classes/class-management-client.tsx
- app/(student)/my-classes/page.tsx

### BL-5.1-09: Test coverage

Unit:

- tests/unit/classroom-service.test.ts
- tests/unit/message-service.test.ts

Integration:

- tests/integration/classroom-layout-permission.test.ts

E2E:

- tests/e2e/classroom-visual-layout.spec.ts
- tests/e2e/classroom-announcement.spec.ts

## 3. Checklist implementation theo file-level

### 3.1. Docs

- [ ] docs/classroom-visual-design.md
- [ ] docs/ROADMAP.md
- [ ] docs/SERVICE_CONTRACT.md
- [ ] docs/DATABASE_SCHEMA.md

### 3.2. App routes

- [ ] app/(teacher)/classes/[classId]/room/page.tsx
- [ ] app/(teacher)/classes/[classId]/room/actions.ts
- [ ] app/(student)/my-classes/[classId]/room/page.tsx

### 3.3. Components

- [ ] components/classroom/classroom-layout.tsx
- [ ] components/classroom/classroom-seat-grid.tsx
- [ ] components/classroom/classroom-seat-card.tsx
- [ ] components/classroom/classroom-board-panel.tsx
- [ ] components/classroom/classroom-teacher-desk.tsx
- [ ] components/classroom/classroom-material-cabinet.tsx
- [ ] components/classroom/classroom-projector-panel.tsx

### 3.4. Service / Repository / Validator / Type

- [ ] lib/types/classroom.ts
- [ ] lib/types/message.ts
- [ ] lib/validators/classroom-validator.ts
- [ ] lib/validators/message-validator.ts
- [ ] lib/repositories/classroom-repository.ts
- [ ] lib/repositories/message-repository.ts
- [ ] lib/services/classroom-service.ts
- [ ] lib/services/message-service.ts

### 3.5. Existing pages integration

- [ ] app/(teacher)/classes/class-management-client.tsx
- [ ] app/(student)/my-classes/page.tsx

### 3.6. Tests

- [ ] tests/unit/classroom-service.test.ts
- [ ] tests/unit/message-service.test.ts
- [ ] tests/integration/classroom-layout-permission.test.ts
- [ ] tests/e2e/classroom-visual-layout.spec.ts
- [ ] tests/e2e/classroom-announcement.spec.ts

## 4. Gate chot Sprint 5.1

- [ ] Classroom visual route mo duoc cho teacher/student dung quyen.
- [ ] Auto-seat dung thu tu deterministic.
- [ ] Moi seat card co 2 khung thong tin dung quy cach.
- [ ] Announcement panel hoat dong dung quyen theo class scope.
- [ ] Material/projector panel hien thi dung context.
- [ ] Unit + integration + E2E test pass.
- [ ] Khong vi pham boundary UI/Service/Repository.
- [ ] Khong lo secret va khong bypass RLS.
