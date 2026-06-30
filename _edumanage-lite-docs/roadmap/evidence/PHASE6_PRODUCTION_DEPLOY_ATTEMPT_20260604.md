# Phase 6 Production Deploy Attempt (2026-06-04)

Tai lieu nay ghi lai ket qua tiep tuc production rollout that theo `roadmap/ops/PRODUCTION_READINESS_CHECKLIST.md`.

## 1. Tom tat ket qua

Trang thai hien tai: NO-GO cho production cutover.

Ly do: app build/test gate noi bo pass, nhung cloud deploy dang bi chan boi thieu/khong kha dung tooling va production credential:

- Thu muc chua phai Git repository, khong co commit/tag release de chot release artifact.
- Chua co `.vercel/project.json`, project chua link Vercel trong workspace.
- Khong co Vercel CLI trong project/global.
- `npx vercel --version` tu thu muc tam fail khi fetch `https://registry.npmjs.org/vercel`.
- Khong co Supabase CLI trong project/global.
- `.env.production.local` chua ton tai.
- `.env.local` dang tro local cho Supabase URL, DB URL va APP URL, khong phai production.
- Docker client co cai dat nhung khong ket noi duoc Docker engine trong phien nay, nen integration/E2E voi Supabase local bi chan.

## 2. Pre-deploy gate da chay

### 2.1. Lint

Trang thai: PASS.

Command thuc thi truc tiep binary local do `pnpm` khong co trong PATH:

```bash
node_modules\.bin\eslint.CMD .
```

Ket qua: khong co loi ESLint.

### 2.2. Unit tests

Trang thai: PASS.

Command:

```bash
node_modules\.bin\vitest.CMD run
```

Ket qua:

```text
Test Files  15 passed (15)
Tests       72 passed (72)
```

### 2.3. Security scan

Trang thai: PASS.

Command:

```bash
node scripts\security\check-no-secrets-in-tracked-files.mjs
```

Ket qua:

```text
[security:scan] OK: no local secret signatures detected in source files.
```

### 2.4. Production build

Trang thai: PASS.

Command:

```bash
node_modules\.bin\next.CMD build
```

Ket qua:

- Next.js 16.2.6 build thanh cong.
- TypeScript pass.
- Static generation pass voi 19 pages.

Ghi chu: build su dung `.env.local`, hien dang la env local, khong phai production env.

## 3. Gate bi chan

### 3.1. Package manager

`pnpm` khong co trong PATH trong phien nay.

`npm run lint` bi chan boi `devEngines` vi project yeu cau package manager `pnpm`.

Corepack khong kich hoat duoc vi package manager spec hien tai la `pnpm@^11.4.0`, trong khi Corepack yeu cau mot semver version cu the.

### 3.2. Integration/E2E

Docker co cai dat, nhung `docker info` fail:

```text
permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine
```

Do do chua the chay Supabase local stack va integration/E2E smoke matrix.

### 3.3. Vercel deploy

Khong co `.vercel` project link.

Khong co Vercel CLI san trong workspace/global.

Thu `npx vercel --version` tu thu muc tam bi fail khi fetch registry:

```text
request to https://registry.npmjs.org/vercel failed
```

Do do chua the deploy Vercel production tu workspace hien tai.

### 3.4. Supabase Cloud migration

Khong co Supabase CLI san trong workspace/global.

Chua co production Supabase env an toan trong `.env.production.local`.

Do do chua the chay migration production hoac verify migration status tu workspace hien tai.

## 4. Dieu kien toi thieu de tiep tuc GO

1. Cai/kich hoat `pnpm` dung version cho project, hoac sua `package.json` de Corepack dung mot version cu the.
2. Dang nhap/link Vercel project hoac cung cap Vercel token qua kenh secret an toan.
3. Dang nhap Supabase CLI hoac cung cap Supabase access token/project ref qua kenh secret an toan.
4. Tao production env vars tren Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL`
   - `APP_URL`
   - `GOOGLE_FORM_WEBHOOK_SECRET`
   - `MICROSOFT_FORM_WEBHOOK_SECRET`
5. Cap quyen Docker engine hoac chay integration/E2E tren mot staging/cloud env co Supabase reachable.
6. Chot release artifact: Git repo/commit/tag hoac mot co che release artifact tuong duong.

## 5. Go/No-Go

Khuyen nghi: NO-GO.

Co the chuyen GO sau khi:

- Cloud tooling va credential san sang.
- Migration staging + production duoc verify.
- P0 smoke matrix pass tren production.
- Rollback drill cloud co evidence.
