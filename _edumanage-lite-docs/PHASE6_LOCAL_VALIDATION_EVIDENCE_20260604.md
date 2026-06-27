# Phase 6 Local Validation Evidence (2026-06-04)

Tai lieu nay ghi lai ket qua kiem tra local sau khi Docker/Supabase local stack va website local da duoc khoi chay.

## 1. Pham vi

Pham vi hien tai la local validation/staging-like smoke, chua phai deploy production host that.

Target local:

- App: `http://127.0.0.1:3000`
- Supabase API: `http://127.0.0.1:54321`

## 2. Ket qua gate local

### 2.1. App health

Trang thai: PASS.

Endpoint:

```text
GET http://127.0.0.1:3000/api/health
```

Ket qua:

```json
{"ok":true,"service":"lmp"}
```

### 2.2. Supabase local API

Trang thai: PASS.

Endpoint:

```text
GET http://127.0.0.1:54321/rest/v1/
```

Ket qua: PostgREST OpenAPI document tra ve duoc, gom cac bang/RPC chinh nhu `profiles`, `courses`, `classes`, `materials`, `assessments`, `submissions`, `approve_student_access`, `renew_student_access`.

Ghi chu: Docker CLI trong phien Codex van khong co quyen ket noi pipe `docker_engine`, nhung Supabase service da reachable qua HTTP do user da khoi chay local stack ben ngoai.

### 2.3. Integration tests

Trang thai: PASS.

Command chay truc tiep voi `.env.local` va `RUN_INTEGRATION_TESTS=true`:

```bash
node_modules\.bin\vitest.CMD run --config vitest.integration.config.ts
```

Ket qua:

```text
Test Files  4 passed (4)
Tests       7 passed (7)
```

### 2.4. Local admin bootstrap

Trang thai: PASS.

Command:

```bash
node scripts\admin\bootstrap-local-admin.mjs
```

Ket qua:

```text
LOCAL_ADMIN_READY
```

### 2.5. Local admin user-management/auth-profile

Trang thai: PASS.

Kiem tra tang User management dang nhap + ho so quyen cua local admin bang email noi bo cua alias local admin.

Ket qua da xac nhan:

```json
{
  "auth": "PASS",
  "profileRole": "admin",
  "profileStatus": "active",
  "accessStatus": "active",
  "email": "admin@local.test"
}
```

Ghi chu: UI login cho phep nhap alias `Admin`; server action map alias nay ve `admin@local.test`.

### 2.6. Route smoke

Trang thai: PASS.

Ket qua:

- `GET /login`: 200, co noi dung `Dang nhap`.
- `GET /admin` khi chua co session: 307 redirect ve `/login`.

## 3. E2E browser status

Trang thai: BLOCKED trong phien Codex.

Da thu chay:

```bash
node_modules\.bin\playwright.CMD test tests/e2e/admin-login.spec.ts
```

Ket qua: Playwright tim thay test, nhung khong khoi chay duoc Chromium do loi moi truong:

```text
browserType.launch: spawn EPERM
```

Do do, E2E browser automation chua the ghi PASS trong phien nay. User co the tiep tuc verify bang browser dang mo o `localhost:3000/login` voi tai khoan local admin.

## 4. Go/No-Go

Cho local validation: GO co dieu kien.

- App health pass.
- Supabase local API reachable.
- Integration tests pass.
- Local admin user-management/auth-profile pass.
- Route guard co ban pass.

Cho production host that: van NO-GO.

Ly do:

- Chua deploy len Vercel/host that.
- Chua co production env vars/cloud credential trong workspace.
- Chua chay migration/smoke tren Supabase Cloud.
- Chua co cloud rollback drill.
- E2E browser automation trong phien Codex bi chan boi `spawn EPERM`.
