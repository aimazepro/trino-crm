"use client";

import { use } from "react";
import { CustomDashboard } from "./custom-dashboard";

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomDashboard dashboardId={id} />;
}
