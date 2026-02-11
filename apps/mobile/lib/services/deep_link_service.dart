import 'dart:async';

import 'package:uni_links/uni_links.dart';

class DeepLinkService {
  StreamSubscription<Object?>? _subscription;

  Future<Uri?> getInitialUriSafe() async {
    return getInitialUri();
  }

  void listen(void Function(Uri uri) onUri) {
    _subscription = uriLinkStream.listen((Uri? uri) {
      if (uri != null) {
        onUri(uri);
      }
    });
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
  }
}
