import React, { useEffect, useState } from "react";
import { IndicatorSummary } from "../types";
import { FileSpreadsheet, BarChart2, AlertTriangle, Info, Copy, Check, BookOpen, X, Bot, Loader2 } from "lucide-react";
import CpkChart from "./CpkChart";
import { calculateSpc, HistogramBinPrecision } from "../utils/spc";
import { t, useLocale } from "../i18n";
import { parseRFIndicator, RfMappingConfig } from "../utils/rfParser";
import { CpkLevelTag } from "./CpkLevelTag";
import { explainIndicatorWithAi } from "../ai/qualityAssistant";

interface ChartGridProps {
  indicators: IndicatorSummary[];
  visibleIndicatorIndexes: Set<number>;
  gridCols: number;
  pcbasnList: string[];
  selectedIndicatorIdx: number | null;
  onSelectIndicator: (idx: number) => void;
  chartTheme?: string;
  lineWidth?: number;
  binPrecision?: HistogramBinPrecision;
  rfMappings: RfMappingConfig;
  isAiEnabled: boolean;
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
  binPrecision,
  rfMappings,
  isAiEnabled,
}) => {
  const { locale } = useLocale();
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: "" });
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // activeDiagIdx stores the ABSOLUTE indicator index (from indicators[]), not visibleList relative index
  const [activeDiagIdx, setActiveDiagIdx] = useState<number | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainError, setAiExplainError] = useState("");
  const [explanationTab, setExplanationTab] = useState<"preview" | "raw">("preview");
  const [aiCopied, setAiCopied] = useState(false);

  // 监听选中检测项变化，实现右侧自动平滑滚动并垂直居中
  useEffect(() => {
    if (selectedIndicatorIdx !== null) {
      const element = document.getElementById(`indicator-card-${selectedIndicatorIdx}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedIndicatorIdx]);

  useEffect(() => {
    setAiExplanation(null);
    setAiExplainError("");
    setAiExplainLoading(false);
    setExplanationTab("preview");
    setAiCopied(false);
  }, [activeDiagIdx]);

  const handleCopyAiExplanation = (explanation: string) => {
    navigator.clipboard.writeText(explanation);
    setAiCopied(true);
    setToast({ visible: true, message: locale === "zh" ? "已复制 AI 解释到剪切板" : "Copied AI explanation to clipboard" });
    setTimeout(() => {
      setAiCopied(false);
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2000);
  };

  const handleAiExplain = async (indicator: IndicatorSummary) => {
    setAiExplainLoading(true);
    setAiExplainError("");
    try {
      const result = await explainIndicatorWithAi(
        {
          sheet_name: "",
          raw_sheet_name: "",
          test_metric_key: "",
          display_name: "",
          pcbasn_list: pcbasnList,
          indicators,
        },
        indicator,
        rfMappings,
        locale,
      );
      setAiExplanation(result);
    } catch (err) {
      setAiExplainError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiExplainLoading(false);
    }
  };

  const handleCopy = (e: React.UIEvent, text: string, idx: number) => {
    e.stopPropagation(); // 避免触发卡片的 onClick (onSelectIndicator)
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setToast({ visible: true, message: `${t("copied", locale)}: ${text}` });
    setTimeout(() => {
      setCopiedIdx(null);
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2000);
  };

  if (!indicators || indicators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 select-none">
        <div className="p-6 bg-slate-800/30 rounded-full border border-slate-700/30 shadow-inner">
          <FileSpreadsheet className="w-16 h-16 text-blue-500/30" />
        </div>
        <div className="text-center space-y-1 max-w-md">
          <h3 className="text-slate-300 font-medium text-sm">{t("noChartData", locale)}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t("noChartDataDesc", locale)}
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
        <span className="text-sm font-medium">{t("noFilterChartData", locale)}</span>
      </div>
    );
  }

  // 避免 Tailwind JIT 动态拼接失效，采用显式静态类名映射
  const gridColsClass =
    gridCols === 1
      ? "grid-cols-1"
      : gridCols === 2
        ? "grid-cols-2"
        : gridCols === 3
          ? "grid-cols-3"
          : gridCols === 4
            ? "grid-cols-4"
            : "grid-cols-2";

  return (
    <div className={`grid ${gridColsClass} gap-6 pb-12 relative`}>
      {/* 顶部中央的 Toast 提示框 */}
      {toast.visible && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 bg-slate-800/95 backdrop-blur border border-slate-600/80 text-slate-200 px-5 py-2.5 rounded-full shadow-2xl animate-bounce text-xs font-mono pointer-events-none transition-all duration-300">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="truncate max-w-md font-bold">{toast.message}</span>
        </div>
      )}

      {/* 权威专家诊断报告模态框 (Modal) */}
      {activeDiagIdx !== null && (() => {
        const ind = indicators[activeDiagIdx];
        if (!ind) return null;
        const spcRes = calculateSpc(ind, pcbasnList, locale, { binPrecision });
        const { cp, cpk, sigmaLevel, status, statusColor } = spcRes;

        // 计算规格中心与均值偏移率
        const usl = ind.usl !== null && ind.usl !== undefined ? ind.usl : null;
        const lsl = ind.lsl !== null && ind.lsl !== undefined ? ind.lsl : null;
        let specCenter: number | null = null;
        let kRatio: number | null = null;
        let diagType = "perfect"; // perfect | offset | dispersion | complex

        if (usl !== null && lsl !== null) {
          specCenter = (usl + lsl) / 2;
          const halfWidth = (usl - lsl) / 2;
          if (halfWidth > 0 && ind.average !== null && ind.average !== undefined) {
            kRatio = Math.abs(ind.average - specCenter) / halfWidth;
          }
        }

        if (cpk !== null && cpk < 1.0) {
          if (cp !== null && cp >= 1.33) {
            diagType = "offset";
          } else if (cp !== null && Math.abs(cp - cpk) < 0.2) {
            diagType = "dispersion";
          } else {
            diagType = "complex";
          }
        } else if (cpk !== null && cpk >= 1.33) {
          diagType = "perfect";
        } else {
          diagType = "dispersion"; // 边缘情况
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setActiveDiagIdx(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700/80">
                <div className="flex items-center space-x-3 truncate pr-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30 flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="truncate">
                    <h2 className="text-base font-bold text-slate-100 truncate">{t("diagModalTitle", locale)}</h2>
                    <p className="text-xs text-slate-400 truncate font-mono mt-0.5">{ind.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDiagIdx(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all border border-slate-700 flex-shrink-0 active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
                {/* 1. 核心规格与能力指标概览 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-2">
                    <span>{t("diagCoreMetrics", locale)}</span>
                  </h3>
                  <div className="grid grid-cols-4 gap-3 font-mono text-xs">
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("mean", locale)}</div>
                      <div className="text-slate-100 font-bold text-base mt-1">{ind.average ? ind.average.toFixed(4) : "-"}</div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("stdev", locale)}</div>
                      <div className="text-slate-100 font-bold text-base mt-1">{ind.stdev ? ind.stdev.toFixed(4) : "-"}</div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("diagSpecCenter", locale)}</div>
                      <div className="text-slate-100 font-bold text-base mt-1">{specCenter !== null ? specCenter.toFixed(2) : "-"}</div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("diagOffsetRatio", locale)}</div>
                      <div className={`font-bold text-base mt-1 ${kRatio !== null && kRatio > 0.25 ? "text-amber-400" : "text-emerald-400"}`}>
                        {kRatio !== null ? `${(kRatio * 100).toFixed(1)}%` : "-"}
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("cp", locale)}</div>
                      <div className={`font-bold text-base mt-1 ${cp !== null && cp < 1.33 ? "text-rose-400" : "text-emerald-400"}`}>
                        {cp !== null ? cp.toFixed(2) : "-"}
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">CPK</div>
                      <div className={`font-bold text-base mt-1`} style={{ color: statusColor }}>
                        {cpk !== null ? cpk.toFixed(2) : "-"}
                      </div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("sigmaLevel", locale)}</div>
                      <div className="text-blue-400 font-bold text-base mt-1">{sigmaLevel !== null ? `${sigmaLevel.toFixed(2)} σ` : "-"}</div>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-inner">
                      <div className="text-slate-500 text-[11px]">{t("spcStatusTitle", locale)}</div>
                      <div className="font-bold text-sm mt-1 truncate py-0.5" style={{ color: statusColor }}>{status}</div>
                    </div>
                  </div>
                </div>

                {/* 2. 制程状态与根因深度剖析 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-2">
                    <span>{t("diagRootCause", locale)}</span>
                  </h3>
                  <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 leading-relaxed text-slate-200">
                    {diagType === "perfect" && <p>{t("diagStatusPerfect", locale)}</p>}
                    {diagType === "offset" && <p>{t("diagStatusOffset", locale)}</p>}
                    {diagType === "dispersion" && <p>{t("diagStatusDispersion", locale)}</p>}
                    {diagType === "complex" && <p>{t("diagStatusComplex", locale)}</p>}
                  </div>
                </div>

                {/* 3. 工程实施与整改建议 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                    <span>{t("diagAction", locale)}</span>
                  </h3>
                  <div className={`p-4 rounded-xl border leading-relaxed ${diagType === "perfect" ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200" :
                    diagType === "offset" ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200" :
                      "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200"
                    }`}>
                    <div className="font-bold mb-1 flex items-center space-x-2">
                      {diagType === "perfect" ? <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                      <span>{t("actionTriggerTitle", locale)}</span>
                    </div>
                    <p className="text-xs opacity-90">
                      {diagType === "perfect" && t("diagActionPerfect", locale)}
                      {diagType === "offset" && t("diagActionOffset", locale)}
                      {diagType === "dispersion" && t("diagActionDispersion", locale)}
                      {diagType === "complex" && t("diagActionComplex", locale)}
                    </p>
                  </div>
                </div>

                {isAiEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 dark:text-cyan-400 flex items-center space-x-2">
                        <span>{locale === "zh" ? "AI 根因解释" : "AI Root-Cause Explanation"}</span>
                      </h3>
                      <div className="flex items-center space-x-2">
                        {aiExplanation && (
                          <>
                            <div className="flex items-center bg-slate-950/60 p-0.5 rounded-lg border border-slate-800 mr-2">
                              <button
                                type="button"
                                onClick={() => setExplanationTab("preview")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  explanationTab === "preview"
                                    ? "bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-inner"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                {locale === "zh" ? "预览" : "Preview"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setExplanationTab("raw")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  explanationTab === "raw"
                                    ? "bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-inner"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                              >
                                Markdown
                              </button>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleCopyAiExplanation(aiExplanation)}
                              className="flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition-all hover:bg-slate-700 mr-2"
                              title={locale === "zh" ? "复制 Markdown 格式" : "Copy Markdown format"}
                            >
                              {aiCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                              <span>{locale === "zh" ? "复制" : "Copy"}</span>
                            </button>
                          </>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleAiExplain(ind)}
                          disabled={aiExplainLoading}
                          className="flex items-center space-x-1.5 rounded-lg border border-transparent bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-cyan-600/10 hover:bg-cyan-700 transition-all dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20 dark:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {aiExplainLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                          <span>{locale === "zh" ? "生成解释" : "Generate"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 text-xs leading-relaxed text-slate-300">
                      {!aiExplanation && !aiExplainError && (
                        <p className="text-slate-400">
                          {locale === "zh"
                            ? "AI 会基于上方确定性 CPK/SPC 指标生成工程语言解释，不参与原始计算。"
                            : "AI will explain the deterministic CPK/SPC facts above in engineering language; it does not perform the underlying calculation."}
                        </p>
                      )}
                      {aiExplainError && <p className="text-rose-300">{aiExplainError}</p>}
                      {aiExplanation && (
                        explanationTab === "raw" ? (
                          <pre className="font-mono text-[10px] whitespace-pre-wrap select-all text-slate-300 max-h-60 overflow-y-auto bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                            {aiExplanation}
                          </pre>
                        ) : (
                          <MarkdownPreview content={aiExplanation} />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* 4. 统计学理论基准说明 */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                    <span>{t("diagTheory", locale)}</span>
                  </h3>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed space-y-2 shadow-inner">
                    <p>{t("diagTheoryDesc", locale)}</p>
                    <div className="flex items-center space-x-6 pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-500">
                      <span>Formula: Cpk = Cp × (1 - k)</span>
                      <span>|</span>
                      <span>k = |μ - M| / ((USL - LSL) / 2)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveDiagIdx(null)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95"
                >
                  {t("completeSettings", locale)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {visibleList.map(({ ind, idx }) => {
        // 调用底层的六西格玛诊断数据
        const spcRes = calculateSpc(ind, pcbasnList, locale, { binPrecision });
        const { cp, cpk, sigmaLevel, status, statusColor, actionTrigger, cpAlert } = spcRes;
        const isSelected = selectedIndicatorIdx === idx;

        return (
          <div
            key={idx}
            id={`indicator-card-${idx}`}
            onClick={() => onSelectIndicator(idx)}
            style={{ borderColor: statusColor }}
            className={`bg-slate-800/60 rounded-xl p-5 flex flex-col space-y-4 cursor-pointer select-none relative overflow-hidden transition-all duration-300 ${isSelected
              ? "border-4 shadow-2xl scale-[1.02] shadow-slate-700/50 z-10"
              : "border-2 shadow-xl hover:shadow-2xl hover:scale-[1.01] opacity-90 hover:opacity-100"
              }`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
              {(() => {
                const parsed = parseRFIndicator(ind.name, rfMappings);
                return (
                  <div className="flex flex-col truncate pr-2 group/header flex-1">
                    <div className="flex items-center space-x-2 truncate">
                      <BarChart2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <h3
                        className="font-bold text-sm truncate text-slate-100 group-hover:text-blue-400 transition-colors"
                        title={ind.name}
                      >
                        {parsed.displayName}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, ind.name, idx)}
                        title={t("copyIndicator", locale)}
                        className="p-1 rounded bg-slate-700/0 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-all flex-shrink-0 opacity-80 group-hover/header:opacity-100 active:scale-95"
                      >
                        {copiedIdx === idx ? (
                          <Check className="w-3 h-3 text-emerald-400 animate-pulse" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 truncate select-all" title={ind.name}>
                      {ind.name}
                    </span>
                  </div>
                );
              })()}

              {/* Status & CPK Badge */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <CpkLevelTag cpk={cpk} variant="status">
                  {status}
                </CpkLevelTag>
                <div className="flex items-center space-x-1 text-xs font-mono bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700 shadow-inner">
                  <span className="text-slate-400">CPK:</span>
                  <span style={{ color: statusColor }} className="font-bold">
                    {cpk !== null ? cpk.toFixed(2) : "N/A"}
                  </span>
                </div>
                {/* 权威专家诊断弹窗按钮：传入绝对索引 idx */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDiagIdx(idx); // idx is absolute index from indicators[]
                  }}
                  title={t("viewDiagReport", locale)}
                  className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all flex-shrink-0 hover:scale-105 active:scale-95 shadow-lg"
                >
                  <BookOpen className="w-3.5 h-3.5 animate-pulse" />
                </button>
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
                binPrecision={binPrecision}
              />
              {isSelected && (
                <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] text-amber-300 font-mono animate-pulse pointer-events-none">
                  {t("selectedIndicator", locale)}
                </div>
              )}
            </div>

            {/* Statistical Parameters Footer (7 Columns: N + mean + stdev + USL + LSL + Cp + Sigma) */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono border-t border-slate-700/40 pt-3">
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">N</div>
                <div className="text-blue-300 truncate font-bold">{ind.values?.length ?? 0}</div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">{t("mean", locale)}</div>
                <div className="text-slate-200 truncate font-bold" title={ind.average?.toString()}>
                  {ind.average ? ind.average.toFixed(2) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">{t("stdev", locale)}</div>
                <div className="text-slate-200 truncate font-bold" title={ind.stdev?.toString()}>
                  {ind.stdev ? ind.stdev.toFixed(4) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">{t("usl", locale)}</div>
                <div className="text-slate-200 truncate font-bold" title={ind.usl?.toString()}>
                  {ind.usl !== null && ind.usl !== undefined ? ind.usl : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">{t("lsl", locale)}</div>
                <div className="text-slate-200 truncate font-bold" title={ind.lsl?.toString()}>
                  {ind.lsl !== null && ind.lsl !== undefined ? ind.lsl : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[8px] text-slate-500">{t("cp", locale)}</div>
                <div
                  className={`truncate font-bold ${cpAlert ? "text-rose-400 animate-pulse" : "text-slate-200"}`}
                  title={cp?.toString()}
                >
                  {cp !== null ? cp.toFixed(2) : "-"}
                </div>
              </div>
              <div className="bg-slate-900/40 p-1.5 rounded border border-slate-800/80 shadow-inner">
                <div className="text-[10px] text-slate-500">{t("sigmaLevel", locale)}</div>
                <div className="text-blue-400 truncate font-bold" title={sigmaLevel?.toString()}>
                  {sigmaLevel !== null ? `${sigmaLevel.toFixed(2)} σ` : "-"}
                </div>
              </div>
            </div>

            {/* 六西格玛 Action Trigger 诊断栏 */}
            {actionTrigger && (
              <div
                className={`flex items-start space-x-2 p-2.5 rounded-lg border text-xs leading-relaxed ${cpAlert || (cpk !== null && cpk < 1.0)
                  ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200"
                  : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200"
                  }`}
              >
                {cpAlert || (cpk !== null && cpk < 1.0) ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 overflow-hidden">
                  <div className="font-bold mb-0.5">{t("actionTriggerTitle", locale)}</div>
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

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  if (!content) return null;

  const renderInlineMarkdown = (text: string) => {
    const codeParts = text.split(/`(.*?)`/g);
    return codeParts.map((codePart, codeIdx) => {
      if (codeIdx % 2 === 1) {
        return (
          <code key={`code-${codeIdx}`} className="px-1 py-0.5 bg-slate-850 rounded font-mono text-[10px] text-cyan-650 dark:text-cyan-300 border border-slate-700 font-medium">
            {codePart}
          </code>
        );
      }
      const boldParts = codePart.split(/\*\*(.*?)\*\*/g);
      return boldParts.map((boldPart, boldIdx) => {
        if (boldIdx % 2 === 1) {
          return (
            <strong key={`bold-${codeIdx}-${boldIdx}`} className="font-bold text-slate-100">
              {boldPart}
            </strong>
          );
        }
        return boldPart;
      });
    });
  };

  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = (key: string | number) => {
    if (listItems.length > 0) {
      if (listType === "ul") {
        renderedElements.push(
          <ul key={`ul-${key}`} className="list-disc pl-5 mb-3 space-y-1 text-slate-300">
            {listItems}
          </ul>
        );
      } else {
        renderedElements.push(
          <ol key={`ol-${key}`} className="list-decimal pl-5 mb-3 space-y-1 text-slate-300">
            {listItems}
          </ol>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const leadingSpaces = line.length - line.trimStart().length;

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***") {
      flushList(idx);
      renderedElements.push(<hr key={idx} className="my-4 border-slate-700/60" />);
      return;
    }

    // Headers
    if (trimmed.startsWith("#")) {
      flushList(idx);
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const headingClasses =
          level === 1
            ? "text-base font-extrabold text-slate-100 mt-5 mb-2.5"
            : level === 2
              ? "text-sm font-bold text-slate-200 mt-4 mb-2"
              : "text-xs font-bold text-cyan-600 dark:text-cyan-400 mt-3.5 mb-1.5 border-l-2 border-cyan-500 pl-2 flex items-center space-x-1.5";
        renderedElements.push(
          <div key={idx} className={headingClasses}>
            {renderInlineMarkdown(text)}
          </div>
        );
        return;
      }
    }

    // Unordered List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (listType && listType !== "ul") {
        flushList(idx);
      }
      listType = "ul";
      const text = trimmed.substring(2);
      const indentClass = leadingSpaces >= 4 ? "ml-6 list-[circle]" : "ml-2";
      listItems.push(
        <li key={idx} className={`text-slate-300 text-xs leading-relaxed ${indentClass}`}>
          {renderInlineMarkdown(text)}
        </li>
      );
      return;
    }

    // Ordered List
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (listType && listType !== "ol") {
        flushList(idx);
      }
      listType = "ol";
      const text = olMatch[2];
      const indentClass = leadingSpaces >= 4 ? "ml-6" : "ml-2";
      listItems.push(
        <li key={idx} className={`text-slate-300 text-xs leading-relaxed ${indentClass}`}>
          {renderInlineMarkdown(text)}
        </li>
      );
      return;
    }

    // Blank line
    if (trimmed === "") {
      flushList(idx);
      return;
    }

    // Normal paragraph
    flushList(idx);
    renderedElements.push(
      <p key={idx} className="mb-2 text-xs text-slate-300 leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });

  flushList("final");

  return <div className="space-y-1">{renderedElements}</div>;
};

export default ChartGrid;
