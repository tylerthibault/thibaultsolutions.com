"use client";

import { useEffect, useRef, useState } from "react";

const TELEPROMPTER_SETTINGS_KEY = "creative-circle:teleprompter-settings:v1";

type TeleprompterSettings = {
  speed: number;
  fontSize: number;
  eyeLinePosition: number;
  facingMode: "user" | "environment";
  mirror: boolean;
  showGuide: boolean;
  showControls: boolean;
  cinematicEnabled: boolean;
  cinematicDepth: number;
};

const DEFAULT_SCRIPT = `Paste your script here.

The teleprompter will scroll over your live camera preview so you can keep your eyes close to the lens while you read.

Adjust the speed and text size until the pacing feels natural, then press Start.`;

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

const CINEMATIC_MAX_LONG_EDGE = 1920;

function renderCinematicFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  subjectCanvas: HTMLCanvasElement,
  blurCanvas: HTMLCanvasElement,
  depthValue: number,
) {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    || !video.videoWidth
    || !video.videoHeight
  ) {
    return false;
  }

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const outputScale = Math.min(
    1,
    CINEMATIC_MAX_LONG_EDGE / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(2, Math.round(sourceWidth * outputScale));
  const height = Math.max(2, Math.round(sourceHeight * outputScale));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  if (subjectCanvas.width !== width || subjectCanvas.height !== height) {
    subjectCanvas.width = width;
    subjectCanvas.height = height;
  }

  const depth = clampNumber(depthValue, 0, 100, 58) / 100;
  const blurScale = 0.36 - depth * 0.14;
  const blurWidth = Math.max(2, Math.round(width * blurScale));
  const blurHeight = Math.max(2, Math.round(height * blurScale));

  if (blurCanvas.width !== blurWidth || blurCanvas.height !== blurHeight) {
    blurCanvas.width = blurWidth;
    blurCanvas.height = blurHeight;
  }

  const context = canvas.getContext("2d", { alpha: false });
  const subjectContext = subjectCanvas.getContext("2d");
  const blurContext = blurCanvas.getContext("2d", { alpha: false });
  if (!context || !subjectContext || !blurContext) return false;

  blurContext.imageSmoothingEnabled = true;
  blurContext.imageSmoothingQuality = "high";
  blurContext.clearRect(0, 0, blurWidth, blurHeight);
  blurContext.drawImage(video, 0, 0, blurWidth, blurHeight);

  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.filter = `blur(${(3 + depth * 7).toFixed(1)}px) saturate(${(1.02 + depth * 0.06).toFixed(3)}) contrast(1.03) brightness(${(0.97 - depth * 0.09).toFixed(3)})`;
  const pad = Math.max(10, Math.round(Math.min(width, height) * 0.02));
  context.drawImage(blurCanvas, -pad, -pad, width + pad * 2, height + pad * 2);
  context.restore();

  subjectContext.clearRect(0, 0, width, height);
  subjectContext.globalCompositeOperation = "source-over";
  subjectContext.filter = "contrast(1.025) saturate(1.035)";
  subjectContext.drawImage(video, 0, 0, width, height);
  subjectContext.filter = "none";
  subjectContext.globalCompositeOperation = "destination-in";

  const focusX = width * 0.5;
  const focusY = height * 0.46;
  const radiusX = width * (0.41 - depth * 0.055);
  const radiusY = height * (0.62 - depth * 0.07);

  subjectContext.save();
  subjectContext.translate(focusX, focusY);
  subjectContext.scale(1, radiusY / radiusX);
  const focusMask = subjectContext.createRadialGradient(
    0,
    0,
    radiusX * 0.54,
    0,
    0,
    radiusX,
  );
  focusMask.addColorStop(0, "rgba(0,0,0,1)");
  focusMask.addColorStop(0.58, "rgba(0,0,0,1)");
  focusMask.addColorStop(1, "rgba(0,0,0,0)");
  subjectContext.fillStyle = focusMask;
  subjectContext.fillRect(-width * 2, -height * 2, width * 4, height * 4);
  subjectContext.restore();
  subjectContext.globalCompositeOperation = "source-over";

  context.drawImage(subjectCanvas, 0, 0);

  const vignette = context.createRadialGradient(
    width * 0.5,
    height * 0.46,
    Math.min(width, height) * 0.24,
    width * 0.5,
    height * 0.46,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.72, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${(0.11 + depth * 0.08).toFixed(3)})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  return true;
}

