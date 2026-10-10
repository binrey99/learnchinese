import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:mime/mime.dart';

class LocalWebServer {
  static final LocalWebServer _instance = LocalWebServer._internal();
  factory LocalWebServer() => _instance;
  LocalWebServer._internal();

  HttpServer? _server;
  String? _serverUrl;

  String? get serverUrl => _serverUrl;

  Future<String> start() async {
    if (_serverUrl != null && _server != null) {
      return _serverUrl!;
    }

    try {
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      _serverUrl = 'http://localhost:${_server!.port}/index.html';

      _server!.listen((HttpRequest request) async {
        try {
          String path = request.uri.path;
          if (path.isEmpty || path == '/') {
            path = '/index.html';
          }

          // Strip leading slash
          if (path.startsWith('/')) {
            path = path.substring(1);
          }

          final assetPath = 'assets/www/$path';

          ByteData data;
          try {
            data = await rootBundle.load(assetPath);
          } catch (_) {
            // Not found
            request.response.statusCode = HttpStatus.notFound;
            request.response.write('File not found: $path');
            await request.response.close();
            return;
          }

          final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);

          // Determine Content-Type
          String contentType = 'application/octet-stream';
          final lower = path.toLowerCase();
          if (lower.endsWith('.html')) {
            contentType = 'text/html; charset=utf-8';
          } else if (lower.endsWith('.js') || lower.endsWith('.mjs')) {
            contentType = 'application/javascript; charset=utf-8';
          } else if (lower.endsWith('.css')) {
            contentType = 'text/css; charset=utf-8';
          } else if (lower.endsWith('.json')) {
            contentType = 'application/json; charset=utf-8';
          } else if (lower.endsWith('.svg')) {
            contentType = 'image/svg+xml';
          } else if (lower.endsWith('.png')) {
            contentType = 'image/png';
          } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
          } else if (lower.endsWith('.mp4')) {
            contentType = 'video/mp4';
          } else if (lower.endsWith('.csv')) {
            contentType = 'text/csv; charset=utf-8';
          } else {
            contentType = lookupMimeType(path) ?? 'application/octet-stream';
          }

          request.response.headers.set('Content-Type', contentType);
          request.response.headers.set('Access-Control-Allow-Origin', '*');
          request.response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          request.response.headers.set('Accept-Ranges', 'bytes');
          request.response.headers.set('Permissions-Policy', 'microphone=*');

          request.response.statusCode = HttpStatus.ok;
          request.response.add(bytes);
          await request.response.close();
        } catch (e) {
          debugPrint('Error serving request: $e');
          try {
            request.response.statusCode = HttpStatus.internalServerError;
            await request.response.close();
          } catch (_) {}
        }
      });

      return _serverUrl!;
    } catch (e) {
      debugPrint('Failed to start local server: $e');
      rethrow;
    }
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    _serverUrl = null;
  }
}

