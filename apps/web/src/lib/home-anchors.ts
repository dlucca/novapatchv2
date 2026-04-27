export const HOME_ANCHORS = {
  products:   "productos",
  science:    "ciencia",
  comparison: "comparativa",
} as const;

export type HomeAnchor = keyof typeof HOME_ANCHORS;

/** Smooth-scrolls to the anchor section on the home page. Safe in SSR (no-op when window undefined). */
export function scrollToAnchor(anchor: HomeAnchor): void {
  if (typeof window === "undefined") return;
  const el = document.getElementById(HOME_ANCHORS[anchor]);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
