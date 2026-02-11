import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:uni_links/uni_links.dart';

class DeepLinkService {
  StreamSubscription<Object?>? _subscription;

  Future<Uri?> getInitialUriSafe() async {
    try {
      return await getInitialUri();
    } on FormatException catch (error, stackTrace) {
      debugPrint('Ignoring malformed initial deep link: $error');
      debugPrintStack(stackTrace: stackTrace);
      return null;
    } on PlatformException catch (error, stackTrace) {
      debugPrint('Ignoring unsupported initial deep link: ${error.message ?? error.code}');
      debugPrintStack(stackTrace: stackTrace);
      return null;
    }
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
