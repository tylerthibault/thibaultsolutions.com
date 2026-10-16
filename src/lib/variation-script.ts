/** A single, labeled script for the Variation Studio recording queue. */
export const MAX_SCRIPT_VARIATIONS_PER_GROUP = 4;
export const SCRIPT_SEGMENT_KINDS = ["hook", "body", "cta"] as const;
export type ScriptSegmentKind = typeof SCRIPT_SEGMENT_KINDS[number];
export type ScriptCounts = Record<ScriptSegmentKind, number>;

export type ParsedVariationScript = {
  scripts: Record<string, string>;
  counts: ScriptCounts;
};

export type ScriptParseResult =
  | { ok: true; value: ParsedVariationScript }
  | { ok: false; error: string };

const SECTION_MARKER = /\[\[([^\]\r\n]+)\]\]|\{\{([^}\r\n]+)\}\}/g;

/**
 * Supports [[HOOK 1]], [[BODY 2]], [[CTA 1]] (or {{HOOK 1}}).
 * Sections must be numbered consecutively from 1; ordering in the paste
 * doesn't matter because the recorder uses Hook -> Body -> CTA order.
 */
export function parseVariationScript(source: string): ScriptParseResult {
  const scripts: Record<string, string> = {};
  const positions: Record<ScriptSegmentKind, Set<number>> = {
    hook: new Set(), body: new Set(), cta: new Set(),
  };
  const markers = Array.from(source.matchAll(SECTION_MARKER));

  if (!markers.length) {
    return { ok: false, error: "Add section headings such as [[HOOK 1]], [[BODY 1]], and [[CTA 1]]." };
  }
  if (source.slice(0, markers[0].index).trim()) {
    return { ok: false, error: "Put all spoken text under a section heading. There is text before the first heading." };
  }

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const heading = (marker[1] || marker[2]).trim().match(/^(hook|body|cta)\s*(\d+)$/i);
    if (!heading) {
      return { ok: false, error: `Unrecognized section ${marker[0]}. Use [[HOOK 1]], [[BODY 1]], or [[CTA 1]].` };
    }

    const kind = heading[1].toLowerCase() as ScriptSegmentKind;
    const position = Number(heading[2]);
    if (!Number.isSafeInteger(position) || position < 1 || position > MAX_SCRIPT_VARIATIONS_PER_GROUP) {
      return { ok: false, error: `${kind.toUpperCase()} numbers must be between 1 and ${MAX_SCRIPT_VARIATIONS_PER_GROUP}.` };
    }
    if (positions[kind].has(position)) {
      return { ok: false, error: `${kind.toUpperCase()} ${position} appears more than once.` };
    }

    const start = marker.index! + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index! : source.length;
    const text = source.slice(start, end).trim();
    if (!text) {
      return { ok: false, error: `${kind.toUpperCase()} ${position} has no script text.` };
    }
    scripts[`${kind}:${position}`] = text;
    positions[kind].add(position);
  }

  const counts = { hook: 0, body: 0, cta: 0 };
  for (const kind of SCRIPT_SEGMENT_KINDS) {
    const numbers = Array.from(positions[kind]).sort((a, b) => a - b);
    if (!numbers.length) {
      return { ok: false, error: `Add at least one [[${kind.toUpperCase()} 1]] section.` };
    }
    if (numbers.some((number, index) => number !== index + 1)) {
      return { ok: false, error: `Number ${kind.toUpperCase()} sections consecutively starting at 1 (no gaps).` };
    }
    counts[kind] = numbers.length;
  }

  return { ok: true, value: { scripts, counts } };
}
