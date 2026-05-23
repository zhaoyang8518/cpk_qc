import React, { useRef } from "react";
import { SheetData } from "../types";
import { FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { t, useLocale } from "../i18n";

interface SheetNavProps {
  sheets: SheetData[];
  activeSheetIdx: number;
  onSheetChange: (idx: number) => void;
}

const SheetNav: React.FC<SheetNavProps> = ({ sheets, activeSheetIdx, onSheetChange }) => {
  const { locale } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollHorizontally = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <footer className="relative flex items-center h-12 bg-slate-800/90 backdrop-blur border-t border-slate-700/50 select-none z-20">
      {/* Left Scroll Helper */}
      <button
        onClick={() => scrollHorizontally("left")}
        className="absolute left-0 z-10 h-full px-2 bg-gradient-to-r from-slate-800 via-slate-800 to-transparent text-slate-400 hover:text-white transition-colors flex items-center justify-center"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Horizontally Scrollable Tabs */}
      <div
        ref={scrollRef}
        className="flex items-center space-x-2 overflow-x-auto px-8 h-full w-full scrollbar-none whitespace-nowrap scroll-smooth"
      >
        {sheets.length > 0 ? (
          sheets.map((sheet, idx) => {
            const isActive = activeSheetIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => onSheetChange(idx)}
                title={`${sheet.display_name}\n${sheet.test_metric_key}\n${sheet.raw_sheet_name}`}
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20 scale-105"
                    : "bg-slate-900/60 text-slate-400 border-slate-700/60 hover:bg-slate-700/60 hover:text-slate-200"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{sheet.display_name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {sheet.indicators.length}
                </span>
              </button>
            );
          })
        ) : (
          <div className="flex items-center space-x-2 text-xs text-slate-500 px-4 italic">
            <FileSpreadsheet className="w-4 h-4 opacity-30" />
            <span>{t("sheetNavEmpty", locale)}</span>
          </div>
        )}
      </div>

      {/* Right Scroll Helper */}
      <button
        onClick={() => scrollHorizontally("right")}
        className="absolute right-0 z-10 h-full px-2 bg-gradient-to-l from-slate-800 via-slate-800 to-transparent text-slate-400 hover:text-white transition-colors flex items-center justify-center"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </footer>
  );
};

export default SheetNav;
