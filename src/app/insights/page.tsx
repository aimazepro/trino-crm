"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { useInsights } from "./insights-context";
import { DashboardGrid } from "./dashboard-grid";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const { state } = useCrm();
  const { selfName: selfOwnerName } = useOwnerNameMap();
  const {
    savedReports, loaded, seeding, seedError, createDefaultReports, dashboardName,
  } = useInsights();

  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [dateLabel, setDateLabel] = useState("Este mes");
  const [userFilter, setUserFilter] = useState("Todos os usuarios");

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // O painel só existe quando há relatórios salvos — sem isso a tela abre
  // direto no empty state ("Criar relatorios padrao"), que é o começo certo.
  const dashboardPopulated = savedReports.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) setShowDateDropdown(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) setShowUserDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hrefFor = (name: string, pipeline: string) => {
    const rep = savedReports.find((r) => r.name.toLowerCase().includes(name.toLowerCase()) && r.pipeline.toLowerCase().includes(pipeline.toLowerCase()));
    return rep ? `/insights/reports/${rep.id}` : "/insights/reports/new";
  };

  // ── cards fixos do painel "Meu Painel" (Prospecção) ──
  const prospeccaoPipeline = useMemo(() => state.pipelines.find((p) => p.name.toLowerCase().includes("prospec")) || state.pipelines[0], [state.pipelines]);
  const pipelineDeals = useMemo(() => (prospeccaoPipeline ? state.deals.filter((d) => d.pipelineId === prospeccaoPipeline.id) : []), [state.deals, prospeccaoPipeline]);
  const cardStats = useMemo(() => {
    if (!prospeccaoPipeline) return { leads: 0, decisor: 0, reunioes: 0, ganhos: 0 };
    const firstStage = prospeccaoPipeline.stages[0];
    const decisorStage = prospeccaoPipeline.stages.find((s) => s.name.toLowerCase().includes("decisor"));
    const reuniaoStage = prospeccaoPipeline.stages.find((s) => s.name.toLowerCase().includes("reuni"));
    return {
      leads: pipelineDeals.filter((d) => d.stageId === firstStage?.id && d.status === "Ativo").length,
      decisor: decisorStage ? pipelineDeals.filter((d) => d.stageId === decisorStage.id && d.status === "Ativo").length : 0,
      reunioes: reuniaoStage ? pipelineDeals.filter((d) => d.stageId === reuniaoStage.id && d.status === "Ativo").length : 0,
      ganhos: pipelineDeals.filter((d) => d.status === "Ganho").length,
    };
  }, [prospeccaoPipeline, pipelineDeals]);
  const funnelChartData = useMemo(() => {
    if (!prospeccaoPipeline) return [];
    return prospeccaoPipeline.stages.map((s) => ({ name: s.name.length > 18 ? s.name.slice(0, 17) + "..." : s.name, value: pipelineDeals.filter((d) => d.stageId === s.id && d.status === "Ativo").length }));
  }, [prospeccaoPipeline, pipelineDeals]);
  const openStageChartData = useMemo(() => {
    if (!prospeccaoPipeline) return [];
    return prospeccaoPipeline.stages.map((s) => ({ name: s.name, value: pipelineDeals.filter((d) => d.stageId === s.id && d.status === "Ativo").length })).filter((d) => d.value > 0);
  }, [prospeccaoPipeline, pipelineDeals]);
  const activityOwnerChartData = useMemo(() => {
    const activities = pipelineDeals.flatMap((d) => d.activities);
    return [{ name: selfOwnerName || "Sem dono", "Concluídas": activities.filter((a) => a.completed).length, "Pendentes": activities.filter((a) => !a.completed).length }];
  }, [pipelineDeals, selfOwnerName]);
  const mixActivityChartData = useMemo(() => {
    const activities = pipelineDeals.flatMap((d) => d.activities);
    const counts: Record<string, number> = {};
    activities.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return [{ name: selfOwnerName || "Sem dono", ...counts }];
  }, [pipelineDeals, selfOwnerName]);

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 flex flex-col">
      <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900">{dashboardName}</h1>
        <div className="flex items-center gap-3">
          <div className="relative" ref={dateDropdownRef}>
            <button
              onClick={() => setShowDateDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors"
            >
              <span className="text-zinc-800 font-medium">{dateLabel}</span>
            </button>
            {showDateDropdown && (
              <div className="absolute right-0 mt-1 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                {["Este mes", "Mes passado", "Ultimos 7 dias", "Ultimos 30 dias", "Todo o periodo"].map((label) => (
                  <button
                    key={label}
                    onClick={() => { setDateLabel(label); setShowDateDropdown(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors",
                      dateLabel === label && "bg-zinc-50 font-semibold text-emerald-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setShowUserDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 transition-colors"
            >
              <span className="text-zinc-800 font-medium">{userFilter}</span>
            </button>
            {showUserDropdown && (
              <div className="absolute right-0 mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 z-50">
                {["Todos os usuarios"].map((user) => (
                  <button
                    key={user}
                    onClick={() => { setUserFilter(user); setShowUserDropdown(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors",
                      userFilter === user && "bg-zinc-50 font-semibold text-emerald-700"
                    )}
                  >
                    {user}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <DashboardGrid
          dashboardPopulated={dashboardPopulated}
          loaded={loaded}
          seeding={seeding}
          seedError={seedError}
          onCreateDefaultReports={createDefaultReports}
          hrefFor={hrefFor}
          cardStats={cardStats}
          funnelChartData={funnelChartData}
          openStageChartData={openStageChartData}
          activityOwnerChartData={activityOwnerChartData}
          mixActivityChartData={mixActivityChartData}
        />
      </div>
    </div>
  );
}
