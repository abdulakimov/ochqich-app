import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../app/app_scope.dart';

class PinSetupScreen extends StatefulWidget {
  const PinSetupScreen({super.key});

  @override
  State<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<PinSetupScreen> {
  final _pinController = TextEditingController();
  bool _biometricEnabled = false;
  String? _message;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Setup PIN')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('4 xonali PIN o\'rnating:'),
            const SizedBox(height: 8),
            TextField(controller: _pinController, keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            SwitchListTile(
              value: _biometricEnabled,
              title: const Text('Biometrics yoqish'),
              onChanged: (value) async {
                if (!value) {
                  setState(() => _biometricEnabled = false);
                  return;
                }
                final canUse = await scope.biometricService.canUseBiometrics();
                if (!canUse) {
                  setState(() => _message = 'Qurilmada biometrika mavjud emas');
                  return;
                }
                final ok = await scope.biometricService.authenticate();
                setState(() {
                  _biometricEnabled = ok;
                  _message = ok ? 'Biometrika faollashtirildi' : 'Biometrika bekor qilindi';
                });
              },
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () async {
                await scope.storageService.savePin(_pinController.text.trim());
                if (!context.mounted) {
                  return;
                }
                context.go('/devices');
              },
              child: const Text('Continue'),
            ),
            if (_message != null) Text(_message!),
          ],
        ),
      ),
    );
  }
}
