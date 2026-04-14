"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Company } from "@/lib/crm-types";
import { useCrm } from "@/contexts/crm-context";
import { InlineEdit } from "./inline-edit";
import Link from "next/link";

interface CompanyAccordionProps {
  company: Company;
}

export function CompanyAccordion({ company }: CompanyAccordionProps) {
  const { updateCompany } = useCrm();
  const [isOpen, setIsOpen] = useState(true);

  const handleUpdate = (field: keyof Company, v: string) => {
    updateCompany(company.id, { [field]: v });
  };

  return (
    <div className="bg-amber-50/40 border border-amber-100/60 rounded-2xl p-4 shadow-sm space-y-4 transition-all">
      <div 
        className="flex items-center gap-2 cursor-pointer hover:text-orange-600 select-none text-gray-900"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <h3 className="text-sm font-bold">Empresa</h3>
      </div>

      {isOpen && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          
          <Link 
            href={`/empresas/${company.id}`}
            className="flex items-center gap-3 group/link rounded-xl p-2 -mx-2 hover:bg-orange-50 transition-colors"
            onClick={e => e.stopPropagation()}
          >
             <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-sm shrink-0">
               {company.name.charAt(0).toUpperCase()}
             </div>
             <span className="font-bold text-sm text-gray-900 group-hover/link:text-orange-600 transition-colors line-clamp-2 leading-tight">
               {company.name}
             </span>
          </Link>

          <div className="space-y-2 pt-2">
             <div className="flex items-center text-sm">
                <span className="text-gray-400 w-24 shrink-0">Website</span>
                <InlineEdit value={company.website || ""} onSave={(v) => handleUpdate("website", v)} />
             </div>
             <div className="flex items-center text-sm">
                <span className="text-gray-400 w-24 shrink-0">Segmento</span>
                <InlineEdit value={company.segment || ""} onSave={(v) => handleUpdate("segment", v)} />
             </div>
             <div className="flex items-center text-sm">
                <span className="text-gray-400 w-24 shrink-0">Porte</span>
                <InlineEdit value={company.size || ""} onSave={(v) => handleUpdate("size", v)} />
             </div>
             <div className="flex items-center text-sm">
                <span className="text-gray-400 w-24 shrink-0">Cidade</span>
                <InlineEdit value={company.city || ""} onSave={(v) => handleUpdate("city", v)} />
             </div>
             <div className="flex items-center text-sm">
                <span className="text-gray-400 w-24 shrink-0">Estado</span>
                <InlineEdit value={company.state || ""} onSave={(v) => handleUpdate("state", v)} />
             </div>
             <div className="flex items-center text-sm">
                <span className="text-gray-400 w-24 shrink-0">CNPJ</span>
                <InlineEdit value={company.cnpj || ""} onSave={(v) => handleUpdate("cnpj", v)} />
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
