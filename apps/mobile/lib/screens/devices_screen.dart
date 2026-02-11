import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../app/app_scope.dart';
import '../models/models.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  late Future<List<DeviceSession>> _devicesFuture;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _devicesFuture = AppScope.of(context).deviceService.listDevices();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Devices'),
        actions: [
          IconButton(
            onPressed: () => context.go('/history'),
            icon: const Icon(Icons.history),
          ),
        ],
      ),
      body: FutureBuilder<List<DeviceSession>>(
        future: _devicesFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final devices = snapshot.data!;
          return ListView.builder(
            itemCount: devices.length,
            itemBuilder: (_, index) {
              final device = devices[index];
              return ListTile(
                title: Text(device.name),
                subtitle: Text('${device.platform} · ${device.lastSeenAt}'),
                trailing: device.current
                    ? const Chip(label: Text('Current'))
                    : TextButton(
                        onPressed: () async {
                          await scope.deviceService.revokeDevice(device.id);
                          setState(() {
                            _devicesFuture = scope.deviceService.listDevices();
                          });
                        },
                        child: const Text('Revoke'),
                      ),
              );
            },
          );
        },
      ),
    );
  }
}
