import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class KeypairService {
  KeypairService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  final Ed25519 _algorithm = Ed25519();

  static const _privateKeyKey = 'device.private_key';
  static const _publicKeyKey = 'device.public_key';

  Future<String> getOrCreatePublicKey() async {
    final savedPublicKey = await _storage.read(key: _publicKeyKey);
    if (savedPublicKey != null) {
      return savedPublicKey;
    }

    final keyPair = await _algorithm.newKeyPair();
    final privateKeyBytes = await keyPair.extractPrivateKeyBytes();
    final publicKeyBytes = (await keyPair.extractPublicKey()).bytes;

    await _storage.write(
      key: _privateKeyKey,
      value: base64Encode(privateKeyBytes),
    );
    final publicKey = base64Encode(publicKeyBytes);
    await _storage.write(key: _publicKeyKey, value: publicKey);

    return publicKey;
  }

  Future<String> signChallenge(String challenge) async {
    final privateKeyRaw = await _storage.read(key: _privateKeyKey);
    if (privateKeyRaw == null) {
      throw StateError('Device keypair hali yaratilmagan');
    }

    final keyPair = SimpleKeyPairData(
      base64Decode(privateKeyRaw),
      type: KeyPairType.ed25519,
    );

    final signature = await _algorithm.sign(
      utf8.encode(challenge),
      keyPair: keyPair,
    );

    return base64Encode(signature.bytes);
  }
}
