import { spawn } from "node:child_process";

const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

export type VideoMetadata = {
  width: number;
  height: number;
  durationMs: number;
  frameRate: string;
  codec: string;
  hasAudio: boolean;
  rotation: number;
};

function run(cmd: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)));
  });
}

export async function probeVideo(input: string): Promise<VideoMetadata> {
  const { stdout } = await run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", input]);
  const data = JSON.parse(stdout) as { streams?: Array<Record<string, unknown>>; format?: Record<string, unknown> };
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("No video stream found");
  const audio = data.streams?.some((stream) => stream.codec_type === "audio") ?? false;
  const width = Number(video.width ?? 0);
  const height = Number(video.height ?? 0);
  const duration = Number(video.duration ?? data.format?.duration ?? 0);
  if (!width || !height || !Number.isFinite(duration) || duration <= 0) throw new Error("Invalid video metadata");
  const tags = (video.tags ?? {}) as Record<string, unknown>;
  const side = Array.isArray(video.side_data_list) ? video.side_data_list as Array<Record<string, unknown>> : [];
  const sideRotation = side.find((entry) => typeof entry.rotation === "number")?.rotation;
  const rotation = Number(sideRotation ?? tags.rotate ?? 0) || 0;
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const swapsAxes = normalizedRotation === 90 || normalizedRotation === 270;
  return {
    width: swapsAxes ? height : width,
    height: swapsAxes ? width : height,
    durationMs: Math.round(duration * 1000),
    frameRate: String(video.avg_frame_rate ?? video.r_frame_rate ?? "0/1"),
    codec: String(video.codec_name ?? "unknown"),
    hasAudio: audio,
    rotation: normalizedRotation,
  };
}

export async function makeThumbnail(input: string, output: string) {
  await run(ffmpeg, ["-y", "-ss", "0.25", "-i", input, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-q:v", "3", output]);
}

export async function makeBrowserPlaybackCopy(input: string, output: string, sourceCodec?: string) {
  const codec = sourceCodec?.toLowerCase();
  const videoArgs = codec === "h264"
    ? ["-c:v", "copy"]
    : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"];

  await run(ffmpeg, [
    "-y",
    "-i", input,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    ...videoArgs,
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    output,
  ]);
}

export function getFfmpegPath() { return ffmpeg; }
