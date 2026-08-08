"use client";

import { useState, useMemo } from "react";
import { Search, Users2, Building2, Merge, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrm } from "@/contexts/crm-context";
import type { Contact, Company } from "@/lib/crm-types";

type Tab = "contatos" | "empresas";

/** Why two records were grouped, shown so the user can judge before merging. */
type MatchReason = "email" | "telefone" | "nome" | "cnpj" | "site";

type Group<T> = {
  key: string;
  reasons: MatchReason[];
  records: T[];
};

const REASON_LABELS: Record<MatchReason, string> = {
  email: "mesmo e-mail",
  telefone: "mesmo telefone",
  nome: "mesmo nome",
  cnpj: "mesmo CNPJ",
  site: "mesmo site",
};

const normalizeText = (value: string | undefined | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeEmail = (value: string) => normalizeText(value);

/** Compare the last 8 digits so "+55 11 91234-5678" and "91234-5678" match. */
const normalizePhone = (value: string) => {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
};

const normalizeCnpj = (value: string | undefined) => {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
};

/** "https://www.acme.com.br/contato" -> "acme.com.br" */
const normalizeDomain = (value: string | undefined) => {
  const raw = normalizeText(value);
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
};

/**
 * Groups records that share any signal, transitively: if A shares an email with
 * B and B shares a phone with C, all three land in one group.
 */
function buildGroups<T extends { id: string }>(
  records: T[],
  signalsOf: (record: T) => { reason: MatchReason; value: string }[]
): Group<T>[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id);
    if (p === undefined || p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  records.forEach((r) => parent.set(r.id, r.id));

  // signal -> first record that produced it
  const seen = new Map<string, string>();
  const reasonsByRoot = new Map<string, Set<MatchReason>>();
  const pendingReasons: { a: string; b: string; reason: MatchReason }[] = [];

  for (const record of records) {
    for (const { reason, value } of signalsOf(record)) {
      if (!value) continue;
      const signal = `${reason}:${value}`;
      const existing = seen.get(signal);
      if (existing === undefined) {
        seen.set(signal, record.id);
        continue;
      }
      union(existing, record.id);
      pendingReasons.push({ a: existing, b: record.id, reason });
    }
  }

  // Resolve reasons only after all unions, so roots are final.
  for (const { a, reason } of pendingReasons) {
    const root = find(a);
    if (!reasonsByRoot.has(root)) reasonsByRoot.set(root, new Set());
    reasonsByRoot.get(root)!.add(reason);
  }

  const byRoot = new Map<string, T[]>();
  for (const record of records) {
    const root = find(record.id);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root)!.push(record);
  }

  return [...byRoot.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([root, group]) => ({
      key: root,
      reasons: [...(reasonsByRoot.get(root) ?? [])],
      records: group,
    }));
}

