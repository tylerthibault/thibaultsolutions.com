/** Editor-friendly Creative Circle recording and export choices. */
export type RecordingFrameRate = 30 | 60;
export const DEFAULT_RECORDING_FPS: RecordingFrameRate = 30;
export const QUICK_EXPORT_WIDTH = 1080;
export const QUICK_EXPORT_HEIGHT = 1920;

/** Never manufacture 60 FPS from recordings that are only 30 FPS. */
export function commonExportFrameRate(requested: RecordingFrameRate, sourceRates: string[]): RecordingFrameRate {
  if (requested !== 60 || !sourceRates.length) return 30;
  const enoughFrames = sourceRates.every((rate) => {
    const [numerator, denominator = "1"] = rate.split("/");
    const fps = Number(numerator) / Number(denominator);
    return Number.isFinite(fps) && fps >= 50;
  });
  return enoughFrames ? 60 : 30;
}

export function parseRecordingFrameRate(value: unknown): RecordingFrameRate | null {
  return value === "30" || value === 30 ? 30 : value === "60" || value === 60 ? 60 : null;
}
