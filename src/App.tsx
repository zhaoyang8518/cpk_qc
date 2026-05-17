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

export type CpkStatus = "red" | "yellow" | "green" | "cyan";

const getCpkStatus = (cpk: number | null): CpkStatus => {
  if (cpk !== null && cpk !== undefined && cpk >= 2.0) return "cyan";
  if (cpk !== null && cpk !== undefined && cpk >= 1.33) return "green";
  if (cpk !== null && cpk !== undefined && cpk >= 1.0) return "yellow";
  return "red";
};

const App: React.FC = () => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("未导入文件");
  const [gridCols, setGridCols] = useState<number>(2);
  const [selectedIndicatorIdx, setSelectedIndicatorIdx] = useState<number | null>(null);
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState<string>("");
  const [enabledCpkStatuses, setEnabledCpkStatuses] = useState<Set<CpkStatus>>(
    () => new Set(["red", "yellow", "green", "cyan"])
  );

  // 导出进度条模态框状态
  const [exportProgress, setExportProgress] = useState<{
    visible: boolean;
    percent: number;
    text: string;
  }>({ visible: false, percent: 0, text: "" });

  // 系统高级设置状态
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [chartTheme, setChartTheme] = useState<string>("#5470c6");
  const [lineWidth, setLineWidth] = useState<number>(2.5);

  // 处理 Excel 文件导入
  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Excel", extensions: ["xlsx", "xls", "xlsb"] }],
      });

      if (selected) {
        setLoading(true);
        const path = (selected as any).path || selected;
        setFileName(path.split("/").pop() || "已导入文件");

        // 调用 Rust 后端解析引擎
        const res: SheetData[] = await invoke("parse_excel", { path });
        setSheets(res);
        setActiveSheetIdx(0);
        setSelectedIndicatorIdx(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("Excel import failed:", err);
      setLoading(false);
      alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 处理导出分析报告 (仅导出当前工作表报告，包含执行摘要、汇总表、明细表及异常图表)
  const handleExport = async () => {
    if (sheets.length === 0) {
      alert("暂无分析数据可导出，请先导入 Excel 工作表。");
      return;
    }

    const sheet = sheets[activeSheetIdx];
    if (!sheet || sheet.indicators.length === 0) {
      alert("当前工作表无检测项数据可导出。");
      return;
    }

    setExportProgress({ visible: true, percent: 5, text: "正在初始化精益六西格玛排版引擎..." });
    await new Promise((r) => setTimeout(r, 50));

    try {
      const pdf = new jsPDF("p", "mm", "a4");

      // ── 加载中文字体支持 (SimHei) ──
      setExportProgress({ visible: true, percent: 10, text: "正在加载中文字体引擎..." });
      try {
        const fontRes = await fetch("/fonts/SimHei.ttf");
        const fontBlob = await fontRes.blob();
        const fontBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(fontBlob);
        });

        pdf.addFileToVFS("SimHei.ttf", fontBase64);
        pdf.addFont("SimHei.ttf", "SimHei", "normal");
        pdf.setFont("SimHei");
      } catch (fontErr) {
        console.warn("Failed to load SimHei font, falling back to default jsPDF font", fontErr);
      }

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pageW - margin * 2;

      // ── 封面与概览 ──
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageW, 45, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.text("CPK 质量控制分析报告", pageW / 2, 25, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      pdf.text("ckp_qc v0.1.0  |  Industrial SPC Analysis Engine", pageW / 2, 35, { align: "center" });

      let y = 55;
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(14);
      pdf.text("报告基本信息", margin, y);
      y += 6;
      pdf.setDrawColor(200, 210, 220);
      pdf.line(margin, y, pageW - margin, y);
      y += 6;

      const infoRows: [string, string][] = [
        ["源文件名称", fileName],
        ["当前工作表", sheet.sheet_name],
        ["分析生成时间", ts],
        ["检测项总数", String(sheet.indicators.length)],
        ["分析样本数 (单板数)", String(sheet.pcbasn_list.length)],
      ];
      pdf.setFontSize(10);
      for (const [label, value] of infoRows) {
        pdf.setTextColor(100, 110, 130);
        pdf.text(label, margin, y);
        pdf.setTextColor(30, 41, 59);
        pdf.text(value, margin + 40, y);
        y += 6.5;
      }

      // ── 1. 报告执行摘要 (Executive Summary) ──
      y += 6;
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text("1. 执行摘要 (Executive Summary)", margin, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      const summaryText = "本报告由 CPK Quality Controller 自动生成，采用精益六西格玛 (Lean Six Sigma) 质量工程标准与大样本 SPC 统计算法对当前测试数据进行了深度制程能力评估。系统通过动态划定 X 轴缓冲区与单边公差自动保护机制，精确计算每一个检测项的潜在精密度 (Cp)、实际制程能力 (Cpk) 及短期 Sigma 水平 (Z)。以下为当前工作表所有检测项的过程能力等级分布汇总：";
      const splitSummary = pdf.splitTextToSize(summaryText, contentW);
      pdf.text(splitSummary, margin, y);
      y += splitSummary.length * 5 + 8;

      // ── 2. 过程能力等级汇总表 (Capability Summary Table) ──
      setExportProgress({ visible: true, percent: 15, text: "正在排版过程能力等级汇总表..." });
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text("2. 过程能力等级汇总表 (Capability Summary)", margin, y);
      y += 4;

      const totalInds = sheet.indicators.length;
      const statusSummaryData = [
        ["世界级水平", "CPK ≥ 2.00 (≥ 6 Sigma)", String(cpkStatusCounts.cyan), `${((cpkStatusCounts.cyan / totalInds) * 100).toFixed(1)}%`, "工艺极其卓越，缺陷率接近零 (< 3.4 DPMO)"],
        ["良好", "1.33 ≤ CPK < 2.00 (4~6 Sigma)", String(cpkStatusCounts.green), `${((cpkStatusCounts.green / totalInds) * 100).toFixed(1)}%`, "满足主流工业标准，过程处于稳定受控状态"],
        ["勉强合格", "1.00 ≤ CPK < 1.33 (3~4 Sigma)", String(cpkStatusCounts.yellow), `${((cpkStatusCounts.yellow / totalInds) * 100).toFixed(1)}%`, "处于公差边缘，参数轻微漂移极易超差，需密切监控"],
        ["不合格", "CPK < 1.00 (< 3 Sigma)", String(cpkStatusCounts.red), `${((cpkStatusCounts.red / totalInds) * 100).toFixed(1)}%`, "变差超出规格界限，存在大量次品风险，需停机整改"],
      ];

      autoTable(pdf, {
        startY: y,
        head: [["等级名称", "评估标准", "检测项数量", "数量占比", "六西格玛状态说明"]],
        body: statusSummaryData,
        theme: "grid",
        styles: { font: "SimHei" },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 8, textColor: [50, 60, 70], valign: "middle" },
        columnStyles: {
          0: { fontStyle: "bold", halign: "center" },
          1: { halign: "center" },
          2: { halign: "center", fontStyle: "bold" },
          3: { halign: "center", fontStyle: "bold" },
          4: { halign: "left" },
        },
        willDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            if (data.row.index === 0) data.cell.styles.textColor = [6, 182, 212];
            if (data.row.index === 1) data.cell.styles.textColor = [16, 185, 129];
            if (data.row.index === 2) data.cell.styles.textColor = [245, 158, 11];
            if (data.row.index === 3) data.cell.styles.textColor = [239, 68, 68];
          }
        },
      });

      y = (pdf as any).lastAutoTable.finalY + 12;

      // ── 3. 检测项过程能力快速索引明细表 (Indicators Index Table) ──
      setExportProgress({ visible: true, percent: 25, text: "正在生成检测项快速索引印刷级表格..." });
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text("3. 检测项过程能力快速索引 (Indicators Index)", margin, y);
      y += 4;

      const sorted = [...sheet.indicators].sort((a, b) => (b.cpk ?? -Infinity) - (a.cpk ?? -Infinity));
      const indTableData = sorted.map((ind, idx) => {
        const status = getCpkStatus(ind.cpk);
        const statusLabel = status === "red" ? "不合格" : status === "yellow" ? "勉强" : status === "green" ? "良好" : "世界级";
        const sigmaLevel = ind.cpk !== null && ind.cpk !== undefined ? (3 * ind.cpk).toFixed(1) + "σ" : "-";
        return [
          String(idx + 1),
          ind.name,
          ind.average !== null && ind.average !== undefined ? ind.average.toFixed(2) : "-",
          ind.stdev !== null && ind.stdev !== undefined ? ind.stdev.toFixed(4) : "-",
          ind.cpk !== null && ind.cpk !== undefined ? ind.cpk.toFixed(2) : "-",
          statusLabel,
          sigmaLevel,
        ];
      });

      autoTable(pdf, {
        startY: y,
        head: [["#", "检测项名称", "均值 μ", "标准差 σ", "CPK", "判定", "Sigma 水平"]],
        body: indTableData,
        theme: "striped",
        styles: { font: "SimHei" },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontSize: 8, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59], valign: "middle" },
        columnStyles: {
          0: { halign: "center", textColor: [100, 115, 130] },
          1: { halign: "left", fontStyle: "bold" },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center", fontStyle: "bold" },
          5: { halign: "center", fontStyle: "bold" },
          6: { halign: "center", textColor: [100, 115, 130] },
        },
        willDrawCell: (data) => {
          if (data.section === "body" && data.column.index === 5) {
            const val = data.cell.raw;
            if (val === "世界级") data.cell.styles.textColor = [6, 182, 212];
            if (val === "良好") data.cell.styles.textColor = [16, 185, 129];
            if (val === "勉强") data.cell.styles.textColor = [245, 158, 11];
            if (val === "不合格") data.cell.styles.textColor = [239, 68, 68];
          }
        },
      });

      // ── 4. 异常检测项图表专项分析 (仅黄色和红色检测项) ──
      const targetIndicators = sheet.indicators
        .map((ind, index) => ({ ind, index }))
        .filter(({ ind }) => {
          const st = getCpkStatus(ind.cpk);
          return st === "red" || st === "yellow";
        });

      if (targetIndicators.length > 0) {
        for (let i = 0; i < targetIndicators.length; i++) {
          const { ind, index: idx } = targetIndicators[i];

          const percent = Math.round(30 + (i / targetIndicators.length) * 60);
          setExportProgress({
            visible: true,
            percent,
            text: `正在提取异常检测项图表 (${i + 1} / ${targetIndicators.length}): ${ind.name.slice(0, 15)}...`,
          });
          await new Promise((r) => setTimeout(r, 5));

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
            const width = chartInstance.getWidth();
            const height = chartInstance.getHeight();
            imgW = (width / 2) * (25.4 / 96);
            imgH = (height / 2) * (25.4 / 96);
          } else {
            cardEl.scrollIntoView({ block: "center", behavior: "instant" });
            await new Promise((r) => setTimeout(r, 100));
            const canvas = await html2canvas(cardEl as HTMLElement, {
              backgroundColor: "#0f172a",
              scale: 2,
              useCORS: true,
              logging: false,
            });
            imgData = canvas.toDataURL("image/png");
            imgW = (canvas.width / 2) * (25.4 / 96);
            imgH = (canvas.height / 2) * (25.4 / 96);
          }

          if (!imgData) continue;

          pdf.addPage();

          const maxW = contentW;
          if (imgW > maxW) {
            const ratio = maxW / imgW;
            imgW *= ratio;
            imgH *= ratio;
          }

          const maxH = pageH - margin * 2 - 10;
          if (imgH > maxH) {
            const ratio = maxH / imgH;
            imgW *= ratio;
            imgH *= ratio;
          }

          const imgX = (pageW - imgW) / 2;
          const imgY = (pageH - imgH) / 2;

          pdf.addImage(imgData, "PNG", imgX, imgY, imgW, imgH);

          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`${sheet.sheet_name}  |  异常检测项专项分析 (${i + 1} / ${targetIndicators.length})`, pageW / 2, pageH - 6, { align: "center" });
        }
      }

      // ── 5. 原生文件保存写入 ──
      setExportProgress({ visible: true, percent: 92, text: "正在选择导出保存位置..." });
      const outName = `ckp_qc_report_${fileName.replace(/\.[^/.]+$/, "")}_${sheet.sheet_name}.pdf`;

      const filePath = await save({
        defaultPath: outName,
        filters: [{ name: "PDF 文档", extensions: ["pdf"] }],
      });

      if (filePath) {
        setExportProgress({ visible: true, percent: 96, text: "正在将报告二进制流写入本地磁盘..." });
        const pdfBuffer = pdf.output("arraybuffer");
        await writeFile(filePath, new Uint8Array(pdfBuffer));
        setExportProgress({ visible: true, percent: 100, text: "报告导出成功！" });
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err) {
      console.error("PDF export failed:", err);
      alert(`导出 PDF 失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportProgress({ visible: false, percent: 0, text: "" });
      setLoading(false);
    }
  };

  const currentSheet = sheets[activeSheetIdx] || null;
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
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans select-none">
      {/* 顶部操作栏 */}
      <Header
        fileName={fileName}
        loading={loading}
        gridCols={gridCols}
        onImport={handleImport}
        onGridChange={setGridCols}
        onExport={handleExport}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 主体视窗区域 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左侧检测项导航列表 */}
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
                <h3 className="text-slate-200 font-bold text-sm">正在生成六西格玛分析报告</h3>
                <p className="text-xs text-slate-400">请稍候，系统正在进行高速制程能力排版...</p>
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
  );
};

export default App;
