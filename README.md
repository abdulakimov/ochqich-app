# Ochqich Auth Core MVP

Node.js + TypeScript + Express + Prisma + PostgreSQL asosidagi auth core MVP.

## Features

- Device registry (`max 2 ACTIVE` devices per user, otherwise `409`).
- Challenge-response login (Ed25519 signature verification).
- JWT access token (`15m`) va refresh token (DB'da faqat hash).
- Refresh token rotation.
- Device revoke + o'sha device sessiyalarini revoke qilish.
- Audit loglar: `LOGIN_OK`, `LOGIN_FAIL`, `DEVICE_ADD`, `DEVICE_REVOKE`.
- Request validation (`zod`).

## Stack

- Node.js 20
- TypeScript
- Express
- Prisma
- PostgreSQL
- Docker Compose

## Quick start

1. Env fayl yarating:

```bash
cp .env.example .env
```

2. Docker orqali PostgreSQL'ni ishga tushiring:

```bash
docker compose up -d postgres
```

3. App image'ini clean build qiling (Prisma generate + build container ichida bajariladi):

```bash
docker compose build --no-cache app
```

4. Migratsiyani app container ichida deploy qiling:

```bash
docker compose run --rm app npx prisma migrate deploy
```

5. App + postgres'ni birga ishga tushiring:

```bash
docker compose up --build
```

6. Local development uchun:

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

## API endpoints

- `POST /v1/devices/register`
- `POST /v1/auth/challenge`
- `POST /v1/auth/confirm`
- `POST /v1/auth/refresh`
- `POST /v1/devices/:id/revoke`

## Minimal curl flow

### 1) Device register

```bash
curl -X POST http://localhost:3000/v1/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone":"+998901112233",
    "fingerprint":"ios-17-iphone15-pro-abc123",
    "publicKey":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAu...\n-----END PUBLIC KEY-----",
    "deviceName":"iPhone 15 Pro"
  }'
```

### 2) Challenge olish

```bash
curl -X POST http://localhost:3000/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"<DEVICE_ID>"}'
```

Javobdan `nonce` va `challengeId`ni oling.

### 3) Clientda nonce sign qilish (Ed25519, demo)

```bash
# private key misoli (test uchun)
openssl genpkey -algorithm Ed25519 -out ed25519-private.pem
openssl pkey -in ed25519-private.pem -pubout -out ed25519-public.pem

# nonce qiymatini sign qilish
printf '%s' '<NONCE>' | openssl pkeyutl -sign -inkey ed25519-private.pem -rawin | base64
```

### 4) Confirm login

```bash
curl -X POST http://localhost:3000/v1/auth/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId":"<CHALLENGE_ID>",
    "signature":"<BASE64_SIGNATURE>"
  }'
```

### 5) Refresh

```bash
curl -X POST http://localhost:3000/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

### 6) Device revoke

```bash
curl -X POST http://localhost:3000/v1/devices/<DEVICE_ID>/revoke \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Prisma models

- `User`
- `Device`
- `AuthChallenge`
- `Session`
- `AuditLog`

## Notes

- Access token payload: `sub(userId)`, `deviceId`, `sessionId`.
- `AuthChallenge` TTL: `60s`.
- Refresh token hash: SHA-256.