export function TeleprompterStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processedVideoStreamRef = useRef<MediaStream | null>(null);
  const cinematicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cinematicSubjectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cinematicBlurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cinematicRafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);

  const [script, setScript] = useState(DEFAULT_SCRIPT);
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
  const [cinematicEnabled, setCinematicEnabled] = useState(false);
  const [cinematicDepth, setCinematicDepth] = useState(58);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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

  function stopProcessedVideo() {
    processedVideoStreamRef.current?.getTracks().forEach((track) => track.stop());
    processedVideoStreamRef.current = null;
  }

  function discardRecording() {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
    setRecordedUrl("");
    setRecordedBlob(null);
    setRecordedMimeType("");
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
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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

  function resetPrompt() {
    const prompt = promptRef.current;
    scrollPositionRef.current = 0;
    if (prompt) prompt.scrollTop = 0;
    setPlaying(false);
    lastFrameRef.current = null;
  }

  function togglePlayback() {
    if (!script.trim()) return;
    const prompt = promptRef.current;
    if (!playing && prompt) scrollPositionRef.current = prompt.scrollTop;
    setPlaying((value) => !value);
    lastFrameRef.current = null;
  }

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;

    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        setNativeFullscreen(false);
      }
      return;
    }

    const requestFullscreen = stage.requestFullscreen?.bind(stage);
    if (requestFullscreen) {
      try {
        await requestFullscreen();
        return;
      } catch {
        // iOS/WebKit can expose the API but reject element fullscreen.
      }
    }

    // Reliable fallback for mobile browsers that do not support arbitrary
    // element fullscreen. This fills the viewport while keeping prompt overlays.
    setPseudoFullscreen(true);
  }

  async function startRecording() {
    if (recording) return;
    setRecordingError("");

    if (typeof MediaRecorder === "undefined") {
      setRecordingError("Video recording is not supported in this browser.");
      return;
    }

    let cameraStream = streamRef.current;
    const hasLiveVideo = cameraStream?.getVideoTracks().some((track) => track.readyState === "live") === true;
    if (!hasLiveVideo) cameraStream = await startCamera();
    if (!cameraStream) return;

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

      stopProcessedVideo();

      let recordingVideoTracks = cameraStream.getVideoTracks();

      if (cinematicEnabled) {
        const canvas = cinematicCanvasRef.current;
        if (!canvas || typeof canvas.captureStream !== "function") {
          throw new Error("CINEMATIC_CAPTURE_UNSUPPORTED");
        }

        const sourceVideo = videoRef.current;
        if (!sourceVideo) throw new Error("CINEMATIC_FRAME_UNAVAILABLE");

        if (!cinematicSubjectCanvasRef.current) {
          cinematicSubjectCanvasRef.current = document.createElement("canvas");
        }
        if (!cinematicBlurCanvasRef.current) {
          cinematicBlurCanvasRef.current = document.createElement("canvas");
        }

        const rendered = renderCinematicFrame(
          sourceVideo,
          canvas,
          cinematicSubjectCanvasRef.current,
          cinematicBlurCanvasRef.current,
          cinematicDepth,
        );
        if (!rendered) throw new Error("CINEMATIC_FRAME_UNAVAILABLE");

        const processedStream = canvas.captureStream(30);
        const processedTrack = processedStream.getVideoTracks()[0];
        if (!processedTrack) throw new Error("CINEMATIC_CAPTURE_UNSUPPORTED");

        processedVideoStreamRef.current = processedStream;
        recordingVideoTracks = [processedTrack];
      }

      const recordingStream = new MediaStream([
        ...recordingVideoTracks,
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
        stopProcessedVideo();
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
      };

      discardRecording();
      setRecordingSeconds(0);
      recordingStartedAtRef.current = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt) setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);

      recorder.start(500);
      setRecording(true);
    } catch (error) {
      stopMic();
      stopProcessedVideo();
      clearRecordingTimer();
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access to record video with audio."
        : error instanceof Error && error.message === "CINEMATIC_CAPTURE_UNSUPPORTED"
          ? "Cinematic Look can preview here, but this browser cannot record the processed video. Turn Cinematic Look off to record normally."
          : error instanceof Error && error.message === "CINEMATIC_FRAME_UNAVAILABLE"
            ? "The camera is still starting. Wait a moment and try recording again."
            : "I could not start recording on this device.";
      setRecordingError(message);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
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
        if (typeof saved.cinematicEnabled === "boolean") setCinematicEnabled(saved.cinematicEnabled);
        setCinematicDepth(clampNumber(saved.cinematicDepth, 0, 100, 58));
      }
    } catch {
      // Corrupt or unavailable local storage should never block the teleprompter.
    } finally {
      setSettingsLoaded(true);
    }
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
      cinematicEnabled,
      cinematicDepth,
    };

    try {
      window.localStorage.setItem(TELEPROMPTER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing/storage restrictions can disable localStorage.
    }
  }, [
    settingsLoaded,
    speed,
    fontSize,
    eyeLinePosition,
    facingMode,
    mirror,
    showGuide,
    showControls,
    cinematicEnabled,
    cinematicDepth,
  ]);

  useEffect(() => {
    if (!cinematicEnabled || !cameraOn) {
      if (cinematicRafRef.current !== null) {
        cancelAnimationFrame(cinematicRafRef.current);
        cinematicRafRef.current = null;
      }
      return;
    }

    let active = true;
    if (!cinematicSubjectCanvasRef.current) {
      cinematicSubjectCanvasRef.current = document.createElement("canvas");
    }
    if (!cinematicBlurCanvasRef.current) {
      cinematicBlurCanvasRef.current = document.createElement("canvas");
    }
    const subjectCanvas = cinematicSubjectCanvasRef.current;
    const blurCanvas = cinematicBlurCanvasRef.current;

    function renderFrame() {
      if (!active) return;
      const video = videoRef.current;
      const canvas = cinematicCanvasRef.current;

      if (video && canvas) {
        renderCinematicFrame(video, canvas, subjectCanvas, blurCanvas, cinematicDepth);
      }

      cinematicRafRef.current = requestAnimationFrame(renderFrame);
    }

    renderFrame();

    return () => {
      active = false;
      if (cinematicRafRef.current !== null) {
        cancelAnimationFrame(cinematicRafRef.current);
        cinematicRafRef.current = null;
      }
    };
  }, [cameraOn, cinematicEnabled, cinematicDepth]);

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
      const typing = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
      if (typing) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key.toLowerCase() === "r" && !recording) resetPrompt();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    processedVideoStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (cinematicRafRef.current !== null) cancelAnimationFrame(cinematicRafRef.current);
  }, []);

  return <div className="teleprompter-shell">
    <aside className={`teleprompter-editor${showControls ? "" : " collapsed"}`}>
      <div className="teleprompter-editor-head">
        <div>
          <span className="micro">SCRIPT</span>
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
            setScript(event.target.value);
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
        </div>

        <div className="teleprompter-toggle-grid">
          <button type="button" className={mirror ? "active" : ""} onClick={() => setMirror((value) => !value)}>
            <span>MIRROR CAMERA</span><b>{mirror ? "ON" : "OFF"}</b>
          </button>
          <button type="button" className={showGuide ? "active" : ""} onClick={() => setShowGuide((value) => !value)}>
            <span>EYE LINE</span><b>{showGuide ? "ON" : "OFF"}</b>
          </button>
          <button
            type="button"
            className={cinematicEnabled ? "active" : ""}
            style={{ gridColumn: "1 / -1" }}
            onClick={() => setCinematicEnabled((value) => !value)}
            disabled={recording}
          >
            <span>CINEMATIC LOOK</span><b>{cinematicEnabled ? "ON" : "OFF"}</b>
          </button>
        </div>

        {cinematicEnabled && <div className="teleprompter-settings">
          <label>
            <span><b>CINEMATIC DEPTH</b><output>{cinematicDepth}%</output></span>
            <input
              type="range"
              min="0"
              max="100"
              step="2"
              value={cinematicDepth}
              disabled={recording}
              onChange={(event) => setCinematicDepth(Number(event.target.value))}
            />
          </label>
        </div>}

        <div className="teleprompter-shortcuts">
          <span>SPACE <b>Play / pause</b></span>
          <span>R <b>Restart</b></span>
          <span>LOCAL <b>Settings saved on this device</b></span>
        </div>
      </>}
    </aside>

    <section className="teleprompter-stage-wrap">
      <div className="teleprompter-toolbar">
        <div className="teleprompter-camera-state">
          <span className={cameraOn ? "live" : ""}><i /> {cameraOn ? "CAMERA LIVE" : "CAMERA OFF"}</span>
          <small>
            {facingMode === "user" ? "FRONT CAMERA" : "REAR CAMERA"} · {cinematicEnabled ? "CINEMATIC LOOK" : "STANDARD"} · MIC RECORDS WITH VIDEO
          </small>
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
          style={{ opacity: cinematicEnabled && cameraOn ? 0 : 1 }}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={cinematicCanvasRef}
          className={`teleprompter-video${mirror ? " mirrored" : ""}`}
          style={{
            opacity: cinematicEnabled && cameraOn ? 1 : 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
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

        {recording && <div className="teleprompter-recording-badge">
          <i />
          REC
          <strong>{formatDuration(recordingSeconds)}</strong>
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

        <div className="teleprompter-stage-controls">
          <button type="button" className="teleprompter-reset" onClick={resetPrompt}>↺</button>
          <button
            type="button"
            className={`teleprompter-play${playing ? " playing" : ""}`}
            onClick={togglePlayback}
            disabled={!script.trim()}
          >
            <span>{playing ? "Ⅱ" : "▶"}</span>
            {playing ? "PAUSE" : "START"}
          </button>
          <button
            type="button"
            className={`teleprompter-record${recording ? " recording" : ""}`}
            onClick={() => recording ? stopRecording() : void startRecording()}
          >
            <i />
            {recording ? `STOP ${formatDuration(recordingSeconds)}` : "RECORD"}
          </button>
          <div className="teleprompter-speed-readout">
            <span>SPEED</span>
            <strong>{speed}</strong>
          </div>
        </div>
      </div>

      <div className="teleprompter-footnote">
        <span>
          Recording stays on this device. The teleprompter text is not burned into the video.
          {cinematicEnabled ? " Cinematic Look is rendered into the saved recording." : ""}
        </span>
        <span>
          {cinematicEnabled
            ? "Cinematic works best with you centered and some distance between you and the background."
            : "Best results: place the eye line close to your camera lens."}
        </span>
      </div>

      {recordedUrl && <section className="teleprompter-recording-result">
        <div className="teleprompter-recording-result-copy">
          <span className="micro">LATEST TAKE</span>
          <h3>Recording ready.</h3>
          <p>
            Review the take, save it to this device, or use Share on mobile to send it directly into your editing workflow.
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
