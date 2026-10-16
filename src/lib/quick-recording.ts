/** Single finished-video recording order, independent of Variation Studio. */
export const QUICK_RECORDING_ORDER = ["hook", "body1", "body2", "cta"] as const;
export type QuickRecordingId = typeof QUICK_RECORDING_ORDER[number] | "full";
export type QuickRecordingClip = { id: QuickRecordingId; label: string; script: string };
export type QuickRecordingParseResult =
  | { ok: true; clips: QuickRecordingClip[] }
  | { ok: false; error: string };

const LABELS: Record<QuickRecordingId, string> = {
  hook: "Hook",
  body1: "Body 1",
  body2: "Body 2",
  cta: "CTA",
  full: "Full video",
};

const SECTION = /^\s*\[\[\s*(HOOK(?:\s*1)?|BODY\s*[12]|CTA(?:\s*1)?)\s*\]\]\s*$/gim;
const SEGMENT_LIKE = /^\s*\[\[\s*(HOOK|INTRO|BODY|CTA)(?:\s*\d+)?\s*\]\]\s*$/gim;
const BEAT = /^[ \t]*\[\[[ \t]*BEAT[ \t]*\d+[ \t]*\]\][ \t]*(?:\r?\n)?/gim;

function spokenText(value: string) {
  // Beats are cues within a take, not separate recording steps.
  return value.replace(BEAT, "").trim();
}

function sectionId(value: string): QuickRecordingId {
  const heading = value.toLowerCase().replace(/\s+/g, "");
  if (heading === "hook" || heading === "hook1") return "hook";
  if (heading === "body1" || heading === "body2") return heading;
  return "cta";
}

/**
 * A plain script records as one take. Tagged scripts record present sections
 * in Hook -> Body 1 -> Body 2 -> CTA order, with optional missing sections.
 */
export function parseQuickRecordingScript(source: string): QuickRecordingParseResult {
  const markers = Array.from(source.matchAll(SECTION));
  const knownHeadings = Array.from(source.matchAll(SEGMENT_LIKE));

  if (markers.length !== knownHeadings.length) {
    return {
      ok: false,
      error: "V6.1 supports [[HOOK]], [[BODY 1]], [[BODY 2]], and [[CTA]]. Remove other section or variation headings.",
    };
  }

  if (!markers.length) {
    return { ok: true, clips: [{ id: "full", label: LABELS.full, script: spokenText(source) }] };
  }

  if (source.slice(0, markers[0].index).trim()) {
    return { ok: false, error: "Put the spoken text after the first section heading." };
  }

  const sections = new Map<QuickRecordingId, QuickRecordingClip>();
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const id = sectionId(marker[1]);
    if (sections.has(id)) {
      return { ok: false, error: LABELS[id] + " appears more than once." };
    }
    const start = marker.index! + marker[0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : source.length;
    const script = spokenText(source.slice(start, end));
    if (!script) return { ok: false, error: LABELS[id] + " needs script text." };
    sections.set(id, { id, label: LABELS[id], script });
  }

  const clips = QUICK_RECORDING_ORDER.flatMap((id) => {
    const clip = sections.get(id);
    return clip ? [clip] : [];
  });
  return { ok: true, clips };
}
