import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const base = process.env.APP_URL ?? "http://localhost:3000";
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
if (!email || !password) throw new Error("OWNER_EMAIL and OWNER_PASSWORD are required");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2500)}`)));
  });
}

async function waitForServer() {
  for (let i = 0; i < 45; i++) {
    try {
      const response = await fetch(`${base}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Server did not become healthy");
}

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";")[0]).join("; ");
}

async function api(path, options = {}, cookie = "") {
  const headers = new Headers(options.headers ?? {});
  headers.set("Origin", base);
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

await waitForServer();

const unauth = await api("/api/projects");
if (unauth.response.status !== 401) throw new Error(`Expected unauthenticated projects request to be 401, got ${unauth.response.status}`);

const login = await api("/api/auth/sign-in/email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});
if (!login.response.ok) throw new Error(`Login failed: ${login.response.status} ${login.text}`);
const cookie = cookiesFrom(login.response);
if (!cookie) throw new Error("Login did not return a session cookie");

const created = await api("/api/projects", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "CI End-to-End Render" })
}, cookie);
if (created.response.status !== 201) throw new Error(`Project creation failed: ${created.response.status} ${created.text}`);
const projectId = created.json?.project?.id;
if (!projectId) throw new Error("Project creation did not return an id");

const fixture = "/tmp/creative-circle-e2e-source.mp4";
await run(process.env.FFMPEG_PATH ?? "ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=24:duration=1.5",
  "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=1.5",
  "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", fixture
]);

const source = await readFile(fixture);
const uploaded = await api(`/api/projects/${projectId}/upload`, {
  method: "POST",
  headers: { "Content-Type": "video/mp4", "X-File-Name": "ci-portrait.mp4" },
  body: source
}, cookie);
if (uploaded.response.status !== 201) throw new Error(`Upload failed: ${uploaded.response.status} ${uploaded.text}`);

const stack = [
  {
    instanceId: "ci-neon",
    effectId: "neon-edge-trace",
    enabled: true,
    seed: 424242,
    params: { sensitivity: 0.35, width: 2, glow: 7, color: "#72e8ff" }
  },
  {
    instanceId: "ci-flicker",
    effectId: "film-gate-flicker",
    enabled: true,
    seed: 121212,
    params: { flicker: 0.3, weave: 2, grain: 0.18, exposure: 0.16 }
  }
];
const saved = await api(`/api/projects/${projectId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ effectStack: stack })
}, cookie);
if (!saved.response.ok) throw new Error(`Project save failed: ${saved.response.status} ${saved.text}`);

const queued = await api(`/api/projects/${projectId}/renders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ resolution: "720p", quality: "standard", keepAudio: true })
}, cookie);
if (queued.response.status !== 201) throw new Error(`Render enqueue failed: ${queued.response.status} ${queued.text}`);
const renderId = queued.json?.job?.id;
if (!renderId) throw new Error("Render enqueue did not return an id");

let exportRow = null;
for (let i = 0; i < 90; i++) {
  const status = await api(`/api/projects/${projectId}/renders`, {}, cookie);
  if (!status.response.ok) throw new Error(`Render status failed: ${status.response.status}`);
  const job = status.json?.jobs?.find((item) => item.id === renderId);
  if (job?.status === "failed") throw new Error(`Worker render failed: ${job.error ?? "unknown error"}`);
  exportRow = status.json?.exports?.find((item) => item.renderJobId === renderId) ?? null;
  if (job?.status === "complete" && exportRow) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!exportRow) throw new Error("Render did not complete within 90 seconds");

const downloaded = await api(`/api/exports/${exportRow.id}`, {}, cookie);
if (!downloaded.response.ok) throw new Error(`Export download failed: ${downloaded.response.status}`);
const bytes = Buffer.from(await downloaded.response.arrayBuffer());
if (bytes.length < 1000) throw new Error("Rendered export was unexpectedly small");
const output = "/tmp/creative-circle-e2e-output.mp4";
await writeFile(output, bytes);

const videoCodec = await run(process.env.FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", output]);
if (videoCodec !== "h264") throw new Error(`Expected H.264 output, got ${videoCodec}`);
const audioCodec = await run(process.env.FFPROBE_PATH ?? "ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", output]);
if (audioCodec !== "aac") throw new Error(`Expected AAC output, got ${audioCodec}`);

const removed = await api(`/api/exports/${exportRow.id}`, { method: "DELETE" }, cookie);
if (removed.response.status !== 204) throw new Error(`Export delete failed: ${removed.response.status}`);

console.log(JSON.stringify({
  ok: true,
  projectId,
  renderId,
  source: "360x640 H.264/AAC",
  output: `${exportRow.resolution} H.264/AAC`,
  bytes: bytes.length,
  effects: stack.map((effect) => effect.effectId)
}));
