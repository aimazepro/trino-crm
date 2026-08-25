"use client";

import { useState, useEffect } from "react";
import { X, Search, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ColumnItem {
  id: string;
  label: string;
  category: "Empresa";
  tag: string;
}

export const ALL_COLUMNS: ColumnItem[] = [
  { id: "name", label: "Empresa", category: "Empresa", tag: "Empresa" },
  { id: "website", label: "Website", category: "Empresa", tag: "Empresa" },
  { id: "segment", label: "Segmento", category: "Empresa", tag: "Empresa" },
  { id: "size", label: "Porte", category: "Empresa", tag: "Empresa" },
  { id: "city", label: "Cidade", category: "Empresa", tag: "Empresa" },
  { id: "state", label: "Estado", category: "Empresa", tag: "Empresa" },
  { id: "cnpj", label: "CNPJ", category: "Empresa", tag: "Empresa" },
  { id: "contacts", label: "Contatos", category: "Empresa", tag: "Empresa" },
  { id: "deals", label: "Negócios", category: "Empresa", tag: "Empresa" },
  { id: "owner", label: "Proprietário", category: "Empresa", tag: "Empresa" },
  { id: "createdAt", label: "Criado em", category: "Empresa", tag: "Empresa" },
];

export const DEFAULT_COLUMNS = ["name", "website", "segment", "size", "city", "state", "cnpj", "contacts", "deals", "owner"];

const CATEGORIES: ColumnItem["category"][] = ["Empresa"];

interface CustomizeColumnsModalProps {
  initialColumns: string[];
  onClose: () => void;
  onSave: (columns: string[]) => void;
}

export function CustomizeColumnsModal({ initialColumns, onClose, onSave }: CustomizeColumnsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Ordered visible columns
  const [visible, setVisible] = useState<ColumnItem[]>([]);

  useEffect(() => {
    setMounted(true);
    const mapped = initialColumns
      .map(id => ALL_COLUMNS.find(c => c.id === id))
      .filter((c): c is ColumnItem => !!c);
    setVisible(mapped);
  }, [initialColumns]);

  if (!mounted) return null;

  // Columns not currently visible
  const invisible = ALL_COLUMNS.filter(c => !visible.some(v => v.id === c.id));

  // Handle checking an item under the category sections
  const handleCheck = (column: ColumnItem) => {
    setVisible([...visible, column]);
  };

  // Handle unchecking an item in the visible section
  const handleUncheck = (columnId: string) => {
    if (columnId === "name") return; // cannot hide Empresa
    setVisible(visible.filter(v => v.id !== columnId));
  };

  // Drag and drop handler
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(visible);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setVisible(items);
  };

  // Move column item up
  const moveUp = (index: number) => {
    if (index === 0) return;
    const items = Array.from(visible);
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    setVisible(items);
  };

  // Move column item down
  const moveDown = (index: number) => {
    if (index === visible.length - 1) return;
    const items = Array.from(visible);
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    setVisible(items);
  };

  // Reset to default columns
  const handleResetToDefault = () => {
    const mapped = DEFAULT_COLUMNS
      .map(id => ALL_COLUMNS.find(c => c.id === id))
      .filter((c): c is ColumnItem => !!c);
    setVisible(mapped);
  };

  // Filter columns based on search
  const filterFn = (c: ColumnItem) =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredVisible = visible.filter(filterFn);

  // Categorized invisible columns
  const invisibleByCategory = (cat: ColumnItem["category"]) =>
    invisible.filter(c => c.category === cat).filter(filterFn);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl border border-zinc-200 flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Personalizar colunas</h2>
            <Link
              href="/configuracoes/campos"
              className="text-xs font-medium text-amber-500 hover:text-amber-600 transition-colors"
            >
              + Campo personalizado
            </Link>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-zinc-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar coluna..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">

          {/* Visible Columns section */}
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-2">
              Visivel ({visible.length}/{ALL_COLUMNS.length})
            </p>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="visible-columns">
                {(provided) => (
                  <ul
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-0.5"
                  >
                    {filteredVisible.map((item, index) => {
                      const isName = item.id === "name";
                      return (
                        <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isName}>
                          {(providedDrag, snapshot) => (
                            <li
                              ref={providedDrag.innerRef}
                              {...providedDrag.draggableProps}
                              className={cn(
                                "group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50 transition-colors",
                                snapshot.isDragging && "bg-zinc-50 border border-zinc-200 shadow-sm"
                              )}
                            >
                              {/* Drag handle */}
                              <div
                                {...providedDrag.dragHandleProps}
                                className={cn(
                                  "shrink-0 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing p-0.5",
                                  isName && "opacity-0 pointer-events-none"
                                )}
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>

                              {/* Checkbox button */}
                              {isName ? (
                                <button
                                  disabled
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors border-zinc-200 bg-zinc-100 cursor-not-allowed"
                                >
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUncheck(item.id)}
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors border-amber-500 bg-amber-500 cursor-pointer"
                                >
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                              )}

                              <span className="flex-1 text-sm text-zinc-700 truncate">{item.label}</span>

                              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
                                {item.tag}
                              </span>

                              {/* Reordering Arrows (visible on hover) */}
                              <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  disabled={index <= 1} // Empresa is 0, so cannot move to 0
                                  onClick={() => moveUp(index)}
                                  className={cn(
                                    "rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 transition-colors",
                                    index <= 1 && "opacity-20 cursor-not-allowed hover:bg-transparent"
                                  )}
                                  title="Mover para cima"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === visible.length - 1}
                                  onClick={() => moveDown(index)}
                                  className={cn(
                                    "rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 transition-colors",
                                    index === visible.length - 1 && "opacity-20 cursor-not-allowed hover:bg-transparent"
                                  )}
                                  title="Mover para baixo"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Category sections */}
          {CATEGORIES.map(cat => (
            invisibleByCategory(cat).length > 0 && (
              <div key={cat}>
                <p className="text-xs font-semibold tracking-widest text-zinc-400 uppercase mb-2">{cat}</p>
                <ul className="space-y-0.5">
                  {invisibleByCategory(cat).map(item => (
                    <li key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50 transition-colors">
                      <div className="h-3.5 w-3.5 shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleCheck(item)}
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white hover:border-amber-400 cursor-pointer transition-colors"
                      />
                      <span className="flex-1 text-sm text-zinc-500 truncate">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Colunas padrao
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(visible.map(v => v.id))}
              className="rounded-md bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-medium text-white hover:from-amber-600 hover:to-amber-500 shadow-sm hover:shadow-md transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
