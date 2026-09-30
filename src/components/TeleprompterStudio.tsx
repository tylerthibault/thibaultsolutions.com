"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_SCRIPT = `Paste your script here.

The teleprompter will scroll over your live camera preview so you can keep your eyes close to the lens while you read.

Adjust the speed and text size until the pacing feels natural, then press Start.`;

export function TeleprompterStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);

  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [speed, setSpeed] = useState(38);
  const [fontSize, setFontSize] = useState(44);
  const [playing, setPlaying] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [mirror, setMirror] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [showControls, setShowControls] = useState(true);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera(nextFacingMode = facingMode) {
    setCameraError("");
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
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
    } catch (error) {
      const message = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser and try again."
        : "I could not open this device's camera.";
      setCameraError(message);
    }
  }

  async function switchCamera() {
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

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      // Fullscreen is optional; the studio still works without it.
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
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT";
      if (typing) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key.toLowerCase() === "r") resetPrompt();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
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
          <small>{facingMode === "user" ? "FRONT CAMERA" : "REAR CAMERA"}</small>
        </div>

        <div className="teleprompter-toolbar-actions">
          <button type="button" onClick={() => cameraOn ? stopCamera() : void startCamera()}>
            {cameraOn ? "STOP CAMERA" : "ENABLE CAMERA"}
          </button>
          <button type="button" onClick={() => void switchCamera()}>FLIP</button>
          <button type="button" onClick={() => void toggleFullscreen()}>FULLSCREEN ↗</button>
        </div>
      </div>

      {cameraError && <div className="teleprompter-camera-error">{cameraError}</div>}

      <div ref={stageRef} className="teleprompter-stage">
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
          <p>Enable the camera when you are ready to rehearse.</p>
        </div>}

        <div className="teleprompter-vignette" aria-hidden="true" />
        {showGuide && <div className="teleprompter-eye-guide" aria-hidden="true"><span>EYE LINE</span></div>}

        <div
          ref={promptRef}
          className="teleprompter-prompt"
          style={{ fontSize: `${fontSize}px` }}
        >
          <div className="teleprompter-prompt-spacer" />
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
          <div className="teleprompter-speed-readout">
            <span>SPEED</span>
            <strong>{speed}</strong>
          </div>
        </div>
      </div>

      <div className="teleprompter-footnote">
        <span>Camera stays on this device and is not uploaded.</span>
        <span>Best results: place the eye line close to your camera lens.</span>
      </div>
    </section>
  </div>;
}
