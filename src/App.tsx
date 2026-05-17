import React, { useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { writeFile } from "@tauri-apps/plugin-fs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as echarts from "echarts";
import { FileSpreadsheet } from "lucide-react";
import { SheetData } from "./types";
import Header from "./components/Header";
import SheetNav from "./components/SheetNav";
import PcbaList from "./components/PcbaList";
import ChartGrid from "./components/ChartGrid";
import SettingsModal from "./components/SettingsModal";
import { t, Locale, LocaleProvider } from "./i18n";

export type CpkStatus = "red" | "yellow" | "green" | "cyan";

const getCpkStatus = (cpk: number | null): CpkStatus => {
  if (cpk !== null && cpk !== undefined && cpk >= 2.0) return "cyan";
  if (cpk !== null && cpk !== undefined && cpk >= 1.33) return "green";
  if (cpk !== null && cpk !== undefined && cpk >= 1.0) return "yellow";
  return "red";
};

const App: React.FC = () => {
  const [locale, setLocale] = useState<Locale>("en");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [displayFileName, setDisplayFileName] = useState<string>("");
  const [gridCols, setGridCols] = useState<number>(2);
  const [selectedIndicatorIdx, setSelectedIndicatorIdx] = useState<number | null>(null);
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState<string>("");
  const [enabledCpkStatuses, setEnabledCpkStatuses] = useState<Set<CpkStatus>>(
    () => new Set(["red", "yellow", "green", "cyan"])
  );

  const [exportProgress, setExportProgress] = useState<{
    visible: boolean;
    percent: number;
    text: string;
  }>({ visible: false, percent: 0, text: "" });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [chartTheme, setChartTheme] = useState<string>("#5470c6");
  const [lineWidth, setLineWidth] = useState<number>(2.5);

  const currentSheet = useMemo(() => sheets[activeSheetIdx] || null, [sheets, activeSheetIdx]);

  const handleImport = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [
          {
            name: "Excel Files",
            extensions: ["xlsx", "xls", "xlsm", "xlsb"],
          },
        ],
      });

      if (!selectedPath) return;

      setLoading(true);
      const res: SheetData[] = await invoke("parse_excel", { path: selectedPath });
      setSheets(res);
      setActiveSheetIdx(0);
      setSelectedIndicatorIdx(null);
      setDisplayFileName(selectedPath.split(/[/\\]/).pop() || selectedPath);
    } catch (err: any) {
      alert(`${t("importFailed", locale)}${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!sheets || sheets.length === 0) {
      alert(t("noDataExport", locale));
      return;
    }

    const sheet = sheets[activeSheetIdx];
    if (!sheet || !sheet.indicators || sheet.indicators.length === 0) {
      alert(t("noIndicatorExport", locale));
      return;
    }

    try {
      setExportProgress({ visible: true, percent: 5, text: t("exportInit", locale) });
      await new Promise((r) => setTimeout(r, 10));

      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 14;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const contentW = pageWidth - margin * 2;

      setExportProgress({ visible: true, percent: 10, text: t("exportFont", locale) });
      await new Promise((r) => setTimeout(r, 10));

      pdf.addFont("public/fonts/SimHei.ttf", "SimHei", "normal");
      pdf.setFont("SimHei");

      let y = margin + 12;
      pdf.setFontSize(24);
      pdf.setTextColor(15, 23, 42);
      pdf.text(t("reportMainTitle", locale), margin, y);

      y += 6;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 115, 130);
      pdf.text(t("reportSubtitle", locale), margin, y);

      y += 12;
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(t("reportInfoTitle", locale), margin, y);
      y += 6;

      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const infoRows = [
        [t("infoFileName", locale), displayFileName || t("noFile", locale)],
        [t("infoSheetName", locale), sheet.sheet_name],
        [t("infoTime", locale), ts],
        [t("infoIndCount", locale), String(sheet.indicators.length)],
        [t("infoSampleCount", locale), String(sheet.pcbasn_list.length)],
      ];

      pdf.setFontSize(10);
      for (const [label, value] of infoRows) {
        pdf.setTextColor(100, 110, 130);
        pdf.text(label, margin, y);
        pdf.setTextColor(30, 41, 59);
        pdf.text(value, margin + 40, y);
        y += 6.5;
      }

      y += 6;
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(t("execSummaryTitle", locale), margin, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      const summaryText = t("execSummaryText", locale);
      const splitSummary = pdf.splitTextToSize(summaryText, contentW);
      pdf.text(splitSummary, margin, y);
      y += splitSummary.length * 5 + 8;

      setExportProgress({ visible: true, percent: 15, text: t("exportCapSummaryTable", locale) });
      pdf.setFontSize(14);
      pdf.text(t("capSummaryTitle", locale), margin, y);
      y += 4;

      const totalInds = sheet.indicators.length;
      const statusSummaryData = [
        [t("worldClass", locale), "CPK ≥ 2.00 (≥ 6 Sigma)", String(cpkStatusCounts.cyan), `${((cpkStatusCounts.cyan / totalInds) * 100 || 0).toFixed(1)}%`, t("capWorldClassDesc", locale)],
        [t("good", locale), "1.33 ≤ CPK < 2.00 (4~6 Sigma)", String(cpkStatusCounts.green), `${((cpkStatusCounts.green / totalInds) * 100 || 0).toFixed(1)}%`, t("capGoodDesc", locale)],
        [t("passable", locale), "1.00 ≤ CPK < 1.33 (3~4 Sigma)", String(cpkStatusCounts.yellow), `${((cpkStatusCounts.yellow / totalInds) * 100 || 0).toFixed(1)}%`, t("capPassableDesc", locale)],
        [t("fail", locale), "CPK < 1.00 (< 3 Sigma)", String(cpkStatusCounts.red), `${((cpkStatusCounts.red / totalInds) * 100 || 0).toFixed(1)}%`, t("capFailDesc", locale)],
      ];

      autoTable(pdf, {
        startY: y,
        head: [[t("capLevelName", locale), t("capCriteria", locale), t("capIndCount", locale), t("capRatio", locale), t("capDesc", locale)]],
        body: statusSummaryData,
        theme: "grid",
        styles: { font: "SimHei" },
        headStyles: { fillColor: [15, 23, 42] },
      });

      y = (pdf as any).lastAutoTable.finalY + 12;
      setExportProgress({ visible: true, percent: 25, text: t("exportIndIndexTable", locale) });
      pdf.setFontSize(14);
      pdf.text(t("indIndexTitle", locale), margin, y);
      y += 4;

      const sorted = [...sheet.indicators].sort((a, b) => (b.cpk ?? -Infinity) - (a.cpk ?? -Infinity));
      const indTableData = sorted.map((ind, idx) => [
        String(idx + 1),
        ind.name,
        ind.average?.toFixed(2) ?? "-",
        ind.stdev?.toFixed(4) ?? "-",
        ind.cpk?.toFixed(2) ?? "-",
      ]);

      autoTable(pdf, {
        startY: y,
        head: [["#", t("indName", locale), t("indMean", locale), t("indStdev", locale), t("indCpk", locale)]],
        body: indTableData,
        theme: "striped",
        styles: { font: "SimHei" },
      });

      const targetIndicators = sheet.indicators
        .map((ind, index) => ({ ind, index }))
        .filter(({ ind }) => {
          const st = getCpkStatus(ind.cpk);
          return st === "red" || st === "yellow";
        });

      if (targetIndicators.length > 0) {
        for (let i = 0; i < targetIndicators.length; i++) {
          const { ind, index: idx } = targetIndicators[i];
          setExportProgress({ visible: true, percent: 30 + (i / targetIndicators.length) * 60, text: `${t("exportExtractChart", locale)}: ${ind.name.slice(0, 10)}` });
          const cardEl = document.getElementById(`indicator-card-${idx}`);
          if (!cardEl) continue;
          const chartDom = cardEl.querySelector(".echarts-for-react") || cardEl.querySelector("div[_echarts_instance_]") || cardEl;
          const chartInstance = echarts.getInstanceByDom(chartDom as HTMLElement);
          let imgData: string | null = null;
          let imgW = 160;
          let imgH = 100;
          if (chartInstance) {
            imgData = chartInstance.getDataURL({
              type: "png",
              pixelRatio: 2,
              backgroundColor: "#0f172a",
            });
          } else {
            const canvas = await html2canvas(cardEl as HTMLElement, {
              scale: 2,
              backgroundColor: "#0f172a",
              logging: false,
            });
            imgData = canvas.toDataURL("image/png");
            imgW = 160;
            imgH = (canvas.height / canvas.width) * imgW;
          }

          if (y + imgH + 15 > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            y = margin;
          } else {
            y += 10;
          }

          pdf.setFontSize(12);
          pdf.setTextColor(30, 41, 59);
          pdf.text(`[${t("abnormalAnalysisTitle", locale)}] #${idx + 1} - ${ind.name}`, margin, y);
          y += 5;

          pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);
          y += imgH + 5;
        }
      }

      setExportProgress({ visible: true, percent: 92, text: t("exportSaveLoc", locale) });
      await new Promise((r) => setTimeout(r, 100));

      const defaultFileName = `CPK_Report_${sheet.sheet_name}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.pdf`;
      const savePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: "PDF Report", extensions: ["pdf"] }],
      });

      if (!savePath) {
        setExportProgress({ visible: false, percent: 0, text: "" });
        return;
      }

      setExportProgress({ visible: true, percent: 95, text: t("exportWriteDisk", locale) });
      await new Promise((r) => setTimeout(r, 100));

      const pdfBuffer = pdf.output("arraybuffer");
      await writeFile(savePath, new Uint8Array(pdfBuffer));

      setExportProgress({ visible: true, percent: 100, text: t("exportSuccess", locale) });
      await new Promise((r) => setTimeout(r, 500));

      alert(t("exportSuccess", locale));
    } catch (err: any) {
      alert(`${t("exportFailed", locale)}${err}`);
    } finally {
      setExportProgress({ visible: false, percent: 0, text: "" });
    }
  };

  const visibleIndicators = useMemo(() => {
    const indicators = currentSheet?.indicators || [];
    const query = indicatorSearchQuery.trim().toLowerCase();
    return indicators
      .map((indicator, index) => ({ indicator, index }))
      .filter(({ indicator }) => {
        const matchesSearch = !query || indicator.name.toLowerCase().includes(query);
        const matchesStatus = enabledCpkStatuses.has(getCpkStatus(indicator.cpk));
        return matchesSearch && matchesStatus;
      });
  }, [currentSheet?.indicators, indicatorSearchQuery, enabledCpkStatuses]);

  const visibleIndicatorIndexes = useMemo(() => new Set(visibleIndicators.map(({ index }) => index)), [visibleIndicators]);

  const cpkStatusCounts = useMemo(() => {
    const counts: Record<CpkStatus, number> = { red: 0, yellow: 0, green: 0, cyan: 0 };
    (currentSheet?.indicators || []).forEach((indicator) => {
      counts[getCpkStatus(indicator.cpk)] += 1;
    });
    return counts;
  }, [currentSheet?.indicators]);

  return (
    <LocaleProvider value={{ locale, setLocale }}>
      <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
        <Header
          fileName={displayFileName}
          loading={loading}
          gridCols={gridCols}
          onImport={handleImport}
          onGridChange={setGridCols}
          onExport={handleExport}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <div className="flex flex-1 overflow-hidden relative">
          <PcbaList
            indicators={currentSheet?.indicators || []}
            visibleIndicators={visibleIndicators}
            selectedIndicatorIdx={selectedIndicatorIdx}
            onSelectIndicator={setSelectedIndicatorIdx}
            searchQuery={indicatorSearchQuery}
            onSearchChange={setIndicatorSearchQuery}
            enabledStatuses={enabledCpkStatuses}
            statusCounts={cpkStatusCounts}
            onToggleStatus={(status) => {
              setEnabledCpkStatuses((prev) => {
                const next = new Set(prev);
                if (next.has(status)) {
                  next.delete(status);
                } else {
                  next.add(status);
                }
                return next;
              });
            }}
          />

          {/* 右侧统计图表矩阵 */}
          <main className="flex-1 overflow-y-auto p-6 bg-slate-900/50 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <ChartGrid
              indicators={currentSheet?.indicators || []}
              visibleIndicatorIndexes={visibleIndicatorIndexes}
              gridCols={gridCols}
              pcbasnList={currentSheet?.pcbasn_list || []}
              selectedIndicatorIdx={selectedIndicatorIdx}
              onSelectIndicator={setSelectedIndicatorIdx}
              chartTheme={chartTheme}
              lineWidth={lineWidth}
            />
          </main>
        </div>

        {/* 底部 Sheet 横向滚动导航栏 */}
        <SheetNav
          sheets={sheets}
          activeSheetIdx={activeSheetIdx}
          onSheetChange={(idx) => {
            setActiveSheetIdx(idx);
            setSelectedIndicatorIdx(null);
          }}
        />

        {/* 高级系统设置模态框 */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          chartTheme={chartTheme}
          onChangeTheme={setChartTheme}
          lineWidth={lineWidth}
          onChangeLineWidth={setLineWidth}
        />

        {/* 导出进度条模态弹窗 */}
        {exportProgress.visible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-96 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400">
                  <FileSpreadsheet className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-slate-200 font-bold text-sm">{t("generatingReport", locale)}</h3>
                  <p className="text-xs text-slate-400">{t("generatingReportDesc", locale)}</p>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">{exportProgress.text}</span>
                  <span className="text-blue-400 font-bold">{exportProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LocaleProvider>
  );
};

export default App;
