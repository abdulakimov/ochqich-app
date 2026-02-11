class ConsentRequest {
  const ConsentRequest({
    required this.requestId,
    required this.appName,
    required this.scope,
    required this.challenge,
  });

  final String requestId;
  final String appName;
  final String scope;
  final String challenge;

  factory ConsentRequest.fromUri(Uri uri) {
    return ConsentRequest(
      requestId: uri.queryParameters['requestId'] ?? 'unknown',
      appName: uri.queryParameters['app'] ?? 'Unknown App',
      scope: uri.queryParameters['scope'] ?? 'basic',
      challenge: uri.queryParameters['challenge'] ?? '',
    );
  }
}
