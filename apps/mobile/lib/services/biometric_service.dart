import 'package:local_auth/local_auth.dart';

class BiometricService {
  BiometricService({LocalAuthentication? auth})
      : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  Future<bool> canUseBiometrics() async {
    final available = await _auth.canCheckBiometrics;
    final supported = await _auth.isDeviceSupported();
    return available && supported;
  }

  Future<bool> authenticate() {
    return _auth.authenticate(
      localizedReason: 'Tasdiqlash uchun biometrik kirishni bajaring',
      options: const AuthenticationOptions(
        biometricOnly: true,
        stickyAuth: true,
      ),
    );
  }
}
