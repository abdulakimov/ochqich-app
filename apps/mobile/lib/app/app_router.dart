import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../screens/consent_screen.dart';
import '../screens/devices_screen.dart';
import '../screens/history_screen.dart';
import '../screens/onboarding_screen.dart';
import '../screens/pin_setup_screen.dart';
import 'app_controller.dart';

GoRouter buildRouter(AppController controller) {
  return GoRouter(
    initialLocation: '/onboarding',
    refreshListenable: controller,
    redirect: (_, state) {
      final location = state.uri.path;
      final authRoutes = <String>{'/onboarding', '/pin-setup'};

      if (!controller.authenticated && !authRoutes.contains(location)) {
        return '/onboarding';
      }

      if (controller.authenticated && location == '/onboarding') {
        return '/pin-setup';
      }

      if (
          controller.authenticated &&
          controller.pendingConsent != null &&
          location != '/consent') {
        return '/consent';
      }

      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/pin-setup',
        builder: (context, state) => const PinSetupScreen(),
      ),
      GoRoute(
        path: '/devices',
        builder: (context, state) => const DevicesScreen(),
      ),
      GoRoute(
        path: '/history',
        builder: (context, state) => const HistoryScreen(),
      ),
      GoRoute(
        path: '/consent',
        builder: (context, state) => const ConsentScreen(),
      ),
    ],
  );
}
