# Ochiqich Auth Core

Express + Prisma asosidagi auth core:

- OTP flow (`/v1/auth/register`, `/v1/auth/verify-otp`)
- Device binding (`/v1/devices/register`, max 2 ta active device)
- Ed25519 challenge login (`/v1/auth/challenge`, `/v1/auth/confirm`)
- JWT + refresh rotation (`/v1/auth/refresh`)
- Device revoke (`/v1/devices/:id/revoke`)
- Audit log (`AuditLog` jadvaliga yoziladi)
- In-memory rate limiting (`/v1/auth/*`, `/v1/recovery/*`, `/v1/provider/*`)
- Structured JSON logging (pino uslubidagi) + security headers
- Health checks: `/health/live`, `/health/ready`, `/health`

## Tez start (Docker)

```bash
docker compose up --build
```

Servislar:

- API: `http://localhost:3000`
- Postgres: `localhost:5432`

## Curl test ssenariy

### 0) Ed25519 key pair yaratish

```bash
openssl genpkey -algorithm Ed25519 -out /tmp/ed25519-private.pem
openssl pkey -in /tmp/ed25519-private.pem -pubout -out /tmp/ed25519-public.pem
PUBLIC_KEY="$(cat /tmp/ed25519-public.pem)"
```

### 1) OTP start

```bash
PHONE="+998901234567"
curl -s -X POST http://localhost:3000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" | tee /tmp/otp-start.json

OTP_ID="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/otp-start.json","utf8"));process.stdout.write(j.otpId)')"
OTP_CODE="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/otp-start.json","utf8"));process.stdout.write(j.otpCode)')"
```

### 2) OTP verify

```bash
curl -s -X POST http://localhost:3000/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d "{\"otpId\":\"$OTP_ID\",\"phone\":\"$PHONE\",\"otpCode\":\"$OTP_CODE\"}" | tee /tmp/otp-verify.json

REGISTRATION_TOKEN="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/otp-verify.json","utf8"));process.stdout.write(j.registrationToken)')"
```

### 3) Device register

```bash
curl -s -X POST http://localhost:3000/v1/devices/register \
  -H "Authorization: Bearer $REGISTRATION_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"publicKey\":\"$PUBLIC_KEY\",\"fingerprint\":\"iphone-15-pro-max\",\"deviceName\":\"My iPhone\"}" | tee /tmp/device.json

DEVICE_ID="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/device.json","utf8"));process.stdout.write(j.deviceId)')"
```

### 4) Challenge olish

```bash
curl -s -X POST http://localhost:3000/v1/auth/challenge \
  -H 'Content-Type: application/json' \
  -d "{\"deviceId\":\"$DEVICE_ID\"}" | tee /tmp/challenge.json

CHALLENGE_ID="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/challenge.json","utf8"));process.stdout.write(j.challengeId)')"
NONCE="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/challenge.json","utf8"));process.stdout.write(j.nonce)')"
```

### 5) Nonce imzolash va confirm

```bash
printf '%s' "$NONCE" > /tmp/nonce.txt
openssl pkeyutl -sign -inkey /tmp/ed25519-private.pem -rawin -in /tmp/nonce.txt -out /tmp/sign.bin
SIGNATURE="$(base64 -w0 /tmp/sign.bin)"

curl -s -X POST http://localhost:3000/v1/auth/confirm \
  -H 'Content-Type: application/json' \
  -d "{\"challengeId\":\"$CHALLENGE_ID\",\"signature\":\"$SIGNATURE\"}" | tee /tmp/confirm.json

ACCESS_TOKEN="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/confirm.json","utf8"));process.stdout.write(j.accessToken)')"
REFRESH_TOKEN="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("/tmp/confirm.json","utf8"));process.stdout.write(j.refreshToken)')"
```

### 6) Refresh

```bash
curl -s -X POST http://localhost:3000/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

### 7) Device revoke

```bash
curl -s -X POST http://localhost:3000/v1/devices/$DEVICE_ID/revoke \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Muhim eslatmalar

- Refresh token DBda faqat SHA-256 hash ko'rinishida saqlanadi.
- Challenge nonce TTL: 60s.
- OTP TTL: 300s.
- Bitta user uchun ACTIVE device limiti: 2 ta (transaction + serializable isolation).


## Production hardening

- Multi-stage Docker image (`Dockerfile`)
- CI pipeline (`.github/workflows/ci.yml`) with lint/test/build
- Threat model + security checklist: `docs/security-checklist.md`
