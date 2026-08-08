"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useCrm } from "@/contexts/crm-context";
import { useOwnerNameMap } from "@/hooks/use-owner-name-map";
import { createClient } from "@/lib/supabase/client";
import { transformDeal } from "@/lib/crm-transforms";
import type { Deal } from "@/lib/crm-types";
import { DealSidebar } from "@/components/deal/deal-sidebar";
import { DealTabs } from "@/components/deal/deal-tabs";
import { LossReasonModal } from "@/components/deal/loss-reason-modal";
import { DeleteDealModal } from "@/components/deal/delete-deal-modal";
import { MergeDealModal } from "@/components/deal/merge-deal-modal";
import { PipelineSwitchDropdown } from "@/components/deal/pipeline-switch-dropdown";
import {
  ArrowLeft, MoreVertical, Trophy, CircleX, CircleCheck, Trash2, Play, Edit2, X,
  Copy, GitMerge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    state, loading, markDealStatus, moveDeal, moveDealToPipeline,
    deleteDeal, restoreDeal, duplicateDeal, updateDealFields,
  } = useCrm();
  const { map: ownerNameMap } = useOwnerNameMap();

  const [showLossModal, setShowLossModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const deal = state.deals.find(d => d.id === id);
  const pipeline = state.pipelines.find(p => p.id === deal?.pipelineId);
  const company = state.companies.find(c => c.id === deal?.companyId);

  // Fallback for deals soft-deleted in a different session: crm-loader.ts
  // excludes deleted_at rows from the initial fetch, so `state.deals` never
  // has them after a fresh page load. Fetch the row directly (ignoring the
  // deleted_at filter) and render it read-only instead of "não encontrado".
  const [orphanDeal, setOrphanDeal] = useState<Deal | null>(null);
  const [orphanChecked, setOrphanChecked] = useState(false);
  const [restoringOrphan, setRestoringOrphan] = useState(false);

  useEffect(() => {
    if (deal || loading) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("deals").select(`
        *, deal_notes(*), deal_history(*), deal_products(*),
        deal_labels(label_id), activities(*, activity_attachments(*)), appointments(*)
      `).eq("id", id).maybeSingle();
      if (cancelled) return;
      setOrphanDeal(data ? transformDeal(data) : null);
      setOrphanChecked(true);
    })();
    return () => { cancelled = true; };
  }, [deal, loading, id]);

  const [titleValue, setTitleValue] = useState("");

  useEffect(() => {
    if (deal) {
      setTitleValue(deal.title);
    }
  }, [deal?.title]);

  if (!deal || !pipeline) {
    if (orphanDeal?.deletedAt) {
      const orphanCompany = state.companies.find(c => c.id === orphanDeal.companyId);
      const orphanContact = state.contacts.find(c => c.id === orphanDeal.contactId);
      return (
        <div className="flex flex-col items-center justify-center flex-1 h-full animate-in fade-in gap-4 px-6">
          <div className="w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">{orphanDeal.title}</p>
                <p className="mt-1 text-sm text-amber-900">
                  Excluído em <strong>{new Date(orphanDeal.deletedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</strong>
                  {ownerNameMap[orphanDeal.deletedBy ?? ""] && <> por <strong>{ownerNameMap[orphanDeal.deletedBy ?? ""]}</strong></>}
                </p>
                <p className="mt-0.5 text-sm text-amber-900">
                  <span className="font-medium">Motivo:</span> <strong>{orphanDeal.deleteReason}</strong>
                  {orphanDeal.deleteNote && <> — {orphanDeal.deleteNote}</>}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  {(orphanCompany?.name || orphanContact?.name) && <>{orphanCompany?.name || orphanContact?.name} · </>}
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orphanDeal.value)}
                </p>
              </div>
            </div>
            <button
              disabled={restoringOrphan}
              onClick={() => {
                setRestoringOrphan(true);
                restoreDeal(orphanDeal.id);
                // orphanDeal isn't tracked in CrmProvider's state (it was
                // fetched directly, bypassing the deleted_at-filtered load),
                // so a full reload is needed to pick it up post-restore.
                window.location.reload();
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              {restoringOrphan ? "Restaurando..." : "Restaurar"}
            </button>
          </div>
          <Link href="/negocios" className="px-6 py-2 bg-amber-500 text-white rounded-xl">
            Voltar para o Kanban
          </Link>
        </div>
      );
    }

    if (!orphanChecked && !loading) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 h-full animate-in fade-in">
          <p className="text-sm text-zinc-400">Carregando...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full animate-in fade-in">
        <h2 className="text-xl font-bold mb-4">Negócio não encontrado</h2>
        <Link href="/negocios" className="px-6 py-2 bg-amber-500 text-white rounded-xl">
          Voltar para o Kanban
        </Link>
      </div>
    );
  }

  const handleTitleBlur = () => {
    if (titleValue.trim() && titleValue !== deal.title) {
      updateDealFields(deal.id, { title: titleValue });
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setTitleValue(deal.title);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in bg-white overflow-hidden">

      {deal.deletedAt && (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 shrink-0">
          <div className="flex flex-wrap items-start gap-3">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-amber-900">
                Este negócio foi excluído em <strong>{new Date(deal.deletedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</strong>
                {ownerNameMap[deal.deletedBy ?? ""] && <> por <strong>{ownerNameMap[deal.deletedBy ?? ""]}</strong></>}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-amber-900">
                <span><span className="font-medium">Motivo:</span> <strong>{deal.deleteReason}</strong></span>
                {deal.deleteNote && <span><span className="font-medium">Observação:</span> {deal.deleteNote}</span>}
              </p>
              <p className="mt-0.5 text-xs text-amber-800">Somente consulta, restaure para editar.</p>
            </div>
            <button
              onClick={() => restoreDeal(deal.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
            >
              Restaurar
            </button>
          </div>
        </div>
      )}

      <div className={cn("flex flex-col flex-1 min-h-0", deal.deletedAt && "pointer-events-none opacity-60")}>

      {/* Header Profile Area */}
      <div className="flex items-center gap-3 bg-white px-6 py-4 border-b border-zinc-100 shrink-0">
        <Link href="/negocios" className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors pointer-events-auto">
          <ArrowLeft size={20} />
        </Link>
        
        <div className="flex-1 min-w-0">
          <input 
            type="text"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="text-base font-semibold text-zinc-800 truncate bg-transparent outline-none border-b border-transparent hover:border-zinc-200 focus:border-amber-400 w-full transition-colors"
          />
          
          {/* Pipeline & stage switcher */}
          <PipelineSwitchDropdown
            deal={deal}
            pipelines={state.pipelines}
            onMoveStage={(stageId) => moveDeal(deal.id, stageId)}
            onMovePipeline={(pipelineId, stageId) => moveDealToPipeline(deal.id, pipelineId, stageId)}
          />
        </div>

        {/* Owner Info */}
        <div className="relative flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-amber-700">
                {(ownerNameMap[deal.ownerId ?? ""] || "?")[0].toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-zinc-700 leading-tight">{ownerNameMap[deal.ownerId ?? ""] || "—"}</p>
              <p className="text-xs text-zinc-400">Proprietário</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {deal.status === "Ativo" && (
            <>
              <button 
                onClick={() => setShowLossModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors bg-white"
              >
                <CircleX size={16} className="h-4 w-4" /> Perdido
              </button>
              <button 
                onClick={() => markDealStatus(deal.id, "Ganho")}
                className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 transition-colors"
              >
                <CircleCheck size={16} className="h-4 w-4" /> Ganho
              </button>
            </>
          )}

          {deal.status !== "Ativo" && (
            <>
              <div className={cn(
                 "px-3 py-1.5 font-medium text-sm rounded-lg flex items-center gap-1.5 border", 
                 deal.status === "Ganho" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
              )}>
                 {deal.status === "Ganho" ? <Trophy size={16} className="h-4 w-4" /> : <CircleX size={16} className="h-4 w-4" />}
                 NEGÓCIO {deal.status.toUpperCase()}
              </div>
              <button 
                onClick={() => markDealStatus(deal.id, "Ativo")}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors bg-white"
              >
                <Play size={16} className="h-4 w-4" /> Reabrir
              </button>
            </>
          )}
        </div>

        {/* More Actions Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)} 
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-50 transition-colors"
          >
             <MoreVertical size={16} />
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-zinc-200 rounded-xl z-50 p-1">
              <button
                disabled={duplicating}
                onClick={async () => {
                  setShowDropdown(false);
                  setDuplicating(true);
                  const newId = await duplicateDeal(deal.id);
                  setDuplicating(false);
                  if (newId) router.push(`/negocios/${newId}`);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded-lg disabled:opacity-50"
              >
                <Copy size={16} /> {duplicating ? "Duplicando..." : "Duplicar negócio"}
              </button>
              <button
                onClick={() => { setShowDropdown(false); setShowMergeModal(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 rounded-lg"
              >
                <GitMerge size={16} /> Mesclar negócios
              </button>
              <button
                onClick={() => { setShowDropdown(false); setShowDeleteModal(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold"
              >
                <Trash2 size={16} /> Excluir negócio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visual Pipeline Stages Strip */}
      <div className="bg-white px-6 py-3 border-b border-zinc-100 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
           {pipeline.stages.map((stage) => {
              const isActive = stage.id === deal.stageId;
              const canMove = deal.status === "Ativo";
              return (
                <button
                  key={stage.id}
                  onClick={() => canMove && moveDeal(deal.id, stage.id)}
                  disabled={!canMove}
                  className={cn(
                    "flex-1 min-w-[80px] rounded-lg px-3 py-1.5 text-xs font-medium transition-all text-center truncate",
                    isActive 
                      ? "bg-zinc-900 text-white" 
                      : "bg-white text-zinc-400 border border-zinc-200 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {stage.name}
                </button>
              )
           })}
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden w-full relative">
         <DealSidebar dealId={deal.id} />
         <DealTabs dealId={deal.id} />
      </div>

      </div>

      {showLossModal && (
        <LossReasonModal
          onConfirm={(reason) => {
            markDealStatus(deal.id, "Perdido", reason);
            setShowLossModal(false);
          }}
          onCancel={() => setShowLossModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteDealModal
          onConfirm={(reason, note) => {
            deleteDeal(deal.id, reason, note);
            setShowDeleteModal(false);
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showMergeModal && (
        <MergeDealModal
          currentDeal={deal}
          onMerged={() => setShowMergeModal(false)}
          onCancel={() => setShowMergeModal(false)}
        />
      )}

    </div>
  );
}
