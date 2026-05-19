import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  emptyText?: string;
  widthClassName?: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  emptyText = "No matches",
  widthClassName = "w-56",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((selectedValue) => selectedValue !== value));
      return;
    }

    onChange([...selectedValues, value]);
  };

  const displayText =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions[0].label} +${selectedOptions.length - 1}`;

  return (
    <div ref={rootRef} className={`relative ${widthClassName}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 w-full items-center rounded-2xl border border-slate-600/70 bg-slate-950/60 px-3 text-left text-xs text-slate-200 shadow-inner transition-colors hover:border-slate-500 focus:outline-none focus:border-blue-500/80"
        title={selectedOptions.map((option) => option.label).join(", ") || placeholder}
      >
        <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
        <span className={`min-w-0 flex-1 truncate ${selectedOptions.length === 0 ? "text-slate-500" : "text-slate-200"}`}>
          {displayText}
        </span>
        {selectedOptions.length > 0 && (
          <span className="ml-2 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
            {selectedOptions.length}
          </span>
        )}
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-10 z-40 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="border-b border-slate-800 p-2">
            <div className="flex h-9 items-center rounded-2xl border border-slate-700/90 bg-slate-900/80 px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={label}
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                autoFocus
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="ml-2 text-slate-500 hover:text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleValue(option.value)}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      isSelected ? "bg-blue-500/15 text-blue-200" : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                    }`}
                  >
                    <span
                      className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-xs text-slate-500">{emptyText}</div>
            )}
          </div>

          {selectedValues.length > 0 && (
            <div className="border-t border-slate-800 p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-xl px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
