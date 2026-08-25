import type { ReportConfig } from "./report-types/types";
export type { ReportConfig, ReportFilter } from "./report-types/types";

export interface SavedReport extends ReportConfig {
  id: string;
  name: string;
}

export const COLORS = [
  { name: "Pink", value: "#ec4899" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Emerald", value: "#22c55e" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Red", value: "#ef4444" },
];
