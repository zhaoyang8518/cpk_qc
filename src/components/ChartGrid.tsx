import React, { useEffect } from "react";
import { IndicatorSummary } from "../types";
import { FileSpreadsheet, BarChart2, AlertTriangle, Info } from "lucide-react";
import CpkChart from "./CpkChart";
import { calculateSpc } from "../utils/spc";

interface ChartGridProps {
  indicators: IndicatorSummary[];
  visibleIndicatorIndexes: Set<number>;
  gridCols: number;
  pcbasnList: string[];
  selectedIndicatorIdx: number | null;
  onSelectIndicator: (idx: number) => void;
  chartTheme?: string;
  lineWidth?: number;
}

const ChartGrid: React.FC<ChartGridProps> = ({
  indicators,
  visibleIndicatorIndexes,
  gridCols,
  pcbasnList,
  selectedIndicatorIdx,
  onSelectIndicator,
  chartTheme,
  lineWidth,
}) => {
  // 监听选中检测项变化，实现右侧自动平滑滚动并垂直居中
  useEffect(() => {
    if (selectedIndicatorIdx !== null) {
      const element = document.getElementById(`indicator-card-${selectedIndicatorIdx}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedIndicatorIdx]);

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

  const visibleList = indicators.map((ind, idx) => ({ ind, idx })).filter(({ idx }) => visibleIndicatorIndexes.has(idx));

  if (visibleList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 p-6 text-center select-none">
        <BarChart2 className="w-12 h-12 opacity-20 mb-2" />
        <span className="text-sm font-medium">无符合过滤条件的检测项图表</span>
      </div>
    );
  }

  // 避免 Tailwind JIT 动态拼接失效，采用显式静态类名映射
  const gridColsClass =
    gridCols === 1 ? "grid-cols-1" : gridCols === 2 ? "grid-cols-2" : gridCols === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid ${gridColsClass} gap-6 pb-12`}>
      {visibleList.map(({ ind, idx }) => {
        // 调用底层的六西格玛诊断数据
        const spcRes = calculateSpc(ind, pcbasnList);
        const { cp, cpk, sigmaLevel, status, statusColor, actionTrigger, cpAlert } = spcRes;
        const isSelected = selectedIndicatorIdx === idx;

        return (
          <div
            key={idx}
            id={`indicator-card-${idx}`}
            onClick={() => onSelectIndicator(idx)}
            style={{ borderColor: statusColor }}
            className={`bg-slate-800/60 rounded-xl p-5 flex flex-col space-y-4 cursor-pointer select-none relative overflow-hidden transition-all duration-300 ${
              isSelected
                ? "border-4 shadow-2xl scale-[1.02] shadow-slate-700/50 z-10"
                : "border-2 shadow-xl hover:shadow-2xl hover:scale-[1.01] opacity-90 hover:opacity-100"
            }`}
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

              {/* Status & CPK Badge */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <span
                  style={{ color: statusColor, borderColor: statusColor }}
                  className="text-[10px] px-2 py-0.5 rounded-lg border bg-slate-900/60 font-mono shadow-inner"
                >
                  {status}
                </span>
                <div className="flex items-center space-x-1 text-xs font-mono bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700 shadow-inner">
                  <span className="text-slate-400">CPK:</span>
                  <span style={{ color: statusColor }} className="font-bold">
                    {cpk !== null ? cpk.toFixed(2) : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* ECharts CpkChart Area */}
            <div className="h-64 bg-slate-900/40 rounded-lg flex flex-col items-center justify-center border border-slate-800 relative shadow-inner overflow-hidden p-2">
              <CpkChart
                indicator={ind}
                pcbasnList={pcbasnList}
                selectedAsn={null}
                chartTheme={chartTheme}
                lineWidth={lineWidth}
              />
              {isSelected && (
                <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] text-amber-300 font-mono animate-pulse pointer-events-none">
                  当前选中检测项
                </div>
              )}
            </div>

            {/* Statistical Parameters Footer (6 Columns) */}
            <div className="grid grid-cols-6 gap-1.5 text-center text-xs font-mono border-t border-slate-700/40 pt-3">
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">均值 μ</div>
                <div className="text-slate-200 truncate font-bold" title={ind.average?.toString()}>
                  {ind.average ? ind.average.toFixed(2) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">标准差 σ</div>
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
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">Cp (精密度)</div>
                <div
                  className={`truncate font-bold ${cpAlert ? "text-rose-400 animate-pulse" : "text-slate-200"}`}
                  title={cp?.toString()}
                >
                  {cp !== null ? cp.toFixed(2) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">Sigma 水平</div>
                <div className="text-blue-400 truncate font-bold" title={sigmaLevel?.toString()}>
                  {sigmaLevel !== null ? `${sigmaLevel.toFixed(2)} σ` : "-"}
                </div>
              </div>
            </div>

            {/* 六西格玛 Action Trigger 诊断栏 */}
            {actionTrigger && (
              <div
                className={`flex items-start space-x-2 p-2.5 rounded-lg border text-xs leading-relaxed ${
                  cpAlert || (cpk !== null && cpk < 1.0)
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                }`}
              >
                {cpAlert || (cpk !== null && cpk < 1.0) ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 overflow-hidden">
                  <div className="font-bold mb-0.5">六西格玛 AI 诊断触发器 (Action Trigger)</div>
                  <p className="text-[11px] opacity-90">{actionTrigger}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChartGrid;
