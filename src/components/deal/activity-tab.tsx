"use client";

import { useState } from "react";
import { ListTodo, CheckCircle, Trash2, Edit2, Play } from "lucide-react";
import { useCrm } from "@/contexts/crm-context";
import { Deal, Activity } from "@/lib/crm-types";
import { ActivityModal } from "./activity-modal";
import { cn } from "@/lib/utils";

export function ActivityTab({ deal }: { deal: Deal }) {
  const { addActivity, deleteActivity, updateActivity } = useCrm();
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const startAdding = () => {
    setEditingActivity(null);
    setShowModal(true);
  };

  const saveActivity = (data: { title: string; type: string; date: string; description: string }) => {
    if (editingActivity) {
       updateActivity(editingActivity.id, { 
         title: data.title, 
         date: data.date, 
         type: data.type,
         description: data.description
       });
    } else {
       addActivity({
         dealId: deal.id,
         title: data.title,
         date: data.date,
         type: data.type,
         description: data.description,
         completed: false
       });
    }
    setShowModal(false);
    setEditingActivity(null);
  };


  const handleEdit = (a: Activity) => {
    setEditingActivity(a);
    setShowModal(true);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Atividades</h4>
         <button onClick={startAdding} className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20">
            + Adicionar
         </button>
      </div>

      {deal.activities.length === 0 ? (
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
                    <button onClick={() => updateActivity(a.id, { completed: !a.completed })} className="text-xs font-bold px-3 py-1 border border-gray-200 text-gray-500 hover:text-gray-800 rounded-md whitespace-nowrap hidden sm:block">
                       {a.completed ? "Reabrir" : "Concluir"}
                    </button>
                    <button onClick={() => handleEdit(a)} className="p-1.5 text-gray-400 hover:text-amber-600 border border-transparent hover:border-amber-200 hover:bg-amber-50 rounded-md transition-colors"><Edit2 size={14}/></button>
                    <button onClick={() => deleteActivity(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 border border-transparent hover:border-red-200 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={14}/></button>
                 </div>
              </div>
           ))}
         </div>
      )}

      {showModal && (
        <ActivityModal 
           activity={editingActivity || undefined}
           onClose={() => setShowModal(false)}
           onSave={saveActivity}
        />
      )}
    </div>
  );
}
