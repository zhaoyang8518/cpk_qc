import React, { useMemo, useState, useCallback, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { CpkStatus, SheetData } from "./types";
import Header from "./components/Header";
import SheetNav from "./components/SheetNav";
import PcbaList from "./components/PcbaList";
import SettingsModal from "./components/SettingsModal";
import SaveToDbModal from "./components/SaveToDbModal";
import MainContent from "./components/MainContent";
import ExportProgressModal, { ExportProgressState } from "./components/ExportProgressModal";
import { t, Locale, LocaleProvider } from "./i18n";
import { RfMappingConfig, DEFAULT_RF_MAPPINGS, mergeRfMappingsWithDefaults, parseRFIndicator } from "./utils/rfParser";
import { getCpkStatus } from "./utils/cpk";
import { matchesRfDeviceFilter } from "./utils/rfFilters";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useRfFilters } from "./hooks/useRfFilters";
import { usePdfExport } from "./hooks/usePdfExport";
import { useAutoUpdater } from "./hooks/useAutoUpdater";

const EXCEL_EXTS = [".xlsx", ".xls", ".xlsm", ".xlsb"];
const EMPTY_PROGRESS: ExportProgressState = { visible: false, percent: 0, text: "" };

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
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [fullFilePath, setFullFilePath] = useState<string>("");
  const [chartTheme, setChartTheme] = useState<string>("#5470c6");
  const [lineWidth, setLineWidth] = useState<number>(2.5);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const updateState = useAutoUpdater(locale);
  const [importProgress, setImportProgress] = useState<ExportProgressState>(EMPTY_PROGRESS);
  const [postgresUri, setPostgresUri] = useState<string>("");
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    async function initStore() {
      const s = await Store.load("settings.json");
      setStore(s);
      const uri = await s.get<string>("postgres_uri");
      if (uri) setPostgresUri(uri);
    }
    initStore();
  }, []);

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
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      setImportProgress({ visible: true, percent: 8, text: t("importProgressPreparing", locale) });
      await new Promise((resolve) => setTimeout(resolve, 120));

      timer = setInterval(() => {
        setImportProgress((prev) => {
          if (!prev.visible || prev.percent >= 85) return prev;
          return {
            visible: true,
            percent: Math.min(prev.percent + 7, 85),
            text: t("importProgressParsing", locale),
          };
        });
      }, 220);

      const res: SheetData[] = await invoke("parse_excel", { path: filePath });
      if (timer) clearInterval(timer);
      setImportProgress({ visible: true, percent: 92, text: t("importProgressRendering", locale) });
      await new Promise((resolve) => setTimeout(resolve, 120));

      setSheets(res);
      setActiveSheetIdx(0);
      setSelectedIndicatorIdx(null);
      resetRfView();
      setDisplayFileName(filePath.split(/[/\\]/).pop() || filePath);
      setFullFilePath(filePath);

      setImportProgress({ visible: true, percent: 100, text: t("importProgressDone", locale) });
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (err: any) {
      if (timer) clearInterval(timer);
      alert(`${t("importFailed", locale)}${err}`);
    } finally {
      if (timer) clearInterval(timer);
      setImportProgress(EMPTY_PROGRESS);
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

  const handleSaveToDb = async (dateStr: string, forceOverwrite: boolean) => {
    setImportProgress({
      visible: true,
      percent: 0,
      text: t("dbImportConnecting", locale),
      title: t("dbSaveToDbTitle", locale),
      description: t("dbImportWriting", locale),
    });

    try {
      const res = await invoke("save_to_db", {
        filePath: fullFilePath,
        testDate: dateStr,
        sheets,
        postgresUri,
        forceOverwrite,
      });

      // Keep success progress for a brief moment for good UX
      setImportProgress({
        visible: true,
        percent: 100,
        text: t("dbImportSuccessTitle", locale),
        title: t("dbSaveToDbTitle", locale),
        description: t("dbImportSuccessDesc", locale),
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      setImportProgress(EMPTY_PROGRESS);

      alert(`${t("dbImportSuccessAlert", locale)}${res}`);
    } catch (err: any) {
      setImportProgress(EMPTY_PROGRESS);
      if (String(err) === "IMPORT_CANCELLED") {
        alert(t("dbImportCancelAlert", locale));
      } else {
        throw err; // throw back to SaveToDbModal to display error
      }
    }
  };

  const handleCancelDbImport = async () => {
    try {
      await invoke("cancel_db_import");
    } catch (e) {
      console.error("Failed to cancel DB import", e);
    }
  };

  // ── 拖拽监听：drag-enter / drag-leave / drag-drop ──
  useEffect(() => {
    let unlistenEnter: (() => void) | undefined;
    let unlistenLeave: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;

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

  // ── 数据库导入进度监听 ──
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    async function setupDbProgress() {
      unlisten = await listen<{ percent: number; text: string }>("db-import-progress", (event) => {
        setImportProgress((prev) => {
          // Only update if it's the database progress modal currently visible
          if (!prev.visible || prev.title !== t("dbSaveToDbTitle", locale)) return prev;
          return {
            ...prev,
            percent: Math.round(event.payload.percent),
            text: event.payload.text,
          };
        });
      });
    }

    setupDbProgress();
    return () => {
      unlisten?.();
    };
  }, [locale]);

  const rfFilteredIndicators = useMemo(() => {
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

        const matchesDevice = matchesRfDeviceFilter(parsed, selectedDevices);
        const matchesFreq =
          selectedFrequencies.length === 0 ||
          (parsed.frequency !== null && selectedFrequencies.includes(parsed.frequency));
        const matchesRate = selectedRates.length === 0 || selectedRates.includes(parsed.rate);

        return matchesSearch && matchesDevice && matchesFreq && matchesRate;
      });
  }, [currentSheet?.indicators, indicatorSearchQuery, selectedDevices, selectedFrequencies, selectedRates, rfMappings]);

  const visibleIndicators = useMemo(
    () => rfFilteredIndicators.filter(({ indicator }) => enabledCpkStatuses.has(getCpkStatus(indicator.cpk))),
    [rfFilteredIndicators, enabledCpkStatuses]
  );

  const visibleIndicatorIndexes = useMemo(() => new Set(visibleIndicators.map(({ index }) => index)), [visibleIndicators]);

  const cpkStatusCounts = useMemo(() => {
    const counts: Record<CpkStatus, number> = { red: 0, yellow: 0, green: 0, cyan: 0 };
    rfFilteredIndicators.forEach(({ indicator }) => {
      counts[getCpkStatus(indicator.cpk)] += 1;
    });
    return counts;
  }, [rfFilteredIndicators]);

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
          hasDb={!!postgresUri}
          onSaveToDb={() => setIsSaveModalOpen(true)}
          updateState={{
            available: updateState.available,
            checking: updateState.checking,
            downloading: updateState.downloading,
            downloadProgress: updateState.downloadProgress,
            onCheckUpdate: updateState.checkForUpdate,
            onInstallUpdate: () => updateState.update ? updateState.installUpdate(updateState.update) : undefined,
          }}
        />

        <div className="flex flex-1 overflow-hidden relative">
          {isSidebarCollapsed ? (
            <div className="flex h-full w-6 shrink-0 items-start justify-center border-r border-slate-700/50 bg-slate-900/80 pt-4">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex h-8 w-3 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:border-blue-500/70 hover:text-blue-300"
                title="Show indicator list"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
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
                className="group relative h-full w-1 shrink-0 cursor-col-resize border-l border-slate-700/30 border-r border-slate-700/30 bg-slate-800 transition-colors hover:bg-blue-500/80 active:bg-blue-600"
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="absolute left-1/2 top-4 flex h-8 w-6 -translate-x-1/2 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-400 shadow-lg transition-colors hover:border-blue-500/70 hover:text-blue-300"
                  title="Hide indicator list"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

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
          postgresUri={postgresUri}
          onChangePostgresUri={async (uri) => {
            setPostgresUri(uri);
            if (store) {
              await store.set("postgres_uri", uri);
              await store.save();
            }
          }}
        />

        <SaveToDbModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          filePath={fullFilePath}
          fileName={displayFileName}
          postgresUri={postgresUri}
          onSave={handleSaveToDb}
        />

        <ExportProgressModal
          progress={importProgress}
          title={importProgress.title || t("importProgressTitle", locale)}
          description={importProgress.description || t("importProgressDesc", locale)}
          onCancel={importProgress.title === t("dbSaveToDbTitle", locale) ? handleCancelDbImport : undefined}
        />
        <ExportProgressModal progress={exportProgress} />
      </div>
    </LocaleProvider>
  );
};

export default App;
