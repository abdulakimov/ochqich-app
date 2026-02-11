# Ochiqich Monorepo

Ochiqich loyihasi uchun monorepo tuzilmasi:

- `apps/api` — Node.js + TypeScript + Express + Prisma
- `apps/dashboard` — Next.js + TypeScript
- `apps/mobile` — Flutter
- `packages/shared` — umumiy types, zod schema va utils
- `packages/sdk-node` — integratorlar uchun Node SDK

## Strukturasi

```txt
apps/
  api/
  dashboard/
  mobile/
packages/
  shared/
  sdk-node/
```

## Talablar

- Node.js 20+
- npm 10+
- Docker (Postgres uchun)
- Flutter SDK (mobile uchun)

## Ishga tushirish

1. Root env faylni yarating:

```bash
cp .env.example .env
```

2. Postgresni ishga tushiring:

```bash
docker compose up -d postgres
```

3. Workspace dependencylarni o'rnating:

```bash
npm install
```

4. Prisma client generate qiling va migration yuboring:

```bash
npm run prisma:generate
npm run prisma:deploy
```

5. API ni ishga tushiring:

```bash
npm run dev:api
```

6. Dashboard ni alohida terminalda ishga tushiring:

```bash
npm run dev:dashboard
```

7. Flutter app:

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Muhim scriptlar

- `npm run dev:api`
- `npm run dev:dashboard`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
