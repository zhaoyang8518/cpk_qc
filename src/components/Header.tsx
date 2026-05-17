import React from "react";
import { FileSpreadsheet, Settings, Download, LayoutGrid, Loader2 } from "lucide-react";

interface HeaderProps {
  fileName: string;
  loading: boolean;
  gridCols: number;
  onImport: () => void;
  onGridChange: (cols: number) => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({
  fileName,
  loading,
  gridCols,
  onImport,
  onGridChange,
  onExport,
  onOpenSettings,
}) => {
  const gridOptions = [
    { cols: 1, label: "单列", title: "右侧图表矩阵：每行显示 1 个图表" },
    { cols: 2, label: "双列", title: "右侧图表矩阵：每行显示 2 个图表" },
    { cols: 3, label: "三列", title: "右侧图表矩阵：每行显示 3 个图表" },
  ];

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 shadow-md z-20 select-none">
      {/* Left Logo & File Info */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30 shadow-inner">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-wider text-slate-100">CQC</h1>
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
          <span className="text-sm">{loading ? "正在解析..." : "导入 Excel"}</span>
        </button>

        {/* Grid Columns Switcher */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 shadow-inner space-x-1">
          {gridOptions.map((option) => (
            <button
              key={option.cols}
              onClick={() => onGridChange(option.cols)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${gridCols === option.cols ? "bg-blue-600 text-white shadow scale-105" : "text-slate-400 hover:text-slate-200"
                }`}
              title={option.title}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {/* Auxiliary Actions (Export & Settings) */}
        <div className="flex items-center space-x-2 border-l border-slate-700/60 pl-4">
          <button
            onClick={onExport}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white active:scale-95 rounded-lg border border-slate-700 transition-all shadow-sm flex items-center space-x-1.5 px-3 text-xs"
            title="将当前工作表数据及统计指标导出为 JSON 报告"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>导出报告</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white active:scale-95 rounded-lg border border-slate-700 transition-all shadow-sm flex items-center space-x-1.5 px-3 text-xs"
            title="打开高级系统设置面板"
          >
            <Settings className="w-3.5 h-3.5 text-blue-400" />
            <span>高级设置</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