export default function DuplicatasPage() {
  const {
    state,
    updateContact,
    deleteContact,
    updateCompany,
    deleteCompany,
    updateDealFields,
  } = useCrm();

  const [activeTab, setActiveTab] = useState<Tab>("contatos");
  const [checked, setChecked] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergedKeys, setMergedKeys] = useState<Set<string>>(new Set());

  const contactGroups = useMemo(
    () =>
      buildGroups<Contact>(state.contacts, (c) => [
        ...c.emails.map((e) => ({ reason: "email" as const, value: normalizeEmail(e.value) })),
        ...c.phones.map((p) => ({ reason: "telefone" as const, value: normalizePhone(p.value) })),
        { reason: "nome" as const, value: normalizeText(c.name) },
      ]),
    [state.contacts]
  );

  const companyGroups = useMemo(
    () =>
      buildGroups<Company>(state.companies, (c) => [
        { reason: "cnpj" as const, value: normalizeCnpj(c.cnpj) },
        { reason: "site" as const, value: normalizeDomain(c.website) },
        { reason: "nome" as const, value: normalizeText(c.name) },
      ]),
    [state.companies]
  );

  const groups: Group<Contact | Company>[] =
    activeTab === "contatos" ? contactGroups : companyGroups;
  const visibleGroups = groups.filter((g) => !mergedKeys.has(g.key));

  /** Keeps `primary`, repoints everything that referenced the others, deletes them. */
  const handleMerge = async (group: Group<Contact | Company>) => {
    setMerging(group.key);
    const [primary, ...duplicates] = group.records;
    const duplicateIds = new Set(duplicates.map((d) => d.id));

    if (activeTab === "contatos") {
      const primaryContact = primary as Contact;
      const dupContacts = duplicates as Contact[];

      // Union emails/phones so no contact detail is lost in the merge.
      const emails = [...primaryContact.emails];
      const phones = [...primaryContact.phones];
      for (const dup of dupContacts) {
        for (const e of dup.emails) {
          if (!emails.some((x) => normalizeEmail(x.value) === normalizeEmail(e.value))) {
            emails.push(e);
          }
        }
        for (const p of dup.phones) {
          if (!phones.some((x) => normalizePhone(x.value) === normalizePhone(p.value))) {
            phones.push(p);
          }
        }
      }
      updateContact(primaryContact.id, {
        emails,
        phones,
        // Fill blanks on the primary from the duplicates.
        role: primaryContact.role || dupContacts.find((d) => d.role)?.role || "",
        companyId:
          primaryContact.companyId ?? dupContacts.find((d) => d.companyId)?.companyId,
      });

      for (const deal of state.deals) {
        if (deal.contactId && duplicateIds.has(deal.contactId)) {
          updateDealFields(deal.id, { contactId: primaryContact.id });
        }
      }
      dupContacts.forEach((d) => deleteContact(d.id));
    } else {
      const primaryCompany = primary as Company;
      const dupCompanies = duplicates as Company[];

      updateCompany(primaryCompany.id, {
        website: primaryCompany.website || dupCompanies.find((d) => d.website)?.website,
        segment: primaryCompany.segment || dupCompanies.find((d) => d.segment)?.segment,
        size: primaryCompany.size || dupCompanies.find((d) => d.size)?.size,
        city: primaryCompany.city || dupCompanies.find((d) => d.city)?.city,
        state: primaryCompany.state || dupCompanies.find((d) => d.state)?.state,
        cnpj: primaryCompany.cnpj || dupCompanies.find((d) => d.cnpj)?.cnpj,
      });

      for (const deal of state.deals) {
        if (deal.companyId && duplicateIds.has(deal.companyId)) {
          updateDealFields(deal.id, { companyId: primaryCompany.id });
        }
      }
      for (const contact of state.contacts) {
        if (contact.companyId && duplicateIds.has(contact.companyId)) {
          updateContact(contact.id, { companyId: primaryCompany.id });
        }
      }
      dupCompanies.forEach((d) => deleteCompany(d.id));
    }

    setMergedKeys((prev) => new Set(prev).add(group.key));
    setMerging(null);
  };

  const describe = (record: Contact | Company) => {
    if ("emails" in record) {
      const parts = [
        record.emails[0]?.value,
        record.phones[0]?.value,
        record.role,
      ].filter(Boolean);
      return parts.join(" · ") || "sem detalhes";
    }
    const parts = [record.cnpj, record.website, record.city].filter(Boolean);
    return parts.join(" · ") || "sem detalhes";
  };

  const relatedDealCount = (record: Contact | Company) =>
    state.deals.filter((d) =>
      "emails" in record ? d.contactId === record.id : d.companyId === record.id
    ).length;

  return (
    <div className="flex flex-col min-h-full bg-[#F4F4F5]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-8 py-5 shrink-0 bg-white">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Detectar Duplicatas</h1>
          <p className="text-sm font-medium text-zinc-400 mt-0.5">
            Encontre e mescle contatos ou empresas duplicados.
          </p>
        </div>
        <button
          onClick={() => {
            setMergedKeys(new Set());
            setChecked(true);
          }}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-amber-600 transition-colors shadow-sm"
        >
          <Search size={14} /> Verificar agora
        </button>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-3xl space-y-0">
          <div className="flex border-b border-zinc-200 bg-white rounded-t-xl px-4 pt-1">
            {([
              { key: "contatos", label: "Contatos", count: contactGroups.length },
              { key: "empresas", label: "Empresas", count: companyGroups.length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-3 text-[13px] font-bold border-b-2 transition-colors flex items-center gap-2",
                  activeTab === tab.key
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-zinc-400 hover:text-zinc-700"
                )}
              >
                {tab.label}
                {checked && tab.count > 0 && (
                  <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[11px]">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="bg-white border border-zinc-200 border-t-0 rounded-b-xl shadow-sm">
            {!checked ? (
              <div className="py-16 flex items-center justify-center">
                <p className="text-[13px] font-medium text-zinc-400">
                  Clique em &quot;Verificar agora&quot; para encontrar duplicatas.
                </p>
              </div>
            ) : visibleGroups.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <p className="text-[13px] font-medium text-zinc-400">
                  Nenhuma duplicata encontrada.
                </p>
                <p className="text-[12px] text-zinc-300">
                  Analisamos{" "}
                  {activeTab === "contatos"
                    ? `${state.contacts.length} contatos`
                    : `${state.companies.length} empresas`}
                  .
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {visibleGroups.map((group) => (
                  <div key={group.key} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {activeTab === "contatos" ? (
                            <Users2 className="h-4 w-4 text-zinc-400 shrink-0" />
                          ) : (
                            <Building2 className="h-4 w-4 text-zinc-400 shrink-0" />
                          )}
                          <p className="text-[14px] font-bold text-zinc-900 truncate">
                            {group.records[0].name}
                          </p>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500 shrink-0">
                            {group.records.length} registros
                          </span>
                        </div>

                        {group.reasons.length > 0 && (
                          <p className="text-[12px] text-zinc-400 mb-3">
                            Agrupado por: {group.reasons.map((r) => REASON_LABELS[r]).join(", ")}
                          </p>
                        )}

                        <ul className="space-y-1.5">
                          {group.records.map((record, idx) => (
                            <li key={record.id} className="flex items-center gap-2 text-[12px]">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0",
                                  idx === 0
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-zinc-100 text-zinc-400"
                                )}
                              >
                                {idx === 0 ? "MANTER" : "MESCLAR"}
                              </span>
                              <span className="font-medium text-zinc-700 truncate">
                                {record.name}
                              </span>
                              <span className="text-zinc-400 truncate">{describe(record)}</span>
                              {relatedDealCount(record) > 0 && (
                                <span className="text-zinc-400 shrink-0">
                                  · {relatedDealCount(record)} negócio(s)
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => handleMerge(group)}
                        disabled={merging === group.key}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-[12px] font-bold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {merging === group.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Merge className="h-3.5 w-3.5" />
                        )}
                        Mesclar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {checked && visibleGroups.length > 0 && (
            <p className="mt-3 text-[12px] text-zinc-400">
              A mesclagem mantém o primeiro registro, transfere negócios e contatos vinculados
              para ele e exclui os demais. A ação não pode ser desfeita.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
