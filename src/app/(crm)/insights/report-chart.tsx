"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import type { SavedReport } from "./insights-constants";

export const STACKED_SERIES_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

function stackedSeriesKeys(data: { name: string; value: number; [k: string]: string | number | undefined }[]): string[] {
  const keys = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((k) => {
      if (k !== "name" && k !== "value" && k !== "fullName" && typeof row[k] === "number") keys.add(k);
    });
  });
  return Array.from(keys);
}

export function ReportChart({ chartType, data, color }: { chartType: SavedReport["chartType"]; data: { name: string; value: number; [k: string]: string | number | undefined }[]; color: string }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-48 text-sm text-zinc-400">Nenhum dado encontrado</div>;
  if (chartType === "number") {
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <span className="text-sm font-medium text-zinc-500 uppercase">Total</span>
        <span className="text-7xl font-extrabold mt-2" style={{ color }}>{total}</span>
      </div>
    );
  }
  if (chartType === "pie") {
    return (
      <div style={{ width: "100%", height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
              {data.map((_, idx) => <Cell key={idx} fill={idx === 0 ? color : STACKED_SERIES_COLORS[idx % STACKED_SERIES_COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chartType === "funnel") {
    return (
      <div style={{ width: "100%", height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 120, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
            <Tooltip /><Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  if (chartType === "stacked") {
    const seriesKeys = stackedSeriesKeys(data);
    if (seriesKeys.length === 0) {
      // sem séries nomeadas nesse dataset — cai pro bar simples de "value"
      return (
        <div style={{ width: "100%", height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip /><Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return (
      <div style={{ width: "100%", height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip /><Legend />
            {seriesKeys.map((key, idx) => (
              <Bar key={key} dataKey={key} stackId="a" fill={STACKED_SERIES_COLORS[idx % STACKED_SERIES_COLORS.length]} radius={idx === seriesKeys.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, bottom: 40, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip /><Legend />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
