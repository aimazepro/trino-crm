"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Edit2, X } from "lucide-react";
import { Company } from "@/lib/crm-types";
import { useCrm } from "@/contexts/crm-context";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CompanyAccordionProps {
  company: Company;
  dealId?: string;
}

export function CompanyAccordion({ company, dealId }: CompanyAccordionProps) {
  const { updateCompany, updateDealFields } = useCrm();
  const [isOpen, setIsOpen] = useState(true);

  // Name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(company.name);

  // Inline editing state for details
  const [editingField, setEditingField] = useState<keyof Company | null>(null);
  const [tempValue, setTempValue] = useState("");

  const handleUpdate = (field: keyof Company, v: string) => {
    updateCompany(company.id, { [field]: v });
  };

  const renderFieldRow = (label: string, fieldKey: keyof Company) => {
    const isEditing = editingField === fieldKey;
    const value = (company[fieldKey] as string) || "";

    if (isEditing) {
      return (
        <div className="grid grid-cols-[72px_1fr] gap-x-2 py-2 border-b border-zinc-100 items-start last:border-b-0">
          <p className="text-xs text-zinc-500 pt-1.5">{label}</p>
          <div className="min-w-0">
            <div className="space-y-1.5">
              <input
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-full rounded-md border border-amber-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpdate(fieldKey, tempValue);
                    setEditingField(null);
                  }
                  if (e.key === "Escape") {
                    setEditingField(null);
                  }
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setEditingField(null)}
                  className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    handleUpdate(fieldKey, tempValue);
                    setEditingField(null);
                  }}
                  className="px-2.5 py-1 rounded text-xs text-white bg-green-600 hover:bg-green-700 font-medium"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-[72px_1fr] gap-x-2 py-2 border-b border-zinc-100 items-start last:border-b-0">
        <p className="text-xs text-zinc-500 pt-1.5">{label}</p>
        <div className="min-w-0">
          <div className="group flex items-center gap-1 -mx-2">
            <button
              className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors"
              onClick={() => {
                setTempValue(value);
                setEditingField(fieldKey);
              }}
            >
              <span className={value ? "text-sm text-zinc-800 font-medium break-words" : "text-sm text-zinc-300 group-hover:text-zinc-500"}>
                {value || "-"}
              </span>
            </button>
            <button
              onClick={() => {
                setTempValue(value);
                setEditingField(fieldKey);
              }}
              className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all hover:text-zinc-600"
            >
              <Edit2 size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl overflow-hidden bg-zinc-50">
      <div className="flex items-center">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 flex-1 px-4 py-3 hover:bg-zinc-100/80 transition-colors text-left"
        >
          <ChevronDown 
            size={16} 
            className={cn("text-zinc-500 transition-transform duration-200", !isOpen && "-rotate-90")} 
          />
          <span className="text-sm font-semibold text-zinc-800">Empresa</span>
        </button>
        <div className="flex items-center gap-0.5 pr-3">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditingName(!isEditingName); }}
            className="p-1.5 rounded-md text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 transition-colors"
            title="Editar nome"
          >
            <Edit2 size={14} />
          </button>
          {dealId && (
            <button 
              onClick={(e) => { e.stopPropagation(); updateDealFields(dealId, { companyId: undefined }); }}
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors"
              title="Desvincular empresa"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-4 py-1">
          {isEditingName ? (
            <div className="space-y-1.5 my-1">
              <input 
                value={tempName} 
                onChange={e => setTempName(e.target.value)} 
                className="w-full rounded-md border border-amber-300 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-200 font-semibold text-zinc-800 bg-white"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") { 
                    if (tempName.trim()) {
                      updateCompany(company.id, { name: tempName }); 
                    }
                    setIsEditingName(false); 
                  }
                  if (e.key === "Escape") { setIsEditingName(false); setTempName(company.name); }
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <button 
                  onClick={() => { setIsEditingName(false); setTempName(company.name); }} 
                  className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => { 
                    if (tempName.trim()) {
                      updateCompany(company.id, { name: tempName }); 
                    }
                    setIsEditingName(false); 
                  }} 
                  className="px-2.5 py-1 rounded text-xs text-white bg-green-600 hover:bg-green-700 font-medium"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <Link 
              href={`/empresas/${company.id}`}
              className="flex items-center gap-3 rounded-lg p-2 -mx-1 cursor-pointer hover:bg-amber-50/40 transition-colors my-1"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-semibold text-xs shrink-0">
                {company.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-zinc-800 break-words">{company.name}</p>
            </Link>
          )}

          <div className="space-y-0.5 pt-1">
            {renderFieldRow("Website", "website")}
            {renderFieldRow("Segmento", "segment")}
            {renderFieldRow("Porte", "size")}
            {renderFieldRow("Cidade", "city")}
            {renderFieldRow("Estado", "state")}
            {renderFieldRow("CNPJ", "cnpj")}
          </div>

        </div>
      )}
    </div>
  );
}
