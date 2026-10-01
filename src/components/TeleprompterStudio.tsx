"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_SCRIPT = `Paste your script here.

The teleprompter will scroll over your live camera preview so you can keep your eyes close to the lens while you read.

Adjust the speed and text size until the pacing feels natural, then press Start.`;

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

export function TeleprompterStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
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
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

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

      const recordingStream = new MediaStream([
        ...cameraStream.getVideoTracks(),
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
      clearRecordingTimer();
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access to record video with audio."
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
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return <div className="teleprompter-shell">
    <aside className={`teleprompter-editor${showControls ? "" : " collapsed"}`}>
      <div className="teleprompter-editor-head">
        <div>
          <span className="micro">SCRIPT</span>
          <h2>What are we saying?</h2>
        </div>
        <button
          className="teleprompter-collapse"
          type="button"
          onClick={() => setShowControls((value) => !value)}
          aria-label={showControls ? "Hide script editor" : "Show script editor"}
        >
          {showControls ? "←" : "→"}
        </button>
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
          <button type="button" onClick={() => { setScript(""); resetPrompt(); }}>CLEAR</button>
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
        </div>

        <div className="teleprompter-shortcuts">
          <span>SPACE <b>Play / pause</b></span>
          <span>R <b>Restart</b></span>
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
        <span>Recording stays on this device. The teleprompter text is not burned into the video.</span>
        <span>Best results: place the eye line close to your camera lens.</span>
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
