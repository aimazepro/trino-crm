"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  WifiOff,
  Wifi,
  CircleCheck,
  Trash2,
} from "lucide-react";

type SyncType = "bidirecional" | "unidirecional";
type PageState = "disconnected" | "connected" | "synced";

const GOOGLE_OAUTH_CALENDAR_URL = "/api/auth/google-calendar";

const MOCK_CALENDARS = [
  { id: "klarynha21@gmail.com", label: "klarynha21@gmail.com" },
  {
    id: "pt.brazilian#holiday@group.v.calendar.google.com",
    label: "Feriados no Brasil",
  },
  {
    id: "family10966457121197933005@group.calendar.google.com",
    label: "Family",
  },
  { id: "jpotempla@gmail.com", label: "jpotempla@gmail.com (Principal)" },
];

export default function CalendarioPage() {
  const [pageState, setPageState] = useState<PageState>("disconnected");
  const [connectedEmail, setConnectedEmail] = useState("jpotempla@gmail.com");
  const [selectedCalendar, setSelectedCalendar] = useState(MOCK_CALENDARS[0].id);
  const [syncType, setSyncType] = useState<SyncType>("bidirecional");
  const [banner, setBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [changingConfig, setChangingConfig] = useState(false);

  // Check URL params for OAuth callback simulation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "1") {
      const email = params.get("email") || "usuario@gmail.com";
      setConnectedEmail(email);
      setPageState("connected");
      setBanner("Calendario conectado com sucesso!");
      const url = new URL(window.location.href);
      url.searchParams.delete("calendar_connected");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const showBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  const handleConnect = () => {
    window.location.href = GOOGLE_OAUTH_CALENDAR_URL;
  };

  const handleStartSync = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 800));
    setSyncing(false);
    setPageState("synced");
    showBanner("Sincronizacao iniciada! 0 eventos importados.");
  };

  const handleDisconnect = () => {
    setPageState("disconnected");
    setBanner(null);
  };

  const handleChangeConfig = () => {
    setChangingConfig(true);
    setPageState("connected");
    setBanner(null);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-2xl mx-auto py-10 px-6">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Calendario</h1>
            <p className="text-sm text-zinc-500">
              Sincronize suas atividades com o Google Calendar
            </p>
          </div>
        </div>

        {/* Success/Info Banner */}
        {banner && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-6">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">{banner}</p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">

          {/* ── DISCONNECTED ── */}
          {pageState === "disconnected" && (
            <div className="text-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto">
                <WifiOff className="h-8 w-8 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">Calendario nao conectado</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Conecte seu Google Calendar para sincronizar atividades
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Conectar Google Calendar
              </button>
            </div>
          )}

          {/* ── CONNECTED (config before sync) ── */}
          {(pageState === "connected" || pageState === "synced") && (
            <div className="space-y-5">
              {/* Connected header */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Calendario conectado</p>
                  <p className="text-sm text-zinc-500">{connectedEmail}</p>
                </div>
                <CircleCheck className="h-5 w-5 text-green-500 ml-auto" />
              </div>

              {/* Calendar selector */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Calendario para sincronizar
                </label>
                <select
                  value={selectedCalendar}
                  onChange={(e) => setSelectedCalendar(e.target.value)}
                  disabled={pageState === "synced" && !changingConfig}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none disabled:opacity-60"
                >
                  {MOCK_CALENDARS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sync type */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Tipo de sincronizacao
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSyncType("bidirecional")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      syncType === "bidirecional"
                        ? "border-orange-500 bg-orange-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-900">Bidirecional</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      CRM ↔ Calendar. Atividades sincronizam nos dois sentidos.
                    </p>
                  </button>
                  <button
                    onClick={() => setSyncType("unidirecional")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      syncType === "unidirecional"
                        ? "border-orange-500 bg-orange-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-900">Unidirecional</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      CRM → Calendar. So atividades do CRM vao pro calendario.
                    </p>
                  </button>
                </div>
              </div>

              {/* Synced status indicator OR start sync button */}
              {pageState === "synced" ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-green-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Sincronizacao ativa</p>
                    <p className="text-xs text-green-600">
                      Modo:{" "}
                      {syncType === "bidirecional" ? "Bidirecional" : "Unidirecional"}
                    </p>
                  </div>
                  <button
                    onClick={handleChangeConfig}
                    className="text-xs text-green-700 underline hover:text-green-900"
                  >
                    Alterar configuracoes
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartSync}
                  disabled={syncing}
                  className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  {syncing ? "Iniciando..." : "Iniciar sincronizacao"}
                </button>
              )}

              {/* Disconnect */}
              <div className="flex items-center justify-end pt-2 border-t border-zinc-100">
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Desconectar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
