export const TOKENS_PER_HEAT_LEVEL = 10_000_000;
export const MAX_HEAT_LEVEL = 10;

export function getTokenHeatLevel(totalTokens: number): number {
  if (totalTokens <= 0) return 0;
  return Math.min(MAX_HEAT_LEVEL, Math.ceil(totalTokens / TOKENS_PER_HEAT_LEVEL));
}
