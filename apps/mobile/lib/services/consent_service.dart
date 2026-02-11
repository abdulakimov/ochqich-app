import '../models/models.dart';

class ConsentService {
  Future<void> approve(ConsentRequest request, {required String signature}) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    if (signature.isEmpty) {
      throw StateError('Signature bo\'sh bo\'lishi mumkin emas');
    }
  }

  Future<void> deny(ConsentRequest request) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
}
