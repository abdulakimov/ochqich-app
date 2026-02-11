import 'dart:math';

import '../models/models.dart';
import 'keypair_service.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class AuthService {
  AuthService({
    required StorageService storageService,
    required KeypairService keypairService,
  })  : _storageService = storageService,
        _keypairService = keypairService;

  final StorageService _storageService;
  final KeypairService _keypairService;

  Future<void> requestOtp(String login) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    if (login.isEmpty) {
      throw ApiException(400, 'Phone/email bo\'sh bo\'lmasligi kerak');
    }
  }

  Future<AuthTokens> verifyOtp({
    required String login,
    required String otp,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    if (otp.length < 4) {
      throw ApiException(401, 'OTP xato');
    }

    final publicKey = await _keypairService.getOrCreatePublicKey();
    await registerDevice(publicKey: publicKey, login: login);

    final tokens = _issueTokens();
    await _storageService.saveTokens(tokens);
    return tokens;
  }

  Future<void> registerDevice({
    required String publicKey,
    required String login,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (publicKey.isEmpty || login.isEmpty) {
      throw ApiException(422, 'Device register uchun ma\'lumot yetarli emas');
    }
  }

  Future<void> loginChallengeFlow() async {
    final challenge = 'challenge-${DateTime.now().millisecondsSinceEpoch}';
    final signature = await _keypairService.signChallenge(challenge);
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (signature.isEmpty) {
      throw ApiException(401, 'Challenge sign xato');
    }
  }

  Future<void> withRevalidation(Future<void> Function() call) async {
    try {
      await call();
    } on ApiException catch (error) {
      if (error.statusCode == 403) {
        await revalidate();
        await call();
        return;
      }
      rethrow;
    }
  }

  Future<void> revalidate() async {
    final current = await _storageService.readTokens();
    if (current == null) {
      throw ApiException(401, 'Revalidate uchun token yo\'q');
    }
    await Future<void>.delayed(const Duration(milliseconds: 300));
    await _storageService.saveTokens(_issueTokens());
  }

  AuthTokens _issueTokens() {
    final random = Random();
    final now = DateTime.now();
    return AuthTokens(
      accessToken: 'at-${random.nextInt(999999)}',
      refreshToken: 'rt-${random.nextInt(999999)}',
      expiresAt: now.add(const Duration(minutes: 15)),
    );
  }
}
