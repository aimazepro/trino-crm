"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  WifiOff,
  Wifi,
  CircleCheck,
  RefreshCw,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SyncType = "bidirecional" | "unidirecional";

export default function CalendarioPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [syncType, setSyncType] = useState<SyncType>("bidirecional");
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [isSynced, setIsSynced] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Load connected integration from Supabase & URL search params
  useEffect(() => {
    let isMounted = true;

    async function loadIntegration() {
      const urlParams = new URLSearchParams(window.location.search);
      const connectedFlag = urlParams.get("calendar_connected");
      const errorFlag = urlParams.get("calendar_error");
      const emailParam = urlParams.get("email");

      // Check user session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let integ: { account_email?: string | null; sync_type?: string | null; last_synced_at?: string | null } | null = null;

      if (user) {
        const { data } = await supabase
          .from("integrations")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", "google_calendar")
          .eq("active", true)
          .maybeSingle();
        integ = data;

        if (integ && isMounted) {
          setIsConnected(true);
          setAccountEmail(integ.account_email || "pixeoholding@gmail.com");
          setSelectedCalendar(integ.account_email || "pixeoholding@gmail.com");
        }
      }

      // Handle OAuth redirect flags
      if (connectedFlag === "1" && isMounted) {
        setIsConnected(true);
        const email = emailParam || "pixeoholding@gmail.com";
        setAccountEmail(email);
        setSelectedCalendar(email);
        setBannerSuccess("Calendario conectado com sucesso!");

        // Clean query params from URL
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("calendar_connected");
        cleanUrl.searchParams.delete("email");
        window.history.replaceState({}, "", cleanUrl.toString());
      } else if (errorFlag && isMounted) {
        setBannerError("Erro ao conectar Google Calendar. Tente novamente.");
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("calendar_error");
        window.history.replaceState({}, "", cleanUrl.toString());
      }

      if (integ?.sync_type === "bidirecional" || integ?.sync_type === "unidirecional") {
        setSyncType(integ.sync_type);
      }
      if (integ?.last_synced_at) {
        setLastSyncTime(new Date(integ.last_synced_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        setIsSynced(true);
      }

      if (isMounted) setLoading(false);
    }

    loadIntegration();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Handle OAuth Redirect Initiation
  const handleConnect = () => {
    window.location.href = "/api/auth/google-calendar";
  };

  // Sync execution
  const handleSyncNow = async () => {
    setSyncing(true);
    setBannerSuccess(null);
    setBannerError(null);

    try {
      const res = await fetch("/api/calendar/sync-now", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "sync failed");

      const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setIsSynced(true);
      setLastSyncTime(nowTime);
      setBannerSuccess(`Sincronização concluída às ${nowTime} — ${data.pulled} atualizados do Google, ${data.pushed} enviados pro Google.`);
    } catch (e) {
      console.error("[calendar] sync-now failed:", e);
      setBannerError("Falha ao sincronizar agenda. Verifique suas credenciais.");
    } finally {
      setSyncing(false);
    }
  };

  // Select sync mode
  const handleSelectSyncType = (type: SyncType) => {
    setSyncType(type);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("integrations").update({ sync_type: type })
        .eq("user_id", user.id).eq("provider", "google_calendar")
        .then(({ error }) => { if (error) console.error("[calendar] sync_type update failed:", error); });
    });
  };

  // Disconnect Google Calendar
  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("integrations")
          .delete()
          .eq("user_id", user.id)
          .eq("provider", "google_calendar");
      }
    } catch (e) {
      console.error("Error disconnecting calendar", e);
    } finally {
      setIsConnected(false);
      setAccountEmail("");
      setIsSynced(false);
      setLastSyncTime(null);
      localStorage.removeItem("gcal_last_sync_time");
      setBannerSuccess(null);
      setBannerError(null);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto bg-zinc-50/30">
        <div className="max-w-2xl mx-auto py-10 px-6">
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
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-zinc-400">
            Carregando configurações do calendário...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-2xl mx-auto py-10 px-6">
        {/* Header */}
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

        {/* Success Banner */}
        {bannerSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-6">
            <div className="flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-800">{bannerSuccess}</p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {bannerError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm font-medium text-red-800">{bannerError}</p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {!isConnected ? (
            /* ── DISCONNECTED STATE ── */
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
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Calendar className="h-4 w-4" />
                Conectar Google Calendar
              </button>
            </div>
          ) : (
            /* ── CONNECTED STATE ── */
            <div className="space-y-5">
              {/* Connected Header */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Calendario conectado</p>
                  <p className="text-sm text-zinc-500">{accountEmail}</p>
                </div>
                <CircleCheck className="h-5 w-5 text-green-500 ml-auto" />
              </div>

              {/* Calendar for syncing */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Calendario para sincronizar
                </label>
                <select
                  value={selectedCalendar}
                  onChange={(e) => setSelectedCalendar(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                >
                  <option value={accountEmail}>
                    {accountEmail || "pixeoholding@gmail.com"} (Principal)
                  </option>
                </select>
              </div>

              {/* Sync type options */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Tipo de sincronizacao
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectSyncType("bidirecional")}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors cursor-pointer",
                      syncType === "bidirecional"
                        ? "border-orange-500 bg-orange-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    )}
                  >
                    <p className="text-sm font-medium text-zinc-900">Bidirecional</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      CRM ↔ Calendar. Atividades sincronizam nos dois sentidos.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSyncType("unidirecional")}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors cursor-pointer",
                      syncType === "unidirecional"
                        ? "border-orange-500 bg-orange-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    )}
                  >
                    <p className="text-sm font-medium text-zinc-900">Unidirecional</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      CRM → Calendar. So atividades do CRM vao pro calendario.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sync status card */}
              <div className="rounded-lg border p-3 flex items-center gap-3 bg-zinc-50 border-zinc-200">
                <CircleCheck
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isSynced ? "text-green-500" : "text-zinc-300"
                  )}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-700">
                    {isSynced ? "Sincronizado" : "Ainda nao sincronizado"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {isSynced
                      ? `Última sincronização às ${lastSyncTime || "recentemente"}.`
                      : "Clique em sincronizar para puxar os eventos da sua agenda."}
                  </p>
                </div>
              </div>

              {/* Sync Action Button */}
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing
                  ? "Sincronizando..."
                  : isSynced
                  ? "Sincronizar novamente"
                  : "Sincronizar agora"}
              </button>

              {/* Disconnect Action Footer */}
              <div className="flex items-center justify-end pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto cursor-pointer"
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
