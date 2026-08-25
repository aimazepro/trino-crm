"use client";

import { use } from "react";
import { ReportViewer } from "./report-viewer";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReportViewer reportId={id} />;
}
