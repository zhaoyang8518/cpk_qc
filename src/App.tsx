import React, { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
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

  // 处理导出分析报告 (导出为 PDF 文件)
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

    setLoading(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentW = pageW - margin * 2;

      // ── 封面 ──
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageW, 50, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.text("CPK 质量控制分析报告", pageW / 2, 28, { align: "center" });
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      pdf.text("ckp_qc v0.1.0  |  Industrial SPC Analysis Engine", pageW / 2, 38, { align: "center" });

      let y = 60;
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(14);
      pdf.text("报告概览", margin, y);
      y += 8;
      pdf.setDrawColor(200, 210, 220);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;

      const infoRows: [string, string][] = [
        ["源文件", fileName],
        ["工作表", sheet.sheet_name],
        ["导出时间", ts],
        ["检测项总数", String(sheet.indicators.length)],
        ["单板总数", String(sheet.pcbasn_list.length)],
      ];
      pdf.setFontSize(10);
      for (const [label, value] of infoRows) {
        pdf.setTextColor(100, 110, 130);
        pdf.text(label, margin, y);
        pdf.setTextColor(30, 41, 59);
        pdf.text(value, margin + 40, y);
        y += 7;
      }

      // CPK 分布概览
      y += 5;
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text("CPK 等级分布", margin, y);
      y += 7;

      const statusDefs: { label: string; color: readonly [number, number, number]; key: CpkStatus }[] = [
        { label: "不合格 (< 1.0)", color: [239, 68, 68] as const, key: "red" },
        { label: "勉强合格 (1.0~1.33)", color: [245, 158, 11] as const, key: "yellow" },
        { label: "良好 (1.33~2.0)", color: [16, 185, 129] as const, key: "green" },
        { label: "世界级 (≥ 2.0)", color: [6, 182, 212] as const, key: "cyan" },
      ];
      const boxW = (contentW - 12) / 4;
      for (let i = 0; i < statusDefs.length; i++) {
        const def = statusDefs[i];
        const bx = margin + i * (boxW + 4);
        pdf.setFillColor(...def.color, 0.15);
        pdf.roundedRect(bx, y, boxW, 16, 2, 2, "F");
        pdf.setTextColor(...def.color);
        pdf.setFontSize(16);
        pdf.text(String(cpkStatusCounts[def.key]), bx + boxW / 2, y + 10, { align: "center" });
        pdf.setFontSize(7);
        pdf.text(def.label, bx + boxW / 2, y + 14, { align: "center" });
      }
      y += 22;

      // 检测项汇总表
      pdf.setFontSize(12);
      pdf.setTextColor(30, 41, 59);
      pdf.text("检测项快速索引", margin, y);
      y += 7;

      // 表头
      const colDefs = [
        { x: margin, w: 8, label: "#" },
        { x: margin + 8, w: 62, label: "检测项名称" },
        { x: margin + 70, w: 22, label: "均值 μ" },
        { x: margin + 92, w: 22, label: "标准差 σ" },
        { x: margin + 114, w: 22, label: "CPK" },
        { x: margin + 136, w: 26, label: "判定" },
        { x: margin + 162, w: 22, label: "Sigma" },
      ];
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, y - 5, contentW, 6, "F");
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      for (const col of colDefs) {
        pdf.text(col.label, col.x + col.w / 2, y, { align: "center" });
      }
      y += 5;

      const sorted = [...sheet.indicators].sort((a, b) => (b.cpk ?? -Infinity) - (a.cpk ?? -Infinity));
      pdf.setFontSize(7);
      for (let i = 0; i < sorted.length && y < pageH - 20; i++) {
        const ind = sorted[i];
        const status = getCpkStatus(ind.cpk);
        const statusLabel = status === "red" ? "不合格" : status === "yellow" ? "勉强" : status === "green" ? "良好" : "世界级";
        const statusColor = (status === "red" ? [239, 68, 68] : status === "yellow" ? [245, 158, 11] : status === "green" ? [16, 185, 129] : [6, 182, 212]) as readonly [number, number, number];

        if (i % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y - 4, contentW, 5, "F");
        }
        pdf.setTextColor(71, 85, 105);
        pdf.text(String(i + 1), colDefs[0].x + colDefs[0].w / 2, y, { align: "center" });
        pdf.setTextColor(30, 41, 59);
        const name = ind.name.length > 24 ? ind.name.slice(0, 23) + "…" : ind.name;
        pdf.text(name, colDefs[1].x + 1, y);
        pdf.text(ind.average !== null && ind.average !== undefined ? ind.average.toFixed(2) : "-", colDefs[2].x + colDefs[2].w / 2, y, { align: "center" });
        pdf.text(ind.stdev !== null && ind.stdev !== undefined ? ind.stdev.toFixed(4) : "-", colDefs[3].x + colDefs[3].w / 2, y, { align: "center" });
        pdf.setTextColor(...statusColor);
        pdf.text(ind.cpk !== null && ind.cpk !== undefined ? ind.cpk.toFixed(2) : "-", colDefs[4].x + colDefs[4].w / 2, y, { align: "center" });
        pdf.text(statusLabel, colDefs[5].x + colDefs[5].w / 2, y, { align: "center" });
        pdf.setTextColor(71, 85, 105);
        const sigmaLevel = ind.cpk !== null && ind.cpk !== undefined ? (3 * ind.cpk).toFixed(1) + "σ" : "-";
        pdf.text(sigmaLevel, colDefs[6].x + colDefs[6].w / 2, y, { align: "center" });
        y += 5;
      }

      // ── 图表页 ──
      const cardIds = visibleIndicators.map((v) => v.index).sort((a, b) => a - b);

      for (let i = 0; i < cardIds.length; i++) {
        const idx = cardIds[i];
        const cardEl = document.getElementById(`indicator-card-${idx}`);
        if (!cardEl) continue;

        // 将卡片滚入视口以确保 ECharts 已完成渲染
        cardEl.scrollIntoView({ block: "center", behavior: "instant" });
        await new Promise((r) => setTimeout(r, 200));

        const canvas = await html2canvas(cardEl, {
          backgroundColor: "#0f172a",
          scale: 2,
          useCORS: true,
          logging: false,
        });

        pdf.addPage();

        // CSS px → mm (html2canvas 基础 dpi ≈ 96, scale=2 时除以 2 得到 CSS 尺寸)
        const cssW = canvas.width / 2;
        const cssH = canvas.height / 2;
        let imgW = cssW * 25.4 / 96;
        let imgH = cssH * 25.4 / 96;

        // 缩放适配页面宽度
        const maxW = contentW;
        if (imgW > maxW) {
          const ratio = maxW / imgW;
          imgW *= ratio;
          imgH *= ratio;
        }

        // 如果仍然超出页面高度则再次缩放
        const maxH = pageH - margin * 2;
        if (imgH > maxH) {
          const ratio = maxH / imgH;
          imgW *= ratio;
          imgH *= ratio;
        }

        const imgX = (pageW - imgW) / 2;
        const imgY = (pageH - imgH) / 2;

        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", imgX, imgY, imgW, imgH);

        // 页脚
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${sheet.sheet_name}  |  ${i + 1} / ${cardIds.length}`, pageW / 2, pageH - 6, { align: "center" });
      }

      // 保存
      const outName = `ckp_qc_report_${fileName.replace(/\.[^/.]+$/, "")}.pdf`;
      pdf.save(outName);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert(`导出 PDF 失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
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
    </div>
  );
};

export default App;
