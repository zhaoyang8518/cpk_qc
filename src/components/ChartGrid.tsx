import React from "react";
import { IndicatorSummary } from "../types";
import { FileSpreadsheet, BarChart2 } from "lucide-react";
import CpkChart from "./CpkChart";

interface ChartGridProps {
  indicators: IndicatorSummary[];
  gridCols: number;
  selectedAsn: string | null;
  pcbasnList: string[];
}

const ChartGrid: React.FC<ChartGridProps> = ({ indicators, gridCols, selectedAsn, pcbasnList }) => {
  if (!indicators || indicators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 select-none">
        <div className="p-6 bg-slate-800/30 rounded-full border border-slate-700/30 shadow-inner">
          <FileSpreadsheet className="w-16 h-16 text-blue-500/30" />
        </div>
        <div className="text-center space-y-1 max-w-md">
          <h3 className="text-slate-300 font-medium text-sm">暂无统计图表数据</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            请点击右上角“导入 Excel”按钮加载工作表数据，系统将自动进行直方图分箱与正态拟合分析。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-${gridCols} gap-6 pb-12`}>
      {indicators.map((ind, idx) => {
        const cpk = ind.cpk;
        const cpkColor =
          cpk && cpk >= 1.33 ? "text-emerald-400" : cpk && cpk >= 1.0 ? "text-amber-400" : "text-rose-400";

        return (
          <div
            key={idx}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-xl flex flex-col space-y-4 hover:border-slate-600 transition-all hover:shadow-2xl group select-none relative overflow-hidden"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
              <div className="flex items-center space-x-2 truncate pr-2">
                <BarChart2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <h3
                  className="font-bold text-sm truncate text-slate-100 group-hover:text-blue-400 transition-colors"
                  title={ind.name}
                >
                  {ind.name}
                </h3>
              </div>

              {/* CPK Badge */}
              <div className="flex items-center space-x-1.5 text-xs font-mono bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-700 flex-shrink-0 shadow-inner">
                <span className="text-slate-400">CPK:</span>
                <span className={`font-bold ${cpkColor}`}>{cpk ? cpk.toFixed(2) : "N/A"}</span>
              </div>
            </div>

            {/* ECharts CpkChart Area */}
            <div className="h-64 bg-slate-900/40 rounded-lg flex flex-col items-center justify-center border border-slate-800 relative shadow-inner overflow-hidden p-2">
              <CpkChart indicator={ind} pcbasnList={pcbasnList} selectedAsn={selectedAsn} />
              {selectedAsn && (
                <div className="absolute top-2 right-2 bg-blue-600/30 border border-blue-500/40 px-2 py-0.5 rounded text-[10px] text-blue-300 font-mono animate-pulse pointer-events-none">
                  联动选中: {selectedAsn}
                </div>
              )}
            </div>

            {/* Statistical Parameters Footer */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono border-t border-slate-700/40 pt-3">
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">均值</div>
                <div className="text-slate-200 truncate font-bold" title={ind.average?.toString()}>
                  {ind.average ? ind.average.toFixed(2) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">标准差</div>
                <div className="text-slate-200 truncate font-bold" title={ind.stdev?.toString()}>
                  {ind.stdev ? ind.stdev.toFixed(4) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">USL</div>
                <div className="text-slate-200 truncate font-bold" title={ind.usl?.toString()}>
                  {ind.usl !== null && ind.usl !== undefined ? ind.usl : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">LSL</div>
                <div className="text-slate-200 truncate font-bold" title={ind.lsl?.toString()}>
                  {ind.lsl !== null && ind.lsl !== undefined ? ind.lsl : "-"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChartGrid;
