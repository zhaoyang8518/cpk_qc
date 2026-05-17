import React, { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
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

  // 处理导出分析报告 (导出为 JSON 文件)
  const handleExport = () => {
    if (sheets.length === 0) {
      alert("暂无分析数据可导出，请先导入 Excel 工作表。");
      return;
    }

    try {
      const exportData = {
        app: "ckp_qc",
        version: "0.1.0",
        exportTime: new Date().toISOString(),
        sourceFile: fileName,
        sheetsCount: sheets.length,
        sheets: sheets,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `ckp_qc_report_${fileName.replace(/\.[^/.]+$/, "")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("导出分析报告失败。");
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
