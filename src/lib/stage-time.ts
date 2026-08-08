export function getDaysInStage(stageEnteredAt: string): number {
  const entered = new Date(stageEnteredAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - entered) / (1000 * 60 * 60 * 24)));
}

export type StageTimeColor = "neutral" | "yellow" | "red";

export function getStageTimeColor(daysInStage: number, maxDays: number): StageTimeColor {
  if (maxDays <= 0) return "neutral";
  if (daysInStage >= maxDays) return "red";
  if (daysInStage >= maxDays / 2) return "yellow";
  return "neutral";
}
