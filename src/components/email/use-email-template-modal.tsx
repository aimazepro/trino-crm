"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, X, ExternalLink } from "lucide-react";

type Template = { id: string; name: string; subject: string; body: string };

const LS_KEY = "trino_crm_email_templates";

export function UseEmailTemplateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    try { setTemplates(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); } catch { /* ignore */ }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2 text-zinc-800 font-semibold text-base">
            <Mail className="h-4 w-4 text-amber-500" />
            Usar Template de Email
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center gap-3">
              <p className="text-sm text-zinc-400">Nenhum template criado ainda.</p>
              <button
                onClick={() => { onClose(); router.push("/configuracoes/templates-email"); }}
                className="text-sm text-amber-500 hover:text-amber-600 hover:underline inline-flex items-center gap-1"
              >
                Criar templates nas configurações
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    navigator.clipboard.writeText(t.body).catch(() => {});
                    onClose();
                  }}
                  className="w-full text-left rounded-xl border border-zinc-100 hover:border-amber-200 hover:bg-amber-50/30 px-4 py-3 transition-colors group"
                >
                  <p className="text-sm font-medium text-zinc-800 group-hover:text-amber-700">{t.name}</p>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{t.subject}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
