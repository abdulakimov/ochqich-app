import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../app/app_scope.dart';

class ConsentScreen extends StatelessWidget {
  const ConsentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final request = scope.appController.pendingConsent;

    return Scaffold(
      appBar: AppBar(title: const Text('Consent Request')),
      body: request == null
          ? const Center(child: Text('Faol consent so\'rovi yo\'q'))
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('App: ${request.appName}', style: Theme.of(context).textTheme.titleMedium),
                  Text('Scope: ${request.scope}'),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      ElevatedButton(
                        onPressed: () async {
                          final signature =
                              await scope.keypairService.signChallenge(request.challenge);
                          await scope.consentService.approve(request, signature: signature);
                          scope.appController.clearConsent();
                          if (!context.mounted) {
                            return;
                          }
                          context.go('/devices');
                        },
                        child: const Text('Approve'),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton(
                        onPressed: () async {
                          await scope.consentService.deny(request);
                          scope.appController.clearConsent();
                          if (!context.mounted) {
                            return;
                          }
                          context.go('/devices');
                        },
                        child: const Text('Deny'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}
