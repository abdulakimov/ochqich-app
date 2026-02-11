import 'package:flutter/material.dart';

import '../services/services.dart';
import 'app_controller.dart';

class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required super.child,
    required this.appController,
    required this.storageService,
    required this.authService,
    required this.biometricService,
    required this.keypairService,
    required this.deviceService,
    required this.historyService,
    required this.consentService,
    required this.deepLinkService,
  });

  final AppController appController;
  final StorageService storageService;
  final AuthService authService;
  final BiometricService biometricService;
  final KeypairService keypairService;
  final DeviceService deviceService;
  final HistoryService historyService;
  final ConsentService consentService;
  final DeepLinkService deepLinkService;

  static AppScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    if (scope == null) {
      throw StateError('AppScope topilmadi');
    }
    return scope;
  }

  @override
  bool updateShouldNotify(covariant AppScope oldWidget) => false;
}
