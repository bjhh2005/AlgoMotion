export const SPLIT_STORAGE_KEY = "algomotion-knowledge-split-ratio";
export const DEFAULT_SPLIT_RATIO = 0.62;
export const SPLIT_HANDLE_WIDTH = 10;

export function readStoredSplitRatio(): number {
  try {
    const saved = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (!saved) return DEFAULT_SPLIT_RATIO;
    const value = Number(saved);
    if (Number.isFinite(value) && value > 0.2 && value < 0.85) return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_SPLIT_RATIO;
}

export function getSplitGridColumns(leftRatio: number): string {
  return `${leftRatio * 100}% ${SPLIT_HANDLE_WIDTH}px minmax(0, 1fr)`;
}
