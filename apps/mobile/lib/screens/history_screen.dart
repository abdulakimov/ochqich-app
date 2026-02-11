import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../app/app_scope.dart';
import '../models/models.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Audit History'),
        actions: [
          IconButton(
            onPressed: () => context.go('/devices'),
            icon: const Icon(Icons.devices),
          ),
        ],
      ),
      body: FutureBuilder<List<AuditEvent>>(
        future: scope.historyService.getAuditHistory(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final events = snapshot.data!;
          return ListView.builder(
            itemCount: events.length,
            itemBuilder: (_, index) {
              final event = events[index];
              return ListTile(
                title: Text(event.title),
                subtitle: Text(event.description),
                trailing: Text(event.createdAt.toIso8601String()),
              );
            },
          );
        },
      ),
    );
  }
}
