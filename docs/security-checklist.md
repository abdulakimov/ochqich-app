# Production Security Checklist & Threat Model

## Threat model (MVP)

### Assets
- User auth sessions (access/refresh tokens)
- Registered device keys (Ed25519 public keys)
- OTP and recovery mechanisms
- Provider API keys and consent payloads
- Audit logs

### Trust boundaries
- Public internet -> `/v1/auth/*`, `/v1/recovery/*`
- Provider-to-server communication -> `/v1/provider/*`
- API -> Postgres
- API -> provider webhook callback URLs

### Primary threats and controls
1. **Credential stuffing / brute force on auth + recovery endpoints**
   - Control: endpoint rate limiting per IP on auth/recovery/provider groups.
2. **Token leakage in logs**
   - Control: structured JSON logging with explicit avoidance of secret payload logging.
3. **Unauthorized provider use**
   - Control: API key verification + provider-scoped resource access.
4. **Availability loss from unhealthy DB**
   - Control: dedicated liveness/readiness health endpoints.
5. **Container image bloat / inconsistent runtime**
   - Control: Docker multi-stage build with separate build/runtime layers.
6. **Supply-chain regression**
   - Control: CI gates for lint, tests, and build.

## Release checklist

- [ ] `JWT_SECRET` is unique and rotated per environment.
- [ ] Production DB credentials use least privilege and are rotated.
- [ ] `NODE_ENV=production` in runtime containers.
- [ ] Rate-limit defaults are tuned per traffic profile.
- [ ] TLS is terminated at ingress/load balancer.
- [ ] Health checks are wired into orchestrator probes.
- [ ] CI is required for merge (lint/test/build all pass).
- [ ] Audit log retention policy is defined and enforced.
- [ ] Provider API key lifecycle (create/revoke/rotate) is documented.
- [ ] Incident runbook includes token revocation + forced re-auth flow.
