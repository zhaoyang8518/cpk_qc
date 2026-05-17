import React from "react";
import { FileSpreadsheet, Settings, Download, LayoutGrid, Loader2 } from "lucide-react";

interface HeaderProps {
  fileName: string;
  loading: boolean;
  gridCols: number;
  onImport: () => void;
  onGridChange: (cols: number) => void;
}

const Header: React.FC<HeaderProps> = ({ fileName, loading, gridCols, onImport, onGridChange }) => {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 shadow-md z-20 select-none">
      {/* Left Logo & File Info */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 shadow-inner">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-wider text-slate-100">ckp_qc</h1>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono">
              v0.1.0
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate max-w-md mt-0.5" title={fileName}>
            {fileName}
          </p>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-4">
        {/* Import Button */}
        <button
          onClick={onImport}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none border border-blue-500/50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          <span className="text-sm">{loading ? "正在高效解析..." : "导入 Excel"}</span>
        </button>

        {/* Grid Columns Switcher */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 shadow-inner space-x-1">
          <button
            onClick={() => onGridChange(2)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              gridCols === 2 ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
            title="每行 2 个图表"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>2列</span>
          </button>
          <button
            onClick={() => onGridChange(3)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              gridCols === 3 ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
            title="每行 3 个图表"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>3列</span>
          </button>
        </div>

        {/* Auxiliary Actions */}
        <div className="flex items-center space-x-2 border-l border-slate-700/60 pl-4">
          <button
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-sm"
            title="导出当前分析报告"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-sm"
            title="系统设置"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
