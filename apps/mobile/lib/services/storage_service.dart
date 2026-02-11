import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/models.dart';

class StorageService {
  StorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'auth.access_token';
  static const _refreshTokenKey = 'auth.refresh_token';
  static const _expiresAtKey = 'auth.expires_at';
  static const _pinKey = 'auth.pin';

  Future<void> saveTokens(AuthTokens tokens) async {
    await _storage.write(key: _accessTokenKey, value: tokens.accessToken);
    await _storage.write(key: _refreshTokenKey, value: tokens.refreshToken);
    await _storage.write(
      key: _expiresAtKey,
      value: tokens.expiresAt.toIso8601String(),
    );
  }

  Future<AuthTokens?> readTokens() async {
    final accessToken = await _storage.read(key: _accessTokenKey);
    final refreshToken = await _storage.read(key: _refreshTokenKey);
    final expiresAtRaw = await _storage.read(key: _expiresAtKey);

    if (accessToken == null || refreshToken == null || expiresAtRaw == null) {
      return null;
    }

    return AuthTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: DateTime.parse(expiresAtRaw),
    );
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _expiresAtKey);
  }

  Future<void> savePin(String pin) async {
    await _storage.write(key: _pinKey, value: base64Encode(utf8.encode(pin)));
  }

  Future<bool> verifyPin(String pin) async {
    final raw = await _storage.read(key: _pinKey);
    if (raw == null) {
      return false;
    }
    final savedPin = utf8.decode(base64Decode(raw));
    return pin == savedPin;
  }
}
