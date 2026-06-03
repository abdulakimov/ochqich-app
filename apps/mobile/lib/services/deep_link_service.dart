import 'dart:async';
import 'package:app_links/app_links.dart';

class DeepLinkService {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;

  Future<Uri?> getInitialUriSafe() async {
    try {
      return await _appLinks.getInitialLink();
    } catch (_) {
      return null;
    }
  }

  void listen(void Function(Uri uri) onUri) {
    _subscription = _appLinks.uriLinkStream.listen((uri) {
      onUri(uri);
    });
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
  }
}
