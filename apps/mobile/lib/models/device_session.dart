class DeviceSession {
  const DeviceSession({
    required this.id,
    required this.name,
    required this.platform,
    required this.lastSeenAt,
    required this.current,
  });

  final String id;
  final String name;
  final String platform;
  final DateTime lastSeenAt;
  final bool current;
}
