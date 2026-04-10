"use client";

import { useState } from "react";
import { Calendar, Trash2, Edit2, Play, Users, Video } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Appointment } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

export function AppointmentsTab({ deal }: { deal: Deal }) {
  const { addAppointment, state } = useCrm();
  const contact = state.contacts.find(c => c.id === deal.contactId);
  const [isAdding, setIsAdding] = useState(false);
  
  const [attendant, setAttendant] = useState("");
  const [procedure, setProcedure] = useState(contact ? `${contact.name} <> ` : "");
  const [date, setDate] = useState("");
  const [link, setLink] = useState("");

  const startAdding = () => {
    setIsAdding(true);
    setAttendant("");
    setProcedure(contact ? `${contact.name} <> ` : "");
    setDate("");
    setLink("");
  };

  const saveAppointment = () => {
    if (!procedure.trim() || !date) return;
    
    addAppointment({
       dealId: deal.id,
       attendant,
       procedure,
       date: new Date(date).toISOString(),
       link
    });
    
    setIsAdding(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Agendamentos</h4>
         {!isAdding && (
           <button onClick={startAdding} className="text-xs font-bold text-blue-500 hover:text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-1">
              <Calendar size={14} /> Agendar Reunião
           </button>
         )}
      </div>

      {isAdding && (
         <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm space-y-4">
            <h5 className="font-bold text-sm text-gray-900">Agendar Evento</h5>
            
            <div className="space-y-3">
               <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Procedimento / Título</label>
                  <input 
                    value={procedure} onChange={e => setProcedure(e.target.value)}
                    className="w-full border rounded-lg py-2 px-3 text-sm outline-none focus:border-blue-500" 
                    placeholder="Ex: João <> Limpeza dentária"
                  />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Atendente / Responsável</label>
                    <input 
                      value={attendant} onChange={e => setAttendant(e.target.value)}
                      className="w-full border rounded-lg py-2 px-3 text-sm outline-none focus:border-blue-500" 
                      placeholder="Ex: Dra. Maria"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Data e Hora</label>
                    <input 
                      type="datetime-local" 
                      value={date} onChange={e => setDate(e.target.value)}
                      className="w-full border rounded-lg py-2 px-3 text-sm outline-none focus:border-blue-500" 
                    />
                  </div>
               </div>
               <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Link da Call (Opcional)</label>
                  <input 
                    value={link} onChange={e => setLink(e.target.value)}
                    className="w-full border rounded-lg py-2 px-3 text-sm outline-none focus:border-blue-500" 
                    placeholder="Ex: https://meet.google.com/xyz"
                  />
               </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
               <button onClick={() => setIsAdding(false)} className="text-sm px-4 py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg border">Cancelar</button>
               <button onClick={saveAppointment} className="text-sm px-6 py-2 bg-blue-500 text-white font-bold rounded-lg shadow-sm hover:bg-blue-600">Salvar Agendamento</button>
            </div>
         </div>
      )}

      {deal.appointments.length === 0 && !isAdding ? (
         <div className="flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-200 flex items-center justify-center mb-4 border border-blue-100">
               <Calendar size={32} />
            </div>
            <p className="text-sm font-medium text-gray-500">Nenhum evento agendado</p>
         </div>
      ) : (
         <div className="space-y-3">
           {deal.appointments.map(a => (
              <div key={a.id} className={cn("p-4 border rounded-xl shadow-sm transition-all", a.status === "Cancelled" ? "bg-red-50/50 border-red-100 opacity-70" : "bg-white border-blue-100 border-l-4 border-l-blue-500")}>
                 <div className="flex items-start justify-between">
                    <div>
                       <div className="flex items-center gap-2">
                         <h5 className={cn("font-bold text-sm", a.status === "Cancelled" ? "text-red-700 line-through" : "text-gray-900")}>
                           {a.procedure}
                         </h5>
                         {a.status === "Cancelled" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded font-bold uppercase tracking-wider">Cancelado</span>}
                       </div>
                       
                       <div className="flex items-center gap-4 mt-2 text-xs font-medium text-gray-500">
                         <span className="flex items-center gap-1.5"><Calendar size={12}/> {new Date(a.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                         {a.attendant && <span className="flex items-center gap-1.5"><Users size={12}/> {a.attendant}</span>}
                       </div>

                       {a.link && a.status === "Scheduled" && (
                          <div className="mt-3">
                             <a href={a.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded font-bold text-xs transition-colors">
                                <Video size={14} /> Entrar na Call
                             </a>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           ))}
         </div>
      )}
    </div>
  );
}
