# Ochiqich Mobile (Flutter MVP)

## Run

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Implemented MVP skeleton

- Onboarding: phone/email -> OTP verify
- PIN setup + biometric enable (`local_auth`)
- Devices list + revoke action
- Audit history screen
- Consent approve/deny screen for deeplink payload

## Services layer

- `StorageService`: secure token/PIN saqlash (`flutter_secure_storage`)
- `AuthService`: OTP, device register (`publicKey`), challenge sign/confirm, 403 revalidate handling
- `KeypairService`: Ed25519 keypair generation + challenge signing (private key export API yo'q)
- `DeepLinkService`: `uni_links` orqali initial/link stream handling
- `ConsentService`, `DeviceService`, `HistoryService`: screen-level business logic

## Routing

`go_router` orqali flow route'lari:
- `/onboarding`
- `/pin-setup`
- `/devices`
- `/history`
- `/consent`
