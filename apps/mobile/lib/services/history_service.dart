import '../models/models.dart';

class HistoryService {
  Future<List<AuditEvent>> getAuditHistory() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return <AuditEvent>[
      AuditEvent(
        id: '1',
        title: 'OTP Verified',
        description: 'Akkount OTP orqali tasdiqlandi',
        createdAt: DateTime.now().subtract(const Duration(minutes: 50)),
      ),
      AuditEvent(
        id: '2',
        title: 'Device Linked',
        description: 'Ed25519 public key serverga yuborildi',
        createdAt: DateTime.now().subtract(const Duration(minutes: 40)),
      ),
      AuditEvent(
        id: '3',
        title: 'Consent Approved',
        description: 'Third-party ilova uchun ruxsat berildi',
        createdAt: DateTime.now().subtract(const Duration(minutes: 15)),
      ),
    ];
  }
}
