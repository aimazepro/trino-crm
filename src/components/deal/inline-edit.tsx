"use client";

import { useState, useRef, useEffect } from "react";
import { Edit2, Check, X } from "lucide-react";

interface InlineEditProps {
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
  className?: string;
}

export function InlineEdit({ value, onSave, placeholder = "-", type = "text", className = "" }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setTempVal(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave(tempVal);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempVal(value);
    setIsEditing(false);
  };

  const isDate = type === "date";

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input 
          ref={inputRef}
          type={type}
          value={tempVal}
          onChange={e => setTempVal(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className={`rounded border border-amber-300 px-2 py-0.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-amber-200 ${isDate ? 'w-[135px]' : 'w-24'} ${className}`}
        />
        <button onClick={handleSave} className="text-green-500 hover:text-green-600 shrink-0">
          <Check size={16}/>
        </button>
        <button onClick={handleCancel} className="text-zinc-400 hover:text-zinc-500 shrink-0">
          <X size={16}/>
        </button>
      </div>
    );
  }

  let displayValue = value || placeholder;
  if (value && type === "date") {
    const parts = value.split("-");
    if (parts.length === 3) {
      displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  return (
    <div 
      className="group flex flex-1 items-center justify-between cursor-text p-1 -m-1 rounded hover:bg-gray-50 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className={`truncate text-sm ${!value ? "text-gray-400" : "text-gray-900"} ${className}`}>
        {displayValue}
      </span>
      <span className="opacity-0 group-hover:opacity-100 text-gray-300 ml-2 shrink-0">
        <Edit2 size={12} />
      </span>
    </div>
  );
}
