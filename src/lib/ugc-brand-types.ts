export const UGC_BRAND_STATUSES = ["NEW", "RESEARCH", "PITCH", "APPLIED", "FOLLOW_UP", "WON", "PASS"] as const;

export type UgcBrandStatus = typeof UGC_BRAND_STATUSES[number];

export const UGC_CLOSED_STATUSES = new Set<UgcBrandStatus>(["WON", "PASS"]);
