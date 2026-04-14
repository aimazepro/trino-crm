"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Edit2, Check, X, Phone as PhoneIcon, Mail } from "lucide-react";
import { Contact, ContactEmail, ContactPhone } from "@/lib/crm-types";
import { useCrm } from "@/contexts/crm-context";
import { InlineEdit } from "./inline-edit";
import Link from "next/link";

interface ContactAccordionProps {
  contact: Contact;
}

export function ContactAccordion({ contact }: ContactAccordionProps) {
  const { state, updateContact } = useCrm();
  const [isOpen, setIsOpen] = useState(true);

  // New Email state
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmailValue, setNewEmailValue] = useState("");
  const [newEmailType, setNewEmailType] = useState("Trabalho");

  // New Phone state
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [newPhoneValue, setNewPhoneValue] = useState("");
  const [newPhoneType, setNewPhoneType] = useState("Comercial");

  const saveEmail = () => {
    if (!newEmailValue.trim()) return;
    updateContact(contact.id, {
      emails: [...contact.emails, { value: newEmailValue, type: newEmailType }]
    });
    setIsAddingEmail(false);
    setNewEmailValue("");
    setNewEmailType("Trabalho");
  };

  const savePhone = () => {
    if (!newPhoneValue.trim()) return;
    updateContact(contact.id, {
      phones: [...contact.phones, { value: newPhoneValue, type: newPhoneType }]
    });
    setIsAddingPhone(false);
    setNewPhoneValue("");
    setNewPhoneType("Comercial");
  };

  const removeEmail = (index: number) => {
    const updated = [...contact.emails];
    updated.splice(index, 1);
    updateContact(contact.id, { emails: updated });
  };

  const removePhone = (index: number) => {
    const updated = [...contact.phones];
    updated.splice(index, 1);
    updateContact(contact.id, { phones: updated });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4 transition-all">
      <div 
        className="flex items-center gap-2 cursor-pointer hover:text-amber-600 select-none text-gray-900"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <h3 className="text-sm font-bold">Pessoa</h3>
      </div>

      {isOpen && (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          
          <Link 
            href={`/contatos/${contact.id}`}
            className="flex items-center gap-3 group/link rounded-xl p-2 -mx-2 hover:bg-amber-50 transition-colors"
            onClick={e => e.stopPropagation()}
          >
             <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm shrink-0">
               {contact.name.charAt(0).toUpperCase()}
             </div>
             <span className="font-bold text-sm text-gray-900 group-hover/link:text-amber-600 transition-colors">{contact.name}</span>
          </Link>

          <div className="space-y-4 pt-2">
            
            {/* Emails Section */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Email</div>
              {contact.emails.length === 0 ? (
                <div 
                   className="group flex items-center justify-between cursor-text p-1.5 -mx-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                   onClick={() => setIsAddingEmail(true)}
                >
                  <span className="text-sm text-gray-400">-</span>
                  <span className="opacity-0 group-hover:opacity-100 text-gray-300 shrink-0"><Edit2 size={12} /></span>
                </div>
              ) : (
                <div className="space-y-2">
                  {contact.emails.map((e, idx) => (
                    <div key={idx} className="group flex items-center justify-between text-sm">
                      <div className="flex items-center flex-1 pr-2">
                        <InlineEdit 
                           value={e.value} 
                           onSave={(v) => {
                             const newer = [...contact.emails];
                             newer[idx].value = v;
                             updateContact(contact.id, { emails: newer });
                           }} 
                        />
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded ml-2 shrink-0">{e.type}</span>
                      </div>
                      <button onClick={() => removeEmail(idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {!isAddingEmail ? (
                <button 
                  onClick={() => setIsAddingEmail(true)}
                  className="mt-2 text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1"
                >
                  + Adicionar e-mail
                </button>
              ) : (
                <div className="mt-2 flex flex-col gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <div className="flex gap-2">
                    <select 
                      value={newEmailType} onChange={e => setNewEmailType(e.target.value)}
                      className="text-xs border rounded px-1 min-w-[70px] outline-none"
                    >
                      <option>Trabalho</option><option>Pessoal</option><option>Outros</option>
                    </select>
                    <input 
                      value={newEmailValue} onChange={e => setNewEmailValue(e.target.value)}
                      placeholder="seu@email.com" autoFocus
                      className="flex-1 text-xs px-2 py-1 border rounded outline-none"
                      onKeyDown={e => e.key === "Enter" && saveEmail()}
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-1">
                    <button onClick={() => setIsAddingEmail(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancelar</button>
                    <button onClick={saveEmail} className="text-xs bg-amber-500 text-white px-3 py-1 rounded font-bold hover:bg-amber-600">Salvar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Phones Section */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Telefone</div>
              {contact.phones.length === 0 ? (
                <div 
                   className="group flex items-center justify-between cursor-text p-1.5 -mx-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                   onClick={() => setIsAddingPhone(true)}
                >
                  <span className="text-sm text-gray-400">-</span>
                  <span className="opacity-0 group-hover:opacity-100 text-gray-300 shrink-0"><Edit2 size={12} /></span>
                </div>
              ) : (
                <div className="space-y-2">
                  {contact.phones.map((p, idx) => (
                    <div key={idx} className="group flex items-center justify-between text-sm">
                      <div className="flex items-center flex-1 pr-2">
                        <InlineEdit 
                           value={p.value} 
                           onSave={(v) => {
                             const newer = [...contact.phones];
                             newer[idx].value = v;
                             updateContact(contact.id, { phones: newer });
                           }} 
                        />
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded ml-2 shrink-0">{p.type}</span>
                      </div>
                      <button onClick={() => removePhone(idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {!isAddingPhone ? (
                <button 
                  onClick={() => setIsAddingPhone(true)}
                  className="mt-2 text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1"
                >
                  + Adicionar telefone
                </button>
              ) : (
                <div className="mt-2 flex flex-col gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <div className="flex gap-2">
                    <select 
                      value={newPhoneType} onChange={e => setNewPhoneType(e.target.value)}
                      className="text-xs border rounded px-1 min-w-[70px] outline-none"
                    >
                      <option>Comercial</option><option>Pessoal</option><option>Trabalho</option><option>Celular</option>
                    </select>
                    <input 
                      value={newPhoneValue} onChange={e => setNewPhoneValue(e.target.value)}
                      placeholder="(11) 99999-9999" autoFocus
                      className="flex-1 text-xs px-2 py-1 border rounded outline-none"
                      onKeyDown={e => e.key === "Enter" && savePhone()}
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-1">
                    <button onClick={() => setIsAddingPhone(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancelar</button>
                    <button onClick={savePhone} className="text-xs bg-amber-500 text-white px-3 py-1 rounded font-bold hover:bg-amber-600">Salvar</button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
               <div className="text-xs text-gray-500 mb-1">Cargo</div>
               <div className="flex items-center text-sm">
                  <InlineEdit value={contact.role || ""} onSave={(v) => updateContact(contact.id, { role: v })} />
               </div>
            </div>

          </div>

          <div className="flex gap-2 pt-4 border-t border-gray-50">
             <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-gray-600 font-medium text-xs hover:bg-gray-50 transition-colors">
               <PhoneIcon size={14} /> Ligar
             </button>
             
             <Link href="?tab=WhatsApp" scroll={false} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366] text-white font-medium text-xs hover:bg-[#1DA851] shadow-sm transition-colors">
               WhatsApp
             </Link>
          </div>
        </div>
      )}
    </div>
  );
}
