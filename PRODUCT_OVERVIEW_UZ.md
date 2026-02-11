# Ochiqich loyihasi overview (qisqa)

## Asosiy maqsad
Ochiqich’ning asosiy maqsadi — foydalanuvchini doimiy ravishda o‘zgaradigan va eslab qolish qiyin bo‘lgan parollardan xalos qilib, kirishni **biometrika (Face ID/Touch ID)** va **PIN** orqali tasdiqlash modeliga o‘tkazish.

## Dasturchilar (integratorlar) qanday foydalanadi?
1. Platformada ro‘yxatdan o‘tadi.
2. API token oladi.
3. SDK/package’ni (web/mobile/back-end) loyihasiga o‘rnatadi.
4. Ochiqich orqali autentifikatsiya yoki ma’lumot olish (consent-based data sharing) oqimini yoqadi.
5. Kerakli atributlarni belgilaydi: masalan, F.I.Sh., telefon raqam, profil rasmi va boshqalar.

## Foydalanuvchi ma’lumotlari va consent
- Foydalanuvchi ilovadan birinchi marta foydalanganda profilini to‘ldiradi.
- Ushbu ma’lumotlar doimiy saqlanadi (maxfiylik va xavfsizlik siyosatlari bilan).
- Har bir saytga kirishda yoki ma’lumot so‘rovda foydalanuvchi:
  - provayderni tanlaydi,
  - QR yoki deep link orqali bog‘lanadi,
  - **faqat tasdiqlagan ma’lumotlarini** yuboradi.

## Qurilmalar boshqaruvi
- Bitta accountga maksimum 2 ta aktiv qurilma ruxsat etiladi.
- Yangi qurilmadan kirish kerak bo‘lsa, eski qurilmalardan birini **revoke** qilish orqali joy bo‘shatiladi.

## Audit va shaffoflik
Ilova ichida foydalanuvchi uchun tarix bo‘limi bo‘ladi:
- qaysi saytlarga kirgani,
- qachon kirgani,
- qaysi ma’lumotlar so‘ralgani/uzatilgani.

## Sessiya xavfsizligi
- Foydalanuvchi lokal password + biometrika o‘rnatadi.
- Har 42 soatda biometrika yoki PIN bilan qayta tasdiqlash talab qilinadi.

---

## Muhim savol: “1-marta dasturga kirish qanday bo‘ladi?”

Quyidagi onboarding oqimi tavsiya etiladi.

### 1) Account yaratish (initial trust bootstrap)
- Foydalanuvchi telefon raqam (OTP) yoki email+OTP orqali account yaratadi.
- Server `user_id` ochadi va qurilmaga vaqtinchalik ro‘yxatdan o‘tish sessiyasi beradi.

### 2) Qurilmani bog‘lash (device binding)
- Qurilma ichida secure enclave/keystore’da **device key pair** yaratiladi.
- Public key serverga yuboriladi, private key qurilmadan chiqmaydi.
- Shu nuqtadan keyin accountga kirish “qurilma imzosi” bilan bog‘lanadi.

### 3) Recovery faktorini birinchi kunda majburiy yoqish
Kamida bittasi majburiy:
- Recovery code (10–12 ta bir martalik kod),
- ishonchli ikkinchi qurilma,
- verified email/telefon OTP,
- ixtiyoriy: support-assisted KYC recovery.

### 4) Lokal himoya sozlash
- Foydalanuvchi PIN o‘rnatadi.
- Biometrika yoqiladi (agar qurilmada mavjud bo‘lsa).
- Ilova “quick unlock” uchun lokal credential’larni ishlatadi.

### 5) 2-qurilma limit qoidasi
- Birinchi kirish qurilmasi avtomatik “Primary device” bo‘ladi.
- Ikkinchi qurilma qo‘shilganda ikkalasi aktiv yuradi.
- Uchinchi qurilmada kirishda: foydalanuvchiga revoke tanlovi ko‘rsatiladi.

## Telefon almashtirganda kirish (amaliy scenariy)
1. Yangi telefonда ilovani o‘rnatadi.
2. “Existing account” ni tanlaydi.
3. OTP + recovery faktordan biri bilan identity tasdiqlanadi.
4. Agar 2 qurilma limiti to‘lgan bo‘lsa, eski qurilmadan birini revoke qiladi.
5. Yangi telefon uchun yangi device key pair ro‘yxatdan o‘tadi.
6. PIN/biometrika qayta sozlanadi.

## Nima uchun bu model yaxshi?
- Parolga qaramlik kamayadi.
- Phishing riski kamayadi (imzo + consent flow).
- Qurilma yo‘qolsa ham revoke va recovery orqali accountni qayta tiklash mumkin.
- Audit trail foydalanuvchiga to‘liq ko‘rinadi.
