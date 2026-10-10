import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import '../../services/local_web_server.dart';

class WebAppScreen extends StatefulWidget {
  const WebAppScreen({super.key});

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen> {
  WebViewController? _controller;
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isLoading = true;
  String? _error;

  static const String _speechPolyfillJs = '''
(function() {
  if (window._flutterSpeechPolyfillLoaded) return;
  window._flutterSpeechPolyfillLoaded = true;

  class CustomSpeechRecognition {
    constructor() {
      this.lang = 'zh-CN';
      this.continuous = false;
      this.interimResults = true;
      this.maxAlternatives = 10;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.onsoundstart = null;
      this.onspeechstart = null;
      this.onsoundend = null;
      this.onspeechend = null;
      this._isListening = false;
      this._soundDetected = false;
      CustomSpeechRecognition._currentInstance = this;
    }

    start() {
      CustomSpeechRecognition._currentInstance = this;
      this._isListening = true;
      this._soundDetected = false;
      if (this.onstart) {
        try { this.onstart(); } catch(e) { console.error(e); }
      }
      if (window.FlutterSpeechChannel) {
        window.FlutterSpeechChannel.postMessage(JSON.stringify({
          action: 'start',
          lang: this.lang || 'zh-CN'
        }));
      }
    }

    stop() {
      this._isListening = false;
      if (window.FlutterSpeechChannel) {
        window.FlutterSpeechChannel.postMessage(JSON.stringify({ action: 'stop' }));
      }
      if (this.onend) {
        try { this.onend(); } catch(e) { console.error(e); }
      }
    }

    abort() {
      this._isListening = false;
      if (window.FlutterSpeechChannel) {
        window.FlutterSpeechChannel.postMessage(JSON.stringify({ action: 'abort' }));
      }
      if (this.onend) {
        try { this.onend(); } catch(e) { console.error(e); }
      }
    }
  }

  CustomSpeechRecognition._dispatchSound = function(level) {
    const inst = CustomSpeechRecognition._currentInstance;
    if (!inst) return;
    if (!inst._soundDetected) {
      inst._soundDetected = true;
      if (inst.onsoundstart) {
        try { inst.onsoundstart({ level: level }); } catch(_) {}
      }
      if (inst.onspeechstart) {
        try { inst.onspeechstart({ level: level }); } catch(_) {}
      }
    }
  };

  CustomSpeechRecognition._dispatchResult = function(transcript, isFinal, alternates) {
    const inst = CustomSpeechRecognition._currentInstance;
    if (!inst) return;

    let candidateList = [];
    if (transcript && typeof transcript === 'string' && transcript.trim()) {
      candidateList.push(transcript.trim());
    }
    if (Array.isArray(alternates)) {
      alternates.forEach((alt) => {
        if (alt && typeof alt === 'string' && alt.trim() && !candidateList.includes(alt.trim())) {
          candidateList.push(alt.trim());
        }
      });
    }
    if (candidateList.length === 0) return;

    const resultsArray = candidateList.map((t, idx) => ({
      transcript: t,
      confidence: idx === 0 ? 0.95 : 0.8
    }));
    resultsArray.isFinal = isFinal;

    const event = {
      resultIndex: 0,
      results: [resultsArray]
    };

    if (inst.onresult) {
      try {
        inst.onresult(event);
      } catch(err) {
        console.error('[SpeechBridge] onresult error:', err);
      }
    }

    if (isFinal && !inst.continuous) {
      inst._isListening = false;
      if (inst.onend) {
        try { inst.onend(); } catch(_) {}
      }
    }
  };

  CustomSpeechRecognition._dispatchError = function(errorMsg) {
    const inst = CustomSpeechRecognition._currentInstance;
    if (inst && inst.onerror) {
      try { inst.onerror({ error: errorMsg }); } catch(_) {}
    }
  };

  CustomSpeechRecognition._dispatchEnd = function() {
    const inst = CustomSpeechRecognition._currentInstance;
    if (inst) {
      inst._isListening = false;
      if (inst.onend) {
        try { inst.onend(); } catch(_) {}
      }
    }
  };

  window.SpeechRecognition = CustomSpeechRecognition;
  window.webkitSpeechRecognition = CustomSpeechRecognition;
  console.log('[LuLu Chinese] Flutter Native SpeechRecognition Polyfill activated!');
})();
''';

  bool _speechInitialized = false;

  @override
  void initState() {
    super.initState();
    _startAppFlow();
  }

  Future<void> _startAppFlow() async {
    try {
      await Permission.microphone.request();
    } catch (e) {
      debugPrint('Permission request notice: $e');
    }
    await _initSpeech();
    await _initWebView();
  }

  Future<bool> _initSpeech() async {
    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          debugPrint('STT status: $status');
          if (status == 'done' || status == 'notListening') {
            _controller?.runJavaScript(
              'if (window.SpeechRecognition && window.SpeechRecognition._dispatchEnd) { window.SpeechRecognition._dispatchEnd(); }',
            );
          }
        },
        onError: (errorNotification) {
          debugPrint('STT error: ${errorNotification.errorMsg}');
          _controller?.runJavaScript(
            'if (window.SpeechRecognition && window.SpeechRecognition._dispatchError) { window.SpeechRecognition._dispatchError("${errorNotification.errorMsg}"); }',
          );
        },
        debugLogging: true,
      );
      _speechInitialized = available;
      return available;
    } catch (e) {
      debugPrint('STT init notice: $e');
      return false;
    }
  }

  void _handleSpeechMessage(String message) async {
    try {
      final Map<String, dynamic> data = jsonDecode(message);
      final action = data['action'];
      if (action == 'start') {
        final status = await Permission.microphone.request();
        if (!status.isGranted) {
          _controller?.runJavaScript(
            'if (window.SpeechRecognition && window.SpeechRecognition._dispatchError) { window.SpeechRecognition._dispatchError("not-allowed"); }',
          );
          return;
        }

        if (!_speechInitialized || !_speech.isAvailable) {
          final ok = await _initSpeech();
          if (!ok) {
            _controller?.runJavaScript(
              'if (window.SpeechRecognition && window.SpeechRecognition._dispatchError) { window.SpeechRecognition._dispatchError("no-speech"); }',
            );
            return;
          }
        }

        if (_speech.isListening) {
          await _speech.stop();
          await Future.delayed(const Duration(milliseconds: 100));
        }

        // Determine Chinese locale from available locales on device
        String selectedLocale = 'zh-CN';
        try {
          final systemLocales = await _speech.locales();
          if (systemLocales.isNotEmpty) {
            final match = systemLocales.firstWhere(
              (loc) =>
                  loc.localeId.toLowerCase().startsWith('zh') ||
                  loc.localeId.toLowerCase().startsWith('cmn'),
              orElse: () => systemLocales.firstWhere(
                (loc) =>
                    loc.name.toLowerCase().contains('chinese') ||
                    loc.name.toLowerCase().contains('mandarin'),
                orElse: () => systemLocales.first,
              ),
            );
            selectedLocale = match.localeId;
          }
        } catch (_) {}

        await _speech.listen(
          listenOptions: stt.SpeechListenOptions(
            localeId: selectedLocale,
            listenFor: const Duration(seconds: 20),
            pauseFor: const Duration(seconds: 4),
            partialResults: true,
            cancelOnError: false,
          ),
          onSoundLevelChange: (level) {
            _controller?.runJavaScript(
              'if (window.SpeechRecognition && window.SpeechRecognition._dispatchSound) { window.SpeechRecognition._dispatchSound($level); }',
            );
          },
          onResult: (result) {
            final words = result.recognizedWords
                .replaceAll('\\', '\\\\')
                .replaceAll('"', '\\"')
                .replaceAll('\n', ' ');
            final alternates = result.alternates
                .map((a) => a.recognizedWords
                    .replaceAll('\\', '\\\\')
                    .replaceAll('"', '\\"')
                    .replaceAll('\n', ' '))
                .toList();
            final alternatesJson = jsonEncode(alternates);
            final isFinal = result.finalResult;
            _controller?.runJavaScript(
              'if (window.SpeechRecognition && window.SpeechRecognition._dispatchResult) { window.SpeechRecognition._dispatchResult("$words", $isFinal, $alternatesJson); }',
            );
          },
        );
      } else if (action == 'stop') {
        if (_speech.isListening) {
          await _speech.stop();
        }
      } else if (action == 'abort') {
        if (_speech.isListening) {
          await _speech.cancel();
        }
      }
    } catch (e) {
      debugPrint('Handle speech message notice: $e');
      _controller?.runJavaScript(
        'if (window.SpeechRecognition && window.SpeechRecognition._dispatchError) { window.SpeechRecognition._dispatchError("${e.toString()}"); }',
      );
    }
  }

  Future<void> _hideChatWidget() async {
    try {
      await _controller?.runJavaScript('''
        (function() {
          try {
            const style = document.createElement('style');
            style.innerHTML = '.support-chat-widget-root, #supportChatWidgetRoot, .support-chat-launcher, .support-chat-window { display: none !important; visibility: hidden !important; pointer-events: none !important; }';
            document.head.appendChild(style);
            const el = document.querySelector('#supportChatWidgetRoot, .support-chat-widget-root');
            if (el) el.remove();
          } catch(e) {}
        })();
      ''');
    } catch (_) {}
  }

  Future<void> _injectSpeechPolyfill() async {
    try {
      await _controller?.runJavaScript(_speechPolyfillJs);
      await _hideChatWidget();
    } catch (e) {
      debugPrint('Inject polyfill notice: $e');
    }
  }

  Future<void> _initWebView() async {
    try {
      final serverUrl = await LocalWebServer().start();

      final controller = WebViewController(
        onPermissionRequest: (request) async {
          await Permission.microphone.request();
          await request.grant();
        },
      );

      controller
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFFFAFCFA))
        ..addJavaScriptChannel(
          'FlutterSpeechChannel',
          onMessageReceived: (message) => _handleSpeechMessage(message.message),
        )
        ..setNavigationDelegate(
          NavigationDelegate(
            onPageStarted: (_) async {
              if (mounted) setState(() => _isLoading = true);
              await _injectSpeechPolyfill();
              await _hideChatWidget();
            },
            onPageFinished: (_) async {
              await _injectSpeechPolyfill();
              await _hideChatWidget();
              if (mounted) setState(() => _isLoading = false);
            },
            onWebResourceError: (error) {
              debugPrint('Web resource notice: ${error.description}');
            },
          ),
        );

      if (controller.platform is AndroidWebViewController) {
        final androidController = controller.platform as AndroidWebViewController;
        androidController.setMediaPlaybackRequiresUserGesture(false);
      }

      await controller.loadRequest(Uri.parse(serverUrl));
      if (mounted) {
        setState(() {
          _controller = controller;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Lỗi khởi chạy ứng dụng: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (_controller != null && await _controller!.canGoBack()) {
          await _controller!.goBack();
        } else {
          if (context.mounted) {
            Navigator.of(context).maybePop();
          }
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFFAFCFA),
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              if (_error != null)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('⚠️', style: TextStyle(fontSize: 48)),
                        const SizedBox(height: 16),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 16, color: Colors.red),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _error = null;
                              _isLoading = true;
                            });
                            _initWebView();
                          },
                          child: const Text('Thử lại'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_controller != null)
                WebViewWidget(controller: _controller!)
              else
                const SizedBox.shrink(),
              if (_isLoading)
                Container(
                  color: const Color(0xFFFAFCFA),
                  child: const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 42,
                          height: 42,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: Color(0xFF10B981),
                          ),
                        ),
                        SizedBox(height: 16),
                        Text(
                          'Đang tải LuLu Chinese...',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
