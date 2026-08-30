"use client";

import { PanelView } from "../../panel-view";

export function CustomDashboard({ dashboardId }: { dashboardId: string }) {
  return <PanelView panelId={dashboardId} />;
}
