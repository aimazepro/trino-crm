"use client";

import { useState } from "react";
import { ChevronDown, ListTodo, ArrowRight, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Deal } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

export function AllTab({ deal }: { deal: Deal; userName?: string }) {
  const [activitiesOpen, setActivitiesOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);

  const pending = [...deal.activities]
    .filter(a => !a.completed)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <button onClick={() => setActivitiesOpen(v => !v)} className="flex items-center gap-2 mb-3">
          <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !activitiesOpen && "-rotate-90")} />
          <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Próximas atividades</span>
        </button>
        {activitiesOpen && (
          pending.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 flex flex-col items-center justify-center py-10 text-center">
              <ListTodo className="h-8 w-8 text-zinc-200 mb-2" />
              <p className="text-sm text-zinc-500">Nenhuma atividade pendente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white border border-zinc-100 p-3.5">
                  <div className="shrink-0 rounded-full p-2 bg-zinc-100 text-zinc-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{a.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(a.date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <div>
        <button onClick={() => setTimelineOpen(v => !v)} className="flex items-center gap-2 mb-3">
          <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", !timelineOpen && "-rotate-90")} />
          <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Linha do tempo</span>
        </button>
        {timelineOpen && (
          <div className="space-y-6 pl-4 border-l-2 border-gray-100 ml-4 py-2">
            {deal.history.map(log => (
              <div key={log.id} className="relative">
                <div className="absolute -left-[27px] top-0 w-8 h-8 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center border-4 border-white">
                  <ArrowRight size={14} className="opacity-70" />
                </div>
                <div className="pl-6">
                  <h5 className="font-bold text-gray-900 text-sm">{log.description}</h5>
                  {log.subtext && <p className="text-sm text-gray-500 mt-0.5">{log.subtext}</p>}
                  <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            {deal.history.length === 0 && (
              <p className="pl-6 text-sm text-gray-400 font-medium">Nenhum evento registrado ainda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
