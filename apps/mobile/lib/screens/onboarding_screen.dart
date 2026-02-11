import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../app/app_scope.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _loginController = TextEditingController();
  final _otpController = TextEditingController();

  String? _error;
  bool _otpRequested = false;
  bool _loading = false;

  @override
  void dispose() {
    _loginController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Onboarding')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Phone yoki Email kiriting:'),
            const SizedBox(height: 8),
            TextField(controller: _loginController),
            const SizedBox(height: 12),
            if (_otpRequested) ...[
              const Text('OTP kiriting:'),
              const SizedBox(height: 8),
              TextField(controller: _otpController),
              const SizedBox(height: 12),
            ],
            ElevatedButton(
              onPressed: _loading
                  ? null
                  : () async {
                      setState(() {
                        _loading = true;
                        _error = null;
                      });
                      try {
                        if (!_otpRequested) {
                          await scope.authService.requestOtp(_loginController.text.trim());
                          setState(() => _otpRequested = true);
                        } else {
                          await scope.appController
                              .finishOtp(_loginController.text.trim(), _otpController.text.trim());
                          if (!mounted) {
                            return;
                          }
                          context.go('/pin-setup');
                        }
                      } catch (error) {
                        setState(() => _error = error.toString());
                      } finally {
                        setState(() => _loading = false);
                      }
                    },
              child: Text(_otpRequested ? 'Verify OTP' : 'Send OTP'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }
}
