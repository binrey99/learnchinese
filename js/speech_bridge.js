/**
 * LuLu Chinese Speech Bridge
 * Bridges Web Speech Recognition to Flutter Native Android SpeechRecognizer
 */
(function() {
  if (window._flutterSpeechPolyfillLoaded) return;
  window._flutterSpeechPolyfillLoaded = true;

  // Polyfill SpeechRecognition
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

  // Nhận tín hiệu sóng âm thanh thời gian thực từ Micro điện thoại
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

  // Nhận kết quả từ nhận diện giọng nói Native Android
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

  // Cung cấp SpeechRecognition nếu WebView hoặc trình duyệt chưa có sẵn
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    window.SpeechRecognition = CustomSpeechRecognition;
    window.webkitSpeechRecognition = CustomSpeechRecognition;
  } else if (window.FlutterSpeechChannel) {
    // Trên ứng dụng di động Flutter, ưu tiên native SpeechRecognizer
    window.SpeechRecognition = CustomSpeechRecognition;
    window.webkitSpeechRecognition = CustomSpeechRecognition;
  }

  // Tự động bỏ qua request getUserMedia nếu đang chạy trong app
  if (navigator.mediaDevices) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      if (window.FlutterSpeechChannel || window._flutterSpeechPolyfillLoaded) {
        return new MediaStream();
      }
      if (origGetUserMedia) return origGetUserMedia(constraints);
      return new MediaStream();
    };
  }

  console.log('[LuLu Chinese] Speech Bridge initialized successfully.');
})();

