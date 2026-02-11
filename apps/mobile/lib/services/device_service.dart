import '../models/models.dart';

class DeviceService {
  final List<DeviceSession> _devices = <DeviceSession>[
    DeviceSession(
      id: 'current',
      name: 'My Phone',
      platform: 'Android',
      lastSeenAt: DateTime.now(),
      current: true,
    ),
    DeviceSession(
      id: 'web-01',
      name: 'Chrome on Mac',
      platform: 'Web',
      lastSeenAt: DateTime.now().subtract(const Duration(hours: 3)),
      current: false,
    ),
  ];

  Future<List<DeviceSession>> listDevices() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return _devices.toList();
  }

  Future<void> revokeDevice(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _devices.removeWhere((device) => device.id == id && !device.current);
  }
}
