"use client";

import { useInsights } from "./insights-context";
import { PanelView } from "./panel-view";

export default function InsightsPage() {
  const { defaultPanelId, loaded } = useInsights();

  if (!loaded || !defaultPanelId) {
    return <div className="flex items-center justify-center py-20 text-sm text-zinc-400">Carregando painel...</div>;
  }
  return <PanelView panelId={defaultPanelId} />;
}
