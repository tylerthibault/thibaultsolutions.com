export const HOMEPAGE_UGC_SLOTS = [
  { id: "hero", section: "Hero", title: "Hero UGC Video", description: "Primary phone video in the yellow hero." },
  { id: "featured-demo", section: "Featured UGC", title: "Product Demo", description: "Feature → use case → payoff." },
  { id: "featured-problem", section: "Featured UGC", title: "Problem → Solution", description: "Relatable pain + clear payoff." },
  { id: "featured-interview", section: "Featured UGC", title: "Interview Style", description: "Conversational product proof." },
  { id: "featured-lifestyle", section: "Featured UGC", title: "POV", description: "Viewer-first scenario + product use." },
  { id: "featured-software", section: "Featured UGC", title: "Testimonial", description: "Personal experience + honest opinion." },
  { id: "product-interview", section: "Physical Product UGC", title: "Interview", description: "Natural product introduction." },
  { id: "product-demo", section: "Physical Product UGC", title: "Product Demo", description: "Use case + payoff." },
  { id: "product-problem", section: "Physical Product UGC", title: "Problem → Solution", description: "Hook + proof + close." },
  { id: "software-pov", section: "Software + App UGC", title: "POV", description: "Problem-first software hook." },
  { id: "software-demo", section: "Software + App UGC", title: "Workflow Demo", description: "Screen + creator delivery." },
  { id: "software-transform", section: "Software + App UGC", title: "Transformation", description: "Before → after workflow story." },
  { id: "shop-demo", section: "Performance UGC", title: "Hook + Demo", description: "Fast product proof." },
  { id: "shop-objection", section: "Performance UGC", title: "Objection Handling", description: "Skepticism → proof." },
  { id: "shop-testimonial", section: "Performance UGC", title: "Creator Testimonial", description: "Personal reason + close." },
] as const;

export type HomepageUgcSlotId = (typeof HOMEPAGE_UGC_SLOTS)[number]["id"];

const slotIds = new Set<string>(HOMEPAGE_UGC_SLOTS.map((slot) => slot.id));

export function getHomepageUgcSlot(id: string) {
  return slotIds.has(id)
    ? HOMEPAGE_UGC_SLOTS.find((slot) => slot.id === id) ?? null
    : null;
}
