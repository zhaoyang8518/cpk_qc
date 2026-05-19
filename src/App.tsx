import React, { useMemo, useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FileSpreadsheet } from "lucide-react";
import { CpkStatus, SheetData } from "./types";
import Header from "./components/Header";
import SheetNav from "./components/SheetNav";
import PcbaList from "./components/PcbaList";
import SettingsModal from "./components/SettingsModal";
import MainContent from "./components/MainContent";
import ExportProgressModal from "./components/ExportProgressModal";
import { t, Locale, LocaleProvider } from "./i18n";
import { RfMappingConfig, DEFAULT_RF_MAPPINGS, mergeRfMappingsWithDefaults, parseRFIndicator } from "./utils/rfParser";
import { getCpkStatus } from "./utils/cpk";
import { matchesRfDeviceFilter } from "./utils/rfFilters";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useRfFilters } from "./hooks/useRfFilters";
import { usePdfExport } from "./hooks/usePdfExport";

const EXCEL_EXTS = [".xlsx", ".xls", ".xlsm", ".xlsb"];

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

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [chartTheme, setChartTheme] = useState<string>("#5470c6");
  const [lineWidth, setLineWidth] = useState<number>(2.5);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // RF Custom Mappings State
  const [rfMappings, setRfMappings] = useState<RfMappingConfig>(() => {
    const saved = localStorage.getItem("cpk_qc_rf_mappings");
    if (saved) {
      try {
        return mergeRfMappingsWithDefaults(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse RF mapping configuration", e);
      }
    }
    return DEFAULT_RF_MAPPINGS;
  });

  const currentSheet = useMemo(() => sheets[activeSheetIdx] || null, [sheets, activeSheetIdx]);
  const { sidebarWidth, startResizing } = useResizableSidebar();
  const {
    selectedDevices,
    selectedFrequencies,
    selectedRates,
    activeView,
    setSelectedRates,
    setActiveView,
    resetRfFilters,
    resetRfView,
    deviceOptions,
    availableFrequencies,
    availableRates,
    handleDeviceChange,
    handleFrequencyChange,
    selectHeatmapCell,
  } = useRfFilters(currentSheet, rfMappings);
  const { exportProgress, handleExport } = usePdfExport({
    sheets,
    activeSheetIdx,
    displayFileName,
    rfMappings,
    locale,
  });

  const handleRfMappingsChange = (newMappings: RfMappingConfig) => {
    setRfMappings(newMappings);
    localStorage.setItem("cpk_qc_rf_mappings", JSON.stringify(newMappings));
    resetRfFilters();
  };

  const handleRfMappingsReset = () => {
    setRfMappings(DEFAULT_RF_MAPPINGS);
    localStorage.setItem("cpk_qc_rf_mappings", JSON.stringify(DEFAULT_RF_MAPPINGS));
    resetRfFilters();
  };

  // ── 核心加载函数（对话框和拖拽共用）──
  const loadFileByPath = useCallback(async (filePath: string) => {
    setLoading(true);
    try {
      const res: SheetData[] = await invoke("parse_excel", { path: filePath });
      setSheets(res);
      setActiveSheetIdx(0);
      setSelectedIndicatorIdx(null);
      resetRfView();
      setDisplayFileName(filePath.split(/[/\\]/).pop() || filePath);
    } catch (err: any) {
      alert(`${t("importFailed", locale)}${err}`);
    } finally {
      setLoading(false);
    }
  }, [locale, resetRfView]);

  // ── 顶部按钮：打开系统文件对话框 ──
  const handleImport = async () => {
    const selectedPath = await open({
      multiple: false,
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls", "xlsm", "xlsb"] }],
    });
    if (selectedPath) await loadFileByPath(selectedPath);
  };

  // ── 拖拽监听：drag-enter / drag-leave / drag-drop ──
  useEffect(() => {
    let unlistenEnter: (() => void) | undefined;
    let unlistenLeave: (() => void) | undefined;
    let unlistenDrop:  (() => void) | undefined;

    const setup = async () => {
      unlistenEnter = await listen("tauri://drag-enter", () => {
        setIsDragOver(true);
      });
      unlistenLeave = await listen("tauri://drag-leave", () => {
        setIsDragOver(false);
      });
      unlistenDrop = await listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
        setIsDragOver(false);
        const excelFile = event.payload.paths.find((p) =>
          EXCEL_EXTS.some((ext) => p.toLowerCase().endsWith(ext))
        );
        if (excelFile) loadFileByPath(excelFile);
      });
    };

    setup();
    return () => {
      unlistenEnter?.();
      unlistenLeave?.();
      unlistenDrop?.();
    };
  }, [loadFileByPath]);

  const visibleIndicators = useMemo(() => {
    const indicators = currentSheet?.indicators || [];
    const query = indicatorSearchQuery.trim().toLowerCase();

    return indicators
      .map((indicator, index) => ({ indicator, index }))
      .filter(({ indicator }) => {
        const parsed = parseRFIndicator(indicator.name, rfMappings);

        const matchesSearch =
          !query ||
          indicator.name.toLowerCase().includes(query) ||
          parsed.displayName.toLowerCase().includes(query);

        const matchesStatus = enabledCpkStatuses.has(getCpkStatus(indicator.cpk));
        const matchesDevice = matchesRfDeviceFilter(parsed, selectedDevices);
        const matchesFreq =
          selectedFrequencies.length === 0 ||
          (parsed.frequency !== null && selectedFrequencies.includes(parsed.frequency));
        const matchesRate = selectedRates.length === 0 || selectedRates.includes(parsed.rate);

        return matchesSearch && matchesStatus && matchesDevice && matchesFreq && matchesRate;
      });
  }, [currentSheet?.indicators, indicatorSearchQuery, enabledCpkStatuses, selectedDevices, selectedFrequencies, selectedRates, rfMappings]);

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

        {/* ── 拖拽视觉反馈遮罩 ── */}
        {isDragOver && (
          <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
            {/* 半透明背景 */}
            <div className="absolute inset-0 bg-blue-950/75 backdrop-blur-sm" />
            {/* 虚线边框 */}
            <div className="absolute inset-4 rounded-3xl border-4 border-dashed border-blue-400 animate-pulse" />
            {/* 居中提示卡片 */}
            <div className="relative z-10 flex flex-col items-center space-y-4 text-center">
              <div className="p-6 bg-blue-500/20 rounded-full border-2 border-blue-400/60 shadow-2xl shadow-blue-500/30">
                <FileSpreadsheet className="w-14 h-14 text-blue-300" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-blue-200 tracking-wide">
                  {t("dragOverTitle", locale)}
                </p>
                <p className="text-sm text-blue-400 font-mono">
                  {t("dragDropHint", locale)}
                </p>
              </div>
            </div>
          </div>
        )}
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
            width={sidebarWidth}
            rfMappings={rfMappings}
          />

          <div
            onMouseDown={startResizing}
            className="w-1 bg-slate-800 hover:bg-blue-500/80 active:bg-blue-600 cursor-col-resize transition-colors h-full z-20 relative shrink-0 border-l border-slate-700/30 border-r border-slate-700/30"
          />

          <MainContent
            currentSheet={currentSheet}
            visibleIndicatorIndexes={visibleIndicatorIndexes}
            gridCols={gridCols}
            selectedIndicatorIdx={selectedIndicatorIdx}
            onSelectIndicator={setSelectedIndicatorIdx}
            chartTheme={chartTheme}
            lineWidth={lineWidth}
            rfMappings={rfMappings}
            deviceOptions={deviceOptions}
            selectedDevices={selectedDevices}
            onDeviceChange={handleDeviceChange}
            availableFrequencies={availableFrequencies}
            selectedFrequencies={selectedFrequencies}
            onFrequencyChange={handleFrequencyChange}
            availableRates={availableRates}
            selectedRates={selectedRates}
            onRateChange={setSelectedRates}
            activeView={activeView}
            onViewChange={setActiveView}
            onHeatmapCellSelect={selectHeatmapCell}
          />
        </div>

        {/* 底部 Sheet 横向滚动导航栏 */}
        <SheetNav
          sheets={sheets}
          activeSheetIdx={activeSheetIdx}
          onSheetChange={(idx) => {
            setActiveSheetIdx(idx);
            setSelectedIndicatorIdx(null);
            resetRfView();
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
          rfMappings={rfMappings}
          onChangeRfMappings={handleRfMappingsChange}
          onResetRfMappings={handleRfMappingsReset}
        />

        <ExportProgressModal progress={exportProgress} />
      </div>
    </LocaleProvider>
  );
};

export default App;
