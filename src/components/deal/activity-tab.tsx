"use client";

import { useState } from "react";
import { ListTodo, CheckCircle, Trash2, Edit2, Play } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Activity } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

export function ActivityTab({ deal }: { deal: Deal }) {
  const { addActivity, deleteActivity, updateActivity } = useCrm();
  const [isAdding, setIsAdding] = useState(false);
  
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("WhatsApp");
  const [editingId, setEditingId] = useState<string | null>(null);

  const startAdding = () => {
    setIsAdding(true);
    setEditingId(null);
    setTitle("");
    setDate("");
    setType("WhatsApp");
  };

  const saveActivity = () => {
    if (!title.trim() || !date) return;
    
    if (editingId) {
       updateActivity(editingId, { title, date: new Date(date).toISOString(), type });
    } else {
       addActivity({
         dealId: deal.id,
         title,
         date: new Date(date).toISOString(),
         type
       });
    }
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (a: Activity) => {
    setTitle(a.title);
    setDate(a.date.substring(0, 16));
    setType(a.type);
    setEditingId(a.id);
    setIsAdding(true);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Atividades</h4>
         {!isAdding && (
           <button onClick={startAdding} className="text-xs font-bold text-amber-500 hover:text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
              + Nova Atividade
           </button>
         )}
      </div>

      {isAdding && (
         <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
            <h5 className="font-bold text-sm text-gray-900">{editingId ? "Editar Atividade" : "Agendar Atividade"}</h5>
            <div className="flex gap-2">
               <input 
                 value={title} onChange={e => setTitle(e.target.value)}
                 className="flex-1 border rounded py-1.5 px-3 text-sm outline-none focus:border-amber-500" 
                 placeholder="Descrição (ex: Ligar para confirmar)"
               />
               <select value={type} onChange={e => setType(e.target.value)} className="w-32 border rounded py-1.5 px-3 text-sm outline-none">
                 <option>WhatsApp</option><option>Ligação</option><option>Email</option><option>Reunião</option>
               </select>
               <input 
                 type="datetime-local" 
                 value={date} onChange={e => setDate(e.target.value)}
                 className="w-44 border rounded py-1.5 px-3 text-sm outline-none focus:border-amber-500" 
               />
            </div>
            <div className="flex justify-end gap-2 pt-2">
               <button onClick={() => setIsAdding(false)} className="text-sm px-3 py-1.5 text-gray-500 font-medium">Cancelar</button>
               <button onClick={saveActivity} className="text-sm px-4 py-1.5 bg-amber-500 text-white font-bold rounded shadow-sm hover:bg-amber-600">Salvar</button>
            </div>
         </div>
      )}

      {deal.activities.length === 0 && !isAdding ? (
         <div className="flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-200 flex items-center justify-center mb-4">
               <ListTodo size={32} />
            </div>
            <p className="text-sm font-medium text-gray-500">Nenhuma atividade registrada</p>
         </div>
      ) : (
         <div className="space-y-3">
           {deal.activities.map(a => (
              <div key={a.id} className={cn("flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm transition-all", a.completed && "opacity-60")}>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => updateActivity(a.id, { completed: !a.completed })}
                      className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", a.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-amber-500")}
                    >
                      {a.completed && <CheckCircle size={14} />}
                    </button>
                    <div>
                       <div className={cn("text-sm font-bold text-gray-900", a.completed && "line-through text-gray-500")}>
                         {a.title}
                       </div>
                       <div className="text-xs font-medium text-gray-400 flex items-center gap-1 mt-0.5">
                         <span className="bg-gray-100 text-gray-600 px-1.5 rounded">{a.type}</span>
                         <span>•</span>
                         {new Date(a.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                       </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-1">
                    <button onClick={() => updateActivity(a.id, { completed: !a.completed })} className="text-xs font-bold px-2 py-1 bg-green-50 text-green-600 rounded">
                       {a.completed ? "Reabrir" : "Concluir"}
                    </button>
                    <button onClick={() => handleEdit(a)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"><Edit2 size={14}/></button>
                    <button onClick={() => deleteActivity(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                 </div>
              </div>
           ))}
         </div>
      )}
    </div>
  );
}
