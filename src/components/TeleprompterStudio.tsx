"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TELEPROMPTER_SETTINGS_KEY = "creative-circle:teleprompter-settings:v1";

type TeleprompterSettings = {
  speed: number;
  fontSize: number;
  eyeLinePosition: number;
  facingMode: "user" | "environment";
  mirror: boolean;
  showGuide: boolean;
  showControls: boolean;
  countdownSeconds: number;
  remoteBinding: string;
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex?: number;
  results: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function keyboardBinding(event: KeyboardEvent) {
  return `${event.code || "Unidentified"}::${event.key || "Unidentified"}`;
}

function describeKeyboardBinding(binding: string) {
  const [code, key] = binding.split("::");
  return key && key !== "Unidentified" ? key : code || "Remote button";
}

function isSupportedRemoteKey(event: KeyboardEvent) {
  const supportedKeys = new Set([
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "MediaPlayPause",
    "AudioVolumeUp",
    "AudioVolumeDown",
    "VolumeUp",
    "VolumeDown",
  ]);
  return supportedKeys.has(event.key) || supportedKeys.has(event.code);
}

const DEFAULT_SCRIPT = `Paste your script here.

The teleprompter will scroll over your live camera preview so you can keep your eyes close to the lens while you read.

Adjust the speed and text size until the pacing feels natural, then press Start.`;

export type TeleprompterRecording = {
  blob: Blob;
  mimeType: string;
  url: string;
  filename: string;
};

type TeleprompterStudioProps = {
  initialScript?: string;
  contextLabel?: string;
  captureMode?: boolean;
  sequenceCaptureMode?: boolean;
  canDeletePreviousTake?: boolean;
  onDeletePreviousTake?: () => void;
  onScriptChange?: (script: string) => void;
  onRecordingChange?: (recording: TeleprompterRecording | null) => void;
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function recordingExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

function recordingFilename(mimeType: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `creative-circle-${stamp}.${recordingExtension(mimeType)}`;
}

export function TeleprompterStudio({
  initialScript = DEFAULT_SCRIPT,
  contextLabel,
  captureMode = false,
  sequenceCaptureMode = false,
  canDeletePreviousTake = false,
  onDeletePreviousTake,
  onScriptChange,
  onRecordingChange,
}: TeleprompterStudioProps = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingCanvasStreamRef = useRef<MediaStream | null>(null);
  const recordingFrameRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);
  const countdownTimerRef = useRef<number | null>(null);
  const countdownSecondsRef = useRef(3);
  const playingRef = useRef(false);
  const scriptRef = useRef(initialScript);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceRestartTimerRef = useRef<number | null>(null);
  const remoteLearnTimerRef = useRef<number | null>(null);

  const [script, setScript] = useState(initialScript);
  const [speed, setSpeed] = useState(38);
  const [fontSize, setFontSize] = useState(44);
  const [eyeLinePosition, setEyeLinePosition] = useState(42);
  const [playing, setPlaying] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [mirror, setMirror] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [fullscreenInstallHint, setFullscreenInstallHint] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [voiceControlAvailable, setVoiceControlAvailable] = useState(false);
  const [voiceControlEnabled, setVoiceControlEnabled] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [remoteBinding, setRemoteBinding] = useState("");
  const [remoteLearning, setRemoteLearning] = useState(false);
  const [remoteLastInput, setRemoteLastInput] = useState("");
  const [remoteDiagnostic, setRemoteDiagnostic] = useState("");

  const fullscreenActive = pseudoFullscreen || nativeFullscreen;

  function clearRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStartedAtRef.current = null;
  }

  function stopMic() {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }

  function stopRecordingVideoPump() {
    if (recordingFrameRef.current !== null) {
      cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }
    recordingCanvasStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingCanvasStreamRef.current = null;
    recordingCanvasRef.current = null;
  }

  async function createStableRecordingVideoStream(cameraStream: MediaStream) {
    const video = videoRef.current;
    if (!video) return new MediaStream(cameraStream.getVideoTracks());

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener("loadeddata", finish);
          video.removeEventListener("canplay", finish);
          resolve();
        };
        video.addEventListener("loadeddata", finish, { once: true });
        video.addEventListener("canplay", finish, { once: true });
        window.setTimeout(finish, 800);
      });
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return new MediaStream(cameraStream.getVideoTracks());

    const canvas = document.createElement("canvas");
    const longestEdge = 1280;
    const scale = Math.min(1, longestEdge / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(2, Math.round((sourceWidth * scale) / 2) * 2);
    canvas.height = Math.max(2, Math.round((sourceHeight * scale) / 2) * 2);

    const context = canvas.getContext("2d", { alpha: false });
    if (!context || typeof canvas.captureStream !== "function") {
      return new MediaStream(cameraStream.getVideoTracks());
    }

    stopRecordingVideoPump();
    recordingCanvasRef.current = canvas;

    const drawFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      recordingFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const stream = canvas.captureStream(30);
    const track = stream.getVideoTracks()[0];
    if (track && "contentHint" in track) track.contentHint = "motion";
    recordingCanvasStreamRef.current = stream;
    return stream;
  }

  function discardRecording() {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
    setRecordedUrl("");
    setRecordedBlob(null);
    setRecordedMimeType("");
    onRecordingChange?.(null);
  }

  function stopCamera(force = false) {
    if (recording && !force) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera(nextFacingMode = facingMode): Promise<MediaStream | null> {
    setCameraError("");
    if (recording) return streamRef.current;

    stopCamera(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      return stream;
    } catch (error) {
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser and try again."
        : "I could not open this device's camera.";
      setCameraError(message);
      return null;
    }
  }

  async function switchCamera() {
    if (recording) return;
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    setMirror(next === "user");
    if (cameraOn) await startCamera(next);
  }

  const setPlayback = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlaying(value);
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownValue(null);
  }, []);

  const resetPrompt = useCallback(() => {
    cancelCountdown();
    const prompt = promptRef.current;
    scrollPositionRef.current = 0;
    if (prompt) prompt.scrollTop = 0;
    setPlayback(false);
    lastFrameRef.current = null;
  }, [cancelCountdown, setPlayback]);

  const startPlayback = useCallback((restart = false, skipCountdown = false) => {
    if (!scriptRef.current.trim()) return;

    cancelCountdown();
    const prompt = promptRef.current;
    if (restart) {
      scrollPositionRef.current = 0;
      if (prompt) prompt.scrollTop = 0;
    } else if (prompt) {
      scrollPositionRef.current = prompt.scrollTop;
    }

    setPlayback(false);
    lastFrameRef.current = null;

    const delay = skipCountdown ? 0 : countdownSecondsRef.current;
    if (delay <= 0) {
      setPlayback(true);
      return;
    }

    let remaining = delay;
    setCountdownValue(remaining);
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        cancelCountdown();
        setPlayback(true);
        lastFrameRef.current = null;
        return;
      }
      setCountdownValue(remaining);
    }, 1000);
  }, [cancelCountdown, setPlayback]);

  const pausePlayback = useCallback(() => {
    cancelCountdown();
    setPlayback(false);
    lastFrameRef.current = null;
  }, [cancelCountdown, setPlayback]);

  const togglePlayback = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      cancelCountdown();
      return;
    }
    if (playingRef.current) {
      pausePlayback();
      return;
    }
    startPlayback(false, false);
  }, [cancelCountdown, pausePlayback, startPlayback]);

  const resumePlayback = useCallback(() => {
    if (!playingRef.current) startPlayback(false, true);
  }, [startPlayback]);

  const restartPlayback = useCallback(() => {
    startPlayback(true, false);
  }, [startPlayback]);

  const handleVoiceCommand = useCallback((rawTranscript: string) => {
    const transcript = rawTranscript
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (transcript.includes("prompter restart")) {
      restartPlayback();
      return;
    }
    if (transcript.includes("prompter resume")) {
      resumePlayback();
      return;
    }
    if (transcript.includes("prompter stop")) {
      pausePlayback();
      return;
    }
    if (transcript.includes("prompter start")) {
      startPlayback(false, false);
    }
  }, [pausePlayback, restartPlayback, resumePlayback, startPlayback]);

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;

    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      setFullscreenInstallHint(false);
      return;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        setNativeFullscreen(false);
      }
      setFullscreenInstallHint(false);
      return;
    }

    const requestFullscreen = stage.requestFullscreen?.bind(stage);
    if (requestFullscreen) {
      try {
        await requestFullscreen({ navigationUI: "hide" });
        setFullscreenInstallHint(false);
        return;
      } catch {
        // Some mobile browsers reject element fullscreen or keep browser chrome.
      }
    }

    // Fallback fills the available viewport while preserving all custom controls.
    // Browser chrome cannot be forcibly removed from a normal iOS/Safari tab, so
    // installed standalone mode is the reliable browser-free path there.
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const runningStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      navigatorWithStandalone.standalone === true;

    setPseudoFullscreen(true);
    setFullscreenInstallHint(!runningStandalone);
  }

  async function startRecording(): Promise<boolean> {
    if (recording) return false;
    setRecordingError("");

    if (typeof MediaRecorder === "undefined") {
      setRecordingError("Video recording is not supported in this browser.");
      return false;
    }

    let cameraStream = streamRef.current;
    const hasLiveVideo = cameraStream?.getVideoTracks().some((track) => track.readyState === "live") === true;
    if (!hasLiveVideo) cameraStream = await startCamera();
    if (!cameraStream) return false;

    try {
      stopMic();
      const micStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      // Record a composited camera frame instead of handing MediaRecorder the
      // raw mobile camera track. Current iOS/WebKit builds can expose the raw
      // sensor buffer with unstable orientation/encoding; drawing the displayed
      // frame to a fixed canvas makes the recorded geometry and frame stream stable.
      const stableVideoStream = await createStableRecordingVideoStream(cameraStream);
      const recordingStream = new MediaStream([
        ...stableVideoStream.getVideoTracks(),
        ...micStream.getAudioTracks(),
      ]);

      const mimeType = preferredRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream);

      chunksRef.current = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setRecordingError("The browser reported a recording error. Please try again.");
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });

        clearRecordingTimer();
        stopMic();
        stopRecordingVideoPump();
        setRecording(false);
        recorderRef.current = null;

        if (!blob.size) {
          setRecordingError("The recording stopped, but the browser did not return a video file.");
          return;
        }

        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        const url = URL.createObjectURL(blob);
        recordingUrlRef.current = url;
        setRecordedBlob(blob);
        setRecordedMimeType(finalType);
        setRecordedUrl(url);
        onRecordingChange?.({
          blob,
          mimeType: finalType,
          url,
          filename: recordingFilename(finalType),
        });
      };

      discardRecording();
      setRecordingSeconds(0);
      recordingStartedAtRef.current = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt) setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);

      // A single continuous recording avoids Safari/WebKit chunk-boundary
      // regressions seen with short MediaRecorder timeslices.
      recorder.start();
      setRecording(true);
      return true;
    } catch (error) {
      stopMic();
      stopRecordingVideoPump();
      clearRecordingTimer();
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access to record video with audio."
        : "I could not start recording on this device.";
      setRecordingError(message);
      return false;
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  async function beginSequenceRecording() {
    const started = await startRecording();
    if (!started) return;

    const prompt = promptRef.current;
    scrollPositionRef.current = 0;
    if (prompt) prompt.scrollTop = 0;
    lastFrameRef.current = null;
    if (scriptRef.current.trim()) setPlayback(true);
  }

  async function startSequenceCapture() {
    if (countdownTimerRef.current !== null) {
      cancelCountdown();
      return;
    }

    resetPrompt();
    const delay = countdownSecondsRef.current;
    if (delay <= 0) {
      await beginSequenceRecording();
      return;
    }

    let remaining = delay;
    setCountdownValue(remaining);
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current !== null) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdownValue(null);
        void beginSequenceRecording();
        return;
      }
      setCountdownValue(remaining);
    }, 1000);
  }

  function stopSequenceCapture() {
    stopRecording();
    resetPrompt();
  }

  function downloadRecording() {
    if (!recordedBlob || !recordedUrl) return;
    const anchor = document.createElement("a");
    anchor.href = recordedUrl;
    anchor.download = recordingFilename(recordedMimeType || recordedBlob.type);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function shareRecording() {
    if (!recordedBlob) return;
    const mimeType = recordedMimeType || recordedBlob.type || "video/mp4";
    const file = new File([recordedBlob], recordingFilename(mimeType), { type: mimeType });

    if (typeof navigator.share !== "function") {
      downloadRecording();
      return;
    }

    try {
      await navigator.share({
        title: "Creative Circle recording",
        files: [file],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setRecordingError("Sharing is not available here. Use Save Recording instead.");
    }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(TELEPROMPTER_SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<TeleprompterSettings>;
          setSpeed(clampNumber(saved.speed, 10, 110, 38));
          setFontSize(clampNumber(saved.fontSize, 26, 76, 44));
          setEyeLinePosition(clampNumber(saved.eyeLinePosition, 20, 72, 42));
          if (saved.facingMode === "user" || saved.facingMode === "environment") {
            setFacingMode(saved.facingMode);
          }
          if (typeof saved.mirror === "boolean") setMirror(saved.mirror);
          if (typeof saved.showGuide === "boolean") setShowGuide(saved.showGuide);
          if (typeof saved.showControls === "boolean") setShowControls(saved.showControls);
          setCountdownSeconds(clampNumber(saved.countdownSeconds, 0, 10, 3));
          if (typeof saved.remoteBinding === "string") setRemoteBinding(saved.remoteBinding);
        }
      } catch {
        // Corrupt or unavailable local storage should never block the teleprompter.
      } finally {
        if (active) setSettingsLoaded(true);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    const settings: TeleprompterSettings = {
      speed,
      fontSize,
      eyeLinePosition,
      facingMode,
      mirror,
      showGuide,
      showControls,
      countdownSeconds,
      remoteBinding,
    };

    try {
      window.localStorage.setItem(TELEPROMPTER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing/storage restrictions can disable localStorage.
    }
  }, [settingsLoaded, speed, fontSize, eyeLinePosition, facingMode, mirror, showGuide, showControls, countdownSeconds, remoteBinding]);

  useEffect(() => {
    scriptRef.current = script;
  }, [script]);

  useEffect(() => {
    countdownSecondsRef.current = countdownSeconds;
  }, [countdownSeconds]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVoiceControlAvailable(Boolean(getSpeechRecognitionConstructor()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!voiceControlEnabled) return;

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    let active = true;

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    const startListening = () => {
      if (!active) return;
      try {
        recognition.start();
      } catch (error) {
        if (error instanceof DOMException && error.name === "InvalidStateError") return;
        setVoiceError("Voice control could not start. Check microphone permission and try again.");
      }
    };

    recognition.onstart = () => {
      if (!active) return;
      setVoiceListening(true);
      setVoiceError("");
    };

    recognition.onresult = (event) => {
      const startIndex = event.resultIndex ?? 0;
      for (let index = startIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript;
        if (transcript) handleVoiceCommand(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (!active) return;
      setVoiceListening(false);
      const errorCode = event.error || "";
      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        setVoiceError("Microphone permission is required for voice control.");
        setVoiceControlEnabled(false);
        return;
      }
      if (errorCode && errorCode !== "no-speech" && errorCode !== "aborted") {
        setVoiceError(`Voice control paused (${errorCode}).`);
      }
    };

    recognition.onend = () => {
      if (!active) return;
      setVoiceListening(false);
      voiceRestartTimerRef.current = window.setTimeout(startListening, 350);
    };

    startListening();

    return () => {
      active = false;
      if (voiceRestartTimerRef.current !== null) {
        window.clearTimeout(voiceRestartTimerRef.current);
        voiceRestartTimerRef.current = null;
      }
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Recognition can already be stopped by the browser.
      }
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setVoiceListening(false);
    };
  }, [handleVoiceCommand, voiceControlEnabled]);

  useEffect(() => {
    if (!remoteLearning) {
      if (remoteLearnTimerRef.current !== null) {
        window.clearTimeout(remoteLearnTimerRef.current);
        remoteLearnTimerRef.current = null;
      }
      return;
    }

    remoteLearnTimerRef.current = window.setTimeout(() => {
      setRemoteLearning(false);
      setRemoteDiagnostic(
        "No browser input detected. If your phone volume changed, this remote is sending a system shutter/volume command that the web teleprompter cannot read. Try a Bluetooth keyboard/page-turner remote instead.",
      );
      remoteLearnTimerRef.current = null;
    }, 6000);

    return () => {
      if (remoteLearnTimerRef.current !== null) {
        window.clearTimeout(remoteLearnTimerRef.current);
        remoteLearnTimerRef.current = null;
      }
    };
  }, [remoteLearning]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastFrameRef.current = null;
      return;
    }

    const prompt = promptRef.current;
    if (prompt) scrollPositionRef.current = prompt.scrollTop;

    function tick(timestamp: number) {
      const prompt = promptRef.current;
      if (!prompt) return;

      const previous = lastFrameRef.current ?? timestamp;
      const delta = Math.min(timestamp - previous, 100);
      lastFrameRef.current = timestamp;

      // Keep a floating-point position instead of incrementing scrollTop directly.
      // iOS WebKit rounds scrollTop to whole pixels, so sub-pixel increments can
      // otherwise be discarded every frame at normal teleprompter speeds.
      const maxScroll = Math.max(0, prompt.scrollHeight - prompt.clientHeight);
      const nextPosition = Math.min(
        maxScroll,
        scrollPositionRef.current + speed * (delta / 1000),
      );
      scrollPositionRef.current = nextPosition;
      prompt.scrollTop = nextPosition;

      if (nextPosition >= maxScroll - 1) {
        setPlaying(false);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed]);

  useEffect(() => {
    function onFullscreenChange() {
      setNativeFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!pseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pseudoFullscreen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (remoteLearning) {
        if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
        event.preventDefault();
        if (remoteLearnTimerRef.current !== null) {
          window.clearTimeout(remoteLearnTimerRef.current);
          remoteLearnTimerRef.current = null;
        }
        const binding = keyboardBinding(event);
        const label = describeKeyboardBinding(binding);
        setRemoteBinding(binding);
        setRemoteLastInput(label);
        setRemoteDiagnostic(`Compatible input detected: ${label}. This button is now mapped to start/pause.`);
        setRemoteLearning(false);
        return;
      }

      const learnedRemotePressed = Boolean(remoteBinding) && keyboardBinding(event) === remoteBinding;
      if (learnedRemotePressed) {
        event.preventDefault();
        setRemoteLastInput(describeKeyboardBinding(keyboardBinding(event)));
        togglePlayback();
        return;
      }

      const interactive = target?.closest("textarea,input,select,button,a,[contenteditable='true']");
      if (interactive) return;

      if (event.code === "Space" || isSupportedRemoteKey(event)) {
        event.preventDefault();
        setRemoteLastInput(describeKeyboardBinding(keyboardBinding(event)));
        togglePlayback();
        return;
      }

      if (event.key.toLowerCase() === "r" && !recording) {
        event.preventDefault();
        restartPlayback();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recording, remoteBinding, remoteLearning, restartPlayback, togglePlayback]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingFrameRef.current !== null) cancelAnimationFrame(recordingFrameRef.current);
    recordingCanvasStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingCanvasStreamRef.current = null;
    recordingCanvasRef.current = null;
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    if (voiceRestartTimerRef.current !== null) window.clearTimeout(voiceRestartTimerRef.current);
    if (remoteLearnTimerRef.current !== null) window.clearTimeout(remoteLearnTimerRef.current);
    try {
      recognitionRef.current?.abort();
    } catch {
      // Recognition can already be stopped by the browser.
    }
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return <div className="teleprompter-shell">
    <aside className={`teleprompter-editor${showControls ? "" : " collapsed"}`}>
      <div className="teleprompter-editor-head">
        <div>
          <span className="micro">{contextLabel || "SCRIPT"}</span>
          <h2>What are we saying?</h2>
        </div>
        <div className="teleprompter-editor-head-actions">
          {showControls && <button
            className="teleprompter-clear-script"
            type="button"
            onClick={() => { setScript(""); resetPrompt(); }}
            disabled={!script}
          >
            CLEAR SCRIPT
          </button>}
          <button
            className="teleprompter-collapse"
            type="button"
            onClick={() => setShowControls((value) => !value)}
            aria-label={showControls ? "Hide script editor" : "Show script editor"}
          >
            {showControls ? "←" : "→"}
          </button>
        </div>
      </div>

      {showControls && <>
        <textarea
          className="teleprompter-script-input"
          value={script}
          onChange={(event) => {
            const nextScript = event.target.value;
            setScript(nextScript);
            onScriptChange?.(nextScript);
            resetPrompt();
          }}
          spellCheck
          aria-label="Teleprompter script"
        />

        <div className="teleprompter-editor-meta">
          <span>{script.trim() ? script.trim().split(/\s+/).length : 0} WORDS</span>
          <span>READY FOR NEXT SCRIPT</span>
        </div>

        <div className="teleprompter-settings">
          <label>
            <span><b>SPEED</b><output>{speed} px/s</output></span>
            <input
              type="range"
              min="10"
              max="110"
              step="2"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>

          <label>
            <span><b>TEXT SIZE</b><output>{fontSize}px</output></span>
            <input
              type="range"
              min="26"
              max="76"
              step="2"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
          </label>

          <label>
            <span><b>EYE LINE POSITION</b><output>{eyeLinePosition}%</output></span>
            <input
              type="range"
              min="20"
              max="72"
              step="1"
              value={eyeLinePosition}
              onChange={(event) => setEyeLinePosition(Number(event.target.value))}
            />
          </label>

          <label>
            <span><b>START COUNTDOWN</b><output>{countdownSeconds === 0 ? "OFF" : `${countdownSeconds}s`}</output></span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={countdownSeconds}
              onChange={(event) => setCountdownSeconds(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="teleprompter-toggle-grid">
          <button type="button" className={mirror ? "active" : ""} onClick={() => setMirror((value) => !value)}>
            <span>MIRROR CAMERA</span><b>{mirror ? "ON" : "OFF"}</b>
          </button>
          <button type="button" className={showGuide ? "active" : ""} onClick={() => setShowGuide((value) => !value)}>
            <span>EYE LINE</span><b>{showGuide ? "ON" : "OFF"}</b>
          </button>
        </div>

        <div className="teleprompter-handsfree">
          <div className="teleprompter-handsfree-title">
            <span>HANDS-FREE</span>
            <small>Start, stop, resume, or restart without touching the screen.</small>
          </div>

          <div className="teleprompter-toggle-grid">
            <button
              type="button"
              className={voiceControlEnabled ? "active" : ""}
              disabled={!voiceControlAvailable}
              onClick={() => {
                setVoiceError("");
                setVoiceControlEnabled((value) => !value);
              }}
            >
              <span>VOICE CONTROL</span>
              <b>{!voiceControlAvailable ? "UNAVAILABLE" : voiceListening ? "LISTENING" : voiceControlEnabled ? "STARTING" : "OFF"}</b>
            </button>
            <button
              type="button"
              className={remoteLearning ? "active" : ""}
              onClick={() => {
                if (remoteLearning) {
                  setRemoteLearning(false);
                  setRemoteDiagnostic("Remote test cancelled.");
                  return;
                }
                setRemoteLastInput("");
                setRemoteDiagnostic("Waiting for browser input… press the remote button now.");
                setRemoteLearning(true);
              }}
            >
              <span>REMOTE TEST</span>
              <b>{remoteLearning ? "PRESS BUTTON" : remoteBinding ? "MAPPED" : "TEST / LEARN"}</b>
            </button>
          </div>

          <p>
            {voiceError || (voiceControlAvailable
              ? "Voice: “Prompter start”, “Prompter stop”, “Prompter resume”, or “Prompter restart”."
              : "Voice commands are not available in this browser.")}
          </p>
          <p>
            {remoteDiagnostic || (remoteLastInput
              ? `Last browser input: ${remoteLastInput}`
              : remoteBinding
                ? `Remote mapped to: ${describeKeyboardBinding(remoteBinding)}`
                : "Tap Test / Learn, then press the remote once. Compatible keyboard-style inputs include Space, Enter, arrow keys, Page Up/Down, and media keys when the browser exposes them.")}
          </p>
          {remoteBinding && <button
            type="button"
            className="teleprompter-clear-remote"
            onClick={() => {
              setRemoteBinding("");
              setRemoteLastInput("");
              setRemoteDiagnostic("");
              setRemoteLearning(false);
            }}
          >
            CLEAR REMOTE MAPPING
          </button>}
        </div>

        <div className="teleprompter-shortcuts">
          <span>SPACE <b>Start / pause</b></span>
          <span>R <b>Restart + countdown</b></span>
          <span>LOCAL <b>Settings saved on this device</b></span>
        </div>
      </>}
    </aside>

    <section className="teleprompter-stage-wrap">
      <div className="teleprompter-toolbar">
        <div className="teleprompter-camera-state">
          <span className={cameraOn ? "live" : ""}><i /> {cameraOn ? "CAMERA LIVE" : "CAMERA OFF"}</span>
          <small>{facingMode === "user" ? "FRONT CAMERA" : "REAR CAMERA"} · MIC RECORDS WITH VIDEO</small>
        </div>

        <div className="teleprompter-toolbar-actions">
          <button type="button" disabled={recording} onClick={() => cameraOn ? stopCamera() : void startCamera()}>
            {cameraOn ? "STOP CAMERA" : "ENABLE CAMERA"}
          </button>
          <button type="button" disabled={recording} onClick={() => void switchCamera()}>FLIP</button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            {fullscreenActive ? "EXIT FULLSCREEN" : "FULLSCREEN ↗"}
          </button>
        </div>
      </div>

      {(cameraError || recordingError) && <div className="teleprompter-camera-error">{recordingError || cameraError}</div>}

      <div
        ref={stageRef}
        className={`teleprompter-stage${pseudoFullscreen ? " pseudo-fullscreen" : ""}`}
      >
        <video
          ref={videoRef}
          className={`teleprompter-video${mirror ? " mirrored" : ""}`}
          autoPlay
          muted
          playsInline
        />

        {!cameraOn && <div className="teleprompter-camera-placeholder">
          <div className="teleprompter-lens">
            <span />
            <i />
          </div>
          <strong>Camera preview</strong>
          <p>Enable the camera when you are ready to rehearse or record.</p>
        </div>}

        <div className="teleprompter-vignette" aria-hidden="true" />
        {showGuide && <div
          className="teleprompter-eye-guide"
          style={{ top: `${eyeLinePosition}%` }}
          aria-hidden="true"
        ><span>EYE LINE</span></div>}

        {fullscreenActive && <button
          type="button"
          className="teleprompter-fullscreen-exit"
          onClick={() => void toggleFullscreen()}
          aria-label="Exit fullscreen"
        >×</button>}

        {pseudoFullscreen && fullscreenInstallHint && <div className="teleprompter-fullscreen-hint">
          <strong>BROWSER-FREE MODE</strong>
          <span>Add Creative Circle to your Home Screen, then open it there to remove the URL bar and browser controls.</span>
          <button type="button" onClick={() => setFullscreenInstallHint(false)}>GOT IT</button>
        </div>}

        {recording && <div className="teleprompter-recording-badge">
          <i />
          REC
          <strong>{formatDuration(recordingSeconds)}</strong>
        </div>}

        {countdownValue !== null && <div className="teleprompter-countdown" aria-live="assertive">
          <span>STARTING IN</span>
          <strong>{countdownValue}</strong>
          <small>Press again or say “Prompter stop” to cancel</small>
        </div>}

        <div
          ref={promptRef}
          className="teleprompter-prompt"
          style={{ fontSize: `${fontSize}px` }}
        >
          <div className="teleprompter-prompt-spacer" style={{ height: `${eyeLinePosition}%` }} />
          <div className="teleprompter-copy">{script || "Paste a script in the editor to begin."}</div>
          <div className="teleprompter-prompt-spacer end" />
        </div>

        <div className={`teleprompter-stage-controls${sequenceCaptureMode ? " sequence" : ""}`}>
          <button type="button" className="teleprompter-reset" onClick={resetPrompt}>↺</button>
          {!sequenceCaptureMode && <button
            type="button"
            className={`teleprompter-play${playing || countdownValue !== null ? " playing" : ""}`}
            onClick={togglePlayback}
            disabled={!script.trim()}
          >
            <span>{countdownValue !== null ? "×" : playing ? "Ⅱ" : "▶"}</span>
            {countdownValue !== null ? "CANCEL" : playing ? "PAUSE" : "START"}
          </button>}
          <button
            type="button"
            className={`teleprompter-record${recording ? " recording" : ""}`}
            onClick={() => {
              if (sequenceCaptureMode) {
                if (countdownValue !== null) {
                  cancelCountdown();
                  return;
                }
                if (recording) {
                  stopSequenceCapture();
                  return;
                }
                void startSequenceCapture();
                return;
              }
              if (recording) stopRecording();
              else void startRecording();
            }}
          >
            <i />
            {countdownValue !== null && sequenceCaptureMode
              ? `CANCEL ${countdownValue}`
              : recording
                ? `STOP ${formatDuration(recordingSeconds)}`
                : "RECORD"}
          </button>
          {sequenceCaptureMode && <button
            type="button"
            className="teleprompter-delete-take"
            disabled={recording || countdownValue !== null || !canDeletePreviousTake}
            onClick={onDeletePreviousTake}
          >
            <span>⌫</span>
            DELETE LAST
          </button>}
          <div className="teleprompter-speed-readout">
            <span>SPEED</span>
            <strong>{speed}</strong>
          </div>
        </div>
      </div>

      <div className="teleprompter-footnote">
        <span>{sequenceCaptureMode
          ? "Stop recording to lock this take and advance automatically. Delete Last walks backward through your recorded stack."
          : captureMode
            ? "This take stays on this device until you add it to the batch. The teleprompter text is not burned into the video."
            : "Recording stays on this device. The teleprompter text is not burned into the video."}</span>
        <span>Best results: place the eye line close to your camera lens.</span>
      </div>

      {recordedUrl && !sequenceCaptureMode && <section className="teleprompter-recording-result">
        <div className="teleprompter-recording-result-copy">
          <span className="micro">LATEST TAKE</span>
          <h3>Recording ready.</h3>
          <p>
            {captureMode
              ? "Review the take, then add it to your variation batch when it feels right."
              : "Review the take, save it to this device, or use Share on mobile to send it directly into your editing workflow."}
          </p>
          <div className="teleprompter-recording-actions">
            <button type="button" className="primary" onClick={downloadRecording}>SAVE RECORDING</button>
            <button type="button" onClick={() => void shareRecording()}>SHARE</button>
            <button type="button" onClick={discardRecording}>DISCARD</button>
          </div>
        </div>
        <video className="teleprompter-recording-preview" src={recordedUrl} controls playsInline />
      </section>}
    </section>
  </div>;
}
