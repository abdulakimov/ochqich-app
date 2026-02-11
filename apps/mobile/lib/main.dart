import 'package:flutter/material.dart';

import 'app/app_controller.dart';
import 'app/app_router.dart';
import 'app/app_scope.dart';
import 'services/services.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = StorageService();
  final keypairService = KeypairService();
  final authService = AuthService(
    storageService: storageService,
    keypairService: keypairService,
  );
  final deepLinkService = DeepLinkService();
  final appController = AppController(
    storageService: storageService,
    authService: authService,
    deepLinkService: deepLinkService,
  );

  await appController.init();

  runApp(
    OchiqichApp(
      appController: appController,
      storageService: storageService,
      authService: authService,
      keypairService: keypairService,
      deepLinkService: deepLinkService,
    ),
  );
}

class OchiqichApp extends StatelessWidget {
  const OchiqichApp({
    super.key,
    required this.appController,
    required this.storageService,
    required this.authService,
    required this.keypairService,
    required this.deepLinkService,
  });

  final AppController appController;
  final StorageService storageService;
  final AuthService authService;
  final KeypairService keypairService;
  final DeepLinkService deepLinkService;

  @override
  Widget build(BuildContext context) {
    final biometricService = BiometricService();
    final deviceService = DeviceService();
    final historyService = HistoryService();
    final consentService = ConsentService();
    return AppScope(
      appController: appController,
      storageService: storageService,
      authService: authService,
      biometricService: biometricService,
      keypairService: keypairService,
      deviceService: deviceService,
      historyService: historyService,
      consentService: consentService,
      deepLinkService: deepLinkService,
      child: MaterialApp.router(
        title: 'Ochiqich',
        theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.teal),
        routerConfig: buildRouter(appController),
      ),
    );
  }
}
