import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/services.dart';

class AppController extends ChangeNotifier {
  AppController({
    required StorageService storageService,
    required AuthService authService,
    required DeepLinkService deepLinkService,
  })  : _storageService = storageService,
        _authService = authService,
        _deepLinkService = deepLinkService;

  final StorageService _storageService;
  final AuthService _authService;
  final DeepLinkService _deepLinkService;

  bool initialized = false;
  bool authenticated = false;
  ConsentRequest? pendingConsent;

  Future<void> init() async {
    if (initialized) {
      return;
    }

    final tokens = await _storageService.readTokens();
    authenticated = tokens != null && !tokens.isExpired;

    final initialUri = await _deepLinkService.getInitialUriSafe();
    if (initialUri != null) {
      _handleUri(initialUri);
    }

    _deepLinkService.listen(_handleUri);
    initialized = true;
    notifyListeners();
  }

  Future<void> finishOtp(String login, String otp) async {
    await _authService.verifyOtp(login: login, otp: otp);
    await _authService.loginChallengeFlow();
    authenticated = true;
    notifyListeners();
  }

  Future<void> onApiCall(Future<void> Function() call) async {
    await _authService.withRevalidation(call);
  }

  void clearConsent() {
    pendingConsent = null;
    notifyListeners();
  }

  void _handleUri(Uri uri) {
    if (uri.path.contains('consent')) {
      pendingConsent = ConsentRequest.fromUri(uri);
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _deepLinkService.dispose();
    super.dispose();
  }
}
