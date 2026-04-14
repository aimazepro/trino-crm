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

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 w-full">
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
          className={`w-full min-w-[60px] max-w-[140px] px-2 py-1 text-sm border-2 border-amber-400 rounded outline-none shadow-sm ${className}`}
        />
        <button onClick={handleSave} className="text-green-500 hover:bg-green-50 p-1 rounded transition-colors"><Check size={14}/></button>
        <button onClick={handleCancel} className="text-red-400 hover:bg-red-50 p-1 rounded transition-colors"><X size={14}/></button>
      </div>
    );
  }

  return (
    <div 
      className="group flex flex-1 items-center justify-between cursor-text p-1 -m-1 rounded hover:bg-gray-50 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className={`truncate text-sm ${!value ? "text-gray-400" : "text-gray-900"} ${className}`}>
        {value || placeholder}
      </span>
      <span className="opacity-0 group-hover:opacity-100 text-gray-300 ml-2 shrink-0">
        <Edit2 size={12} />
      </span>
    </div>
  );
}
