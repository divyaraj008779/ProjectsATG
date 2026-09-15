/**
 * Speech Engine: Speech-to-Text, Audio Waveform Visualizer, and Text-to-Speech
 */

class SpeechToTextController {
  constructor(options = {}) {
    this.recognition = null;
    this.isRecording = false;
    this.currentTranscript = "";
    this.onTranscriptUpdate = options.onTranscriptUpdate || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});
    this.language = options.language || "en-US";
    this.initRecognition();
  }

  isSupported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.getLangCode(this.language);

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.onStateChange(true);
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart + " ";
        } else {
          interimTranscript += transcriptPart;
        }
      }

      this.onTranscriptUpdate(finalTranscript, interimTranscript);
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      let userMsg = "An error occurred with speech recognition.";
      if (event.error === 'not-allowed') {
        userMsg = "Microphone access was denied. Please allow microphone permissions in your browser or type your answer.";
      } else if (event.error === 'no-speech') {
        userMsg = "No speech detected. Please speak clearly or try again.";
      } else if (event.error === 'audio-capture') {
        userMsg = "No microphone hardware detected. Please ensure a microphone is connected.";
      } else if (event.error === 'network') {
        userMsg = "Network error during speech recognition.";
      }
      this.onError(userMsg, event.error);
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      this.onStateChange(false);
    };
  }

  setLanguage(lang) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = this.getLangCode(lang);
    }
  }

  getLangCode(lang) {
    if (lang === "Hindi") return "hi-IN";
    if (lang === "Hinglish") return "hi-IN";
    return "en-US";
  }

  start() {
    if (!this.recognition) {
      this.onError("Speech Recognition is not available in your browser. You can type your answers directly!", "not-supported");
      return false;
    }
    if (this.isRecording) return true;

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      this.onError("Unable to start microphone recording: " + err.message, "start-failed");
      return false;
    }
  }

  stop() {
    if (this.recognition && this.isRecording) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.error("Error stopping recognition:", err);
      }
    }
    this.isRecording = false;
    this.onStateChange(false);
  }
}


class AudioWaveformVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.animFrameId = null;
    this.isActive = false;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      this.isActive = true;
      this.draw();
    } catch (err) {
      console.warn("Waveform visualizer failed to access audio stream:", err);
      // Fallback animated mock wave if mic hardware is virtual
      this.startSimulatedWave();
    }
  }

  draw() {
    if (!this.isActive || !this.ctx) return;

    this.animFrameId = requestAnimationFrame(() => this.draw());
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.8;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;
      const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#06b6d4');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  }

  startSimulatedWave() {
    if (!this.ctx) return;
    this.isActive = true;
    let step = 0;
    const renderSim = () => {
      if (!this.isActive) return;
      this.animFrameId = requestAnimationFrame(renderSim);
      step += 0.15;
      const width = this.canvas.width;
      const height = this.canvas.height;
      this.ctx.clearRect(0, 0, width, height);

      this.ctx.fillStyle = '#6366f1';
      for (let i = 0; i < 20; i++) {
        const barHeight = (Math.sin(step + i * 0.5) * 0.5 + 0.5) * height * 0.8 + 4;
        this.ctx.fillRect(i * (width / 20), height - barHeight, (width / 20) - 3, barHeight);
      }
    };
    renderSim();
  }

  stop() {
    this.isActive = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch (e) {}
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}


class TextToSpeechController {
  constructor(options = {}) {
    this.synth = window.speechSynthesis || null;
    this.currentUtterance = null;
    this.speed = 1.0;
    this.onStart = options.onStart || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.onError = options.onError || (() => {});
  }

  isSupported() {
    return 'speechSynthesis' in window;
  }

  setSpeed(speedVal) {
    this.speed = parseFloat(speedVal) || 1.0;
    if (this.currentUtterance && this.synth.speaking) {
      // If currently speaking, stop and replay with new speed
    }
  }

  speak(text) {
    if (!this.isSupported() || !this.synth) {
      this.onError("Text to speech is not supported in this browser.");
      return;
    }

    this.stop(); // Stop any pending speech

    if (!text || !text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.speed;
    utterance.pitch = 1.0;

    // Pick best available voice
    const voices = this.synth.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))) ||
                         voices.find(v => v.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      this.onStart();
    };

    utterance.onend = () => {
      this.onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      this.onEnd();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.onEnd();
  }
}

window.SpeechToTextController = SpeechToTextController;
window.AudioWaveformVisualizer = AudioWaveformVisualizer;
window.TextToSpeechController = TextToSpeechController;
