"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Edit2, X, Plus } from "lucide-react";
import { Contact } from "@/lib/crm-types";
import { useCrm } from "@/contexts/crm-context";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ContactAccordionProps {
  contact: Contact;
  dealId?: string;
}

export function ContactAccordion({ contact, dealId }: ContactAccordionProps) {
  const { updateContact, updateDealFields } = useCrm();
  const [isOpen, setIsOpen] = useState(true);

  // Name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(contact.name);

  // New Email state
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmailValue, setNewEmailValue] = useState("");
  const [newEmailType, setNewEmailType] = useState("Comercial");

  // Edit Email states
  const [editingEmailIndex, setEditingEmailIndex] = useState<number | null>(null);
  const [tempEmailValue, setTempEmailValue] = useState("");
  const [tempEmailType, setTempEmailType] = useState("");

  // New Phone state
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [newPhoneValue, setNewPhoneValue] = useState("");
  const [newPhoneType, setNewPhoneType] = useState("Comercial");

  // Edit Phone states
  const [editingPhoneIndex, setEditingPhoneIndex] = useState<number | null>(null);
  const [tempPhoneValue, setTempPhoneValue] = useState("");
  const [tempPhoneType, setTempPhoneType] = useState("");

  // Role state
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [tempRole, setTempRole] = useState(contact.role || "");

  const handleSaveEditedEmail = (idx: number) => {
    const updated = [...(contact.emails || [])];
    if (!tempEmailValue.trim()) {
      if (idx < updated.length) {
        updated.splice(idx, 1);
      }
    } else {
      if (idx >= updated.length) {
        updated.push({ value: tempEmailValue, type: tempEmailType });
      } else {
        updated[idx] = { value: tempEmailValue, type: tempEmailType };
      }
    }
    updateContact(contact.id, { emails: updated });
    setEditingEmailIndex(null);
  };

  const handleSaveEditedPhone = (idx: number) => {
    const updated = [...(contact.phones || [])];
    if (!tempPhoneValue.trim()) {
      if (idx < updated.length) {
        updated.splice(idx, 1);
      }
    } else {
      if (idx >= updated.length) {
        updated.push({ value: tempPhoneValue, type: tempPhoneType });
      } else {
        updated[idx] = { value: tempPhoneValue, type: tempPhoneType };
      }
    }
    updateContact(contact.id, { phones: updated });
    setEditingPhoneIndex(null);
  };

  const saveEmail = () => {
    if (!newEmailValue.trim()) return;
    updateContact(contact.id, {
      emails: [...(contact.emails || []), { value: newEmailValue, type: newEmailType }]
    });
    setIsAddingEmail(false);
    setNewEmailValue("");
    setNewEmailType("Comercial");
  };

  const savePhone = () => {
    if (!newPhoneValue.trim()) return;
    updateContact(contact.id, {
      phones: [...(contact.phones || []), { value: newPhoneValue, type: newPhoneType }]
    });
    setIsAddingPhone(false);
    setNewPhoneValue("");
    setNewPhoneType("Comercial");
  };

  const removeEmail = (index: number) => {
    const updated = [...(contact.emails || [])];
    updated.splice(index, 1);
    updateContact(contact.id, { emails: updated });
  };

  const removePhone = (index: number) => {
    const updated = [...(contact.phones || [])];
    updated.splice(index, 1);
    updateContact(contact.id, { phones: updated });
  };

  const startEditingEmail = (idx: number, val: string, type: string) => {
    setEditingEmailIndex(idx);
    setTempEmailValue(val);
    setTempEmailType(type);
    setIsAddingEmail(false);
  };

  const startAddingEmail = () => {
    setIsAddingEmail(true);
    setNewEmailValue("");
    setNewEmailType("Comercial");
    setEditingEmailIndex(null);
  };

  const startEditingPhone = (idx: number, val: string, type: string) => {
    setEditingPhoneIndex(idx);
    setTempPhoneValue(val);
    setTempPhoneType(type);
    setIsAddingPhone(false);
  };

  const startAddingPhone = () => {
    setIsAddingPhone(true);
    setNewPhoneValue("");
    setNewPhoneType("Comercial");
    setEditingPhoneIndex(null);
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
          <span className="text-sm font-semibold text-zinc-800">Pessoa</span>
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
              onClick={(e) => { e.stopPropagation(); updateDealFields(dealId, { contactId: undefined }); }}
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors"
              title="Desvincular pessoa"
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
                      updateContact(contact.id, { name: tempName }); 
                    }
                    setIsEditingName(false); 
                  }
                  if (e.key === "Escape") { setIsEditingName(false); setTempName(contact.name); }
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <button 
                  onClick={() => { setIsEditingName(false); setTempName(contact.name); }} 
                  className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => { 
                    if (tempName.trim()) {
                      updateContact(contact.id, { name: tempName }); 
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
              href={`/contatos/${contact.id}`}
              className="flex items-center gap-3 rounded-lg p-2 -mx-1 cursor-pointer hover:bg-amber-50/40 transition-colors my-1"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-semibold text-xs shrink-0">
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-zinc-800 break-words">{contact.name}</p>
            </Link>
          )}

          {/* Email Grid Row */}
          <div className="grid grid-cols-[72px_1fr] gap-x-2 py-2 border-b border-zinc-100 items-start">
            <p className="text-xs text-zinc-500 pt-1.5">Email</p>
            <div className="min-w-0">
              {contact.emails && contact.emails.map((e, idx) => (
                <div key={idx} className="mb-2 last:mb-0">
                  {editingEmailIndex === idx ? (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <select 
                          value={tempEmailType} 
                          onChange={ev => setTempEmailType(ev.target.value)}
                          className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs bg-white outline-none shrink-0 font-medium"
                        >
                          <option>Comercial</option>
                          <option>Pessoal</option>
                          <option>Trabalho</option>
                          <option>Outros</option>
                        </select>
                        <input 
                          value={tempEmailValue} 
                          onChange={ev => setTempEmailValue(ev.target.value)}
                          className="flex-1 min-w-0 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200"
                          autoFocus
                          onKeyDown={ev => {
                            if (ev.key === "Enter") handleSaveEditedEmail(idx);
                            if (ev.key === "Escape") setEditingEmailIndex(null);
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => setEditingEmailIndex(null)} 
                          className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => handleSaveEditedEmail(idx)} 
                          className="px-2.5 py-1 rounded text-xs text-white bg-green-600 hover:bg-green-700 font-medium"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-1 -mx-2">
                      <button 
                        className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors flex items-center justify-between"
                        onClick={() => startEditingEmail(idx, e.value, e.type)}
                      >
                        <span className="text-sm text-zinc-800 break-all">{e.value}</span>
                        <span className="text-[10px] text-zinc-400 font-medium ml-2 bg-zinc-200/50 px-1 rounded shrink-0">{e.type}</span>
                      </button>
                      <button 
                        onClick={() => removeEmail(idx)} 
                        className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all hover:text-red-500"
                        title="Remover e-mail"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty State */}
              {(!contact.emails || contact.emails.length === 0) && editingEmailIndex === null && !isAddingEmail && (
                <div className="flex items-center gap-1 group -mx-2">
                  <button 
                    onClick={startAddingEmail}
                    className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors"
                  >
                    <span className="text-sm text-zinc-300 group-hover:text-zinc-500">-</span>
                  </button>
                  <button 
                    onClick={startAddingEmail}
                    className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all hover:text-zinc-600"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}

              {/* Adding Email Editor */}
              {isAddingEmail && (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <select 
                      value={newEmailType} 
                      onChange={ev => setNewEmailType(ev.target.value)}
                      className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs bg-white outline-none shrink-0 font-medium"
                    >
                      <option>Comercial</option>
                      <option>Pessoal</option>
                      <option>Trabalho</option>
                      <option>Outros</option>
                    </select>
                    <input 
                      value={newEmailValue} 
                      onChange={ev => setNewEmailValue(ev.target.value)}
                      placeholder="seu@email.com"
                      className="flex-1 min-w-0 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200"
                      autoFocus
                      onKeyDown={ev => {
                        if (ev.key === "Enter") saveEmail();
                        if (ev.key === "Escape") setIsAddingEmail(false);
                      }}
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button 
                      onClick={() => setIsAddingEmail(false)} 
                      className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={saveEmail} 
                      className="px-2.5 py-1 rounded text-xs text-white bg-amber-500 hover:bg-amber-600 font-medium"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Trigger to Add Email */}
              {!isAddingEmail && editingEmailIndex === null && (
                <div className="mt-1">
                  <button 
                    onClick={startAddingEmail}
                    className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium mt-0.5"
                  >
                    <Plus size={12} />
                    Adicionar e-mail
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Telefone Grid Row */}
          <div className="grid grid-cols-[72px_1fr] gap-x-2 py-2 border-b border-zinc-100 items-start">
            <p className="text-xs text-zinc-500 pt-1.5">Telefone</p>
            <div className="min-w-0">
              {contact.phones && contact.phones.map((p, idx) => (
                <div key={idx} className="mb-2 last:mb-0">
                  {editingPhoneIndex === idx ? (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <select 
                          value={tempPhoneType} 
                          onChange={ev => setTempPhoneType(ev.target.value)}
                          className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs bg-white outline-none shrink-0 font-medium"
                        >
                          <option>Comercial</option>
                          <option>Pessoal</option>
                          <option>Trabalho</option>
                          <option>Celular</option>
                          <option>Outros</option>
                        </select>
                        <input 
                          value={tempPhoneValue} 
                          onChange={ev => setTempPhoneValue(ev.target.value)}
                          className="flex-1 min-w-0 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200"
                          autoFocus
                          onKeyDown={ev => {
                            if (ev.key === "Enter") handleSaveEditedPhone(idx);
                            if (ev.key === "Escape") setEditingPhoneIndex(null);
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => setEditingPhoneIndex(null)} 
                          className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => handleSaveEditedPhone(idx)} 
                          className="px-2.5 py-1 rounded text-xs text-white bg-green-600 hover:bg-green-700 font-medium"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-1 -mx-2">
                      <button 
                        className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors flex items-center justify-between"
                        onClick={() => startEditingPhone(idx, p.value, p.type)}
                      >
                        <span className="text-sm text-zinc-800 break-all">{p.value}</span>
                        <span className="text-[10px] text-zinc-400 font-medium ml-2 bg-zinc-200/50 px-1 rounded shrink-0">{p.type}</span>
                      </button>
                      <button 
                        onClick={() => removePhone(idx)} 
                        className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all hover:text-red-500"
                        title="Remover telefone"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty State */}
              {(!contact.phones || contact.phones.length === 0) && editingPhoneIndex === null && !isAddingPhone && (
                <div className="flex items-center gap-1 group -mx-2">
                  <button 
                    onClick={startAddingPhone}
                    className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors"
                  >
                    <span className="text-sm text-zinc-300 group-hover:text-zinc-500">-</span>
                  </button>
                  <button 
                    onClick={startAddingPhone}
                    className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all hover:text-zinc-600"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}

              {/* Adding Phone Editor */}
              {isAddingPhone && (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <select 
                      value={newPhoneType} 
                      onChange={ev => setNewPhoneType(ev.target.value)}
                      className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs bg-white outline-none shrink-0 font-medium"
                    >
                      <option>Comercial</option>
                      <option>Pessoal</option>
                      <option>Trabalho</option>
                      <option>Celular</option>
                      <option>Outros</option>
                    </select>
                    <input 
                      value={newPhoneValue} 
                      onChange={ev => setNewPhoneValue(ev.target.value)}
                      placeholder="(11) 99999-9999"
                      className="flex-1 min-w-0 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200"
                      autoFocus
                      onKeyDown={ev => {
                        if (ev.key === "Enter") savePhone();
                        if (ev.key === "Escape") setIsAddingPhone(false);
                      }}
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button 
                      onClick={() => setIsAddingPhone(false)} 
                      className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={savePhone} 
                      className="px-2.5 py-1 rounded text-xs text-white bg-amber-500 hover:bg-amber-600 font-medium"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* Trigger to Add Phone */}
              {!isAddingPhone && editingPhoneIndex === null && (
                <div className="mt-1">
                  <button 
                    onClick={startAddingPhone}
                    className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium mt-0.5"
                  >
                    <Plus size={12} />
                    Adicionar telefone
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cargo Grid Row */}
          <div className="grid grid-cols-[72px_1fr] gap-x-2 py-2 border-b border-zinc-100 items-start">
            <p className="text-xs text-zinc-500 pt-1.5">Cargo</p>
            <div className="min-w-0">
              {isEditingRole ? (
                <div className="space-y-1.5">
                  <input 
                    value={tempRole} 
                    onChange={ev => setTempRole(ev.target.value)}
                    className="w-full rounded-md border border-amber-300 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200" 
                    autoFocus
                    onKeyDown={ev => {
                      if (ev.key === "Enter") { 
                        updateContact(contact.id, { role: tempRole }); 
                        setIsEditingRole(false); 
                      }
                      if (ev.key === "Escape") { 
                        setIsEditingRole(false); 
                        setTempRole(contact.role || ""); 
                      }
                    }}
                  />
                  <div className="flex justify-end gap-1.5">
                    <button 
                      onClick={() => { setIsEditingRole(false); setTempRole(contact.role || ""); }} 
                      className="px-2.5 py-1 rounded text-xs text-zinc-500 hover:bg-zinc-100 border border-zinc-200 bg-white"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => { 
                        updateContact(contact.id, { role: tempRole }); 
                        setIsEditingRole(false); 
                      }} 
                      className="px-2.5 py-1 rounded text-xs text-white bg-green-600 hover:bg-green-700 font-medium"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center gap-1 -mx-2">
                  <button 
                    className="flex-1 min-w-0 text-left rounded-md px-2 py-1 hover:bg-zinc-100 transition-colors"
                    onClick={() => { setTempRole(contact.role || ""); setIsEditingRole(true); }}
                  >
                    <span className={contact.role ? "text-sm text-zinc-800 font-medium" : "text-sm text-zinc-300 group-hover:text-zinc-500"}>
                      {contact.role || "-"}
                    </span>
                  </button>
                  <button 
                    onClick={() => { setTempRole(contact.role || ""); setIsEditingRole(true); }}
                    className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 transition-all hover:text-zinc-600"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
