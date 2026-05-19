import React, { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { CpkStatus, SheetData } from "./types";
import Header from "./components/Header";
import SheetNav from "./components/SheetNav";
import PcbaList from "./components/PcbaList";
import SettingsModal from "./components/SettingsModal";
import MainContent from "./components/MainContent";
import ExportProgressModal from "./components/ExportProgressModal";
import { t, Locale, LocaleProvider } from "./i18n";
import { RfMappingConfig, DEFAULT_RF_MAPPINGS, parseRFIndicator } from "./utils/rfParser";
import { getCpkStatus } from "./utils/cpk";
import { useResizableSidebar } from "./hooks/useResizableSidebar";
import { useRfFilters } from "./hooks/useRfFilters";
import { usePdfExport } from "./hooks/usePdfExport";

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

  // RF Custom Mappings State
  const [rfMappings, setRfMappings] = useState<RfMappingConfig>(() => {
    const saved = localStorage.getItem("cpk_qc_rf_mappings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse RF mapping configuration", e);
      }
    }
    return DEFAULT_RF_MAPPINGS;
  });

  const currentSheet = useMemo(() => sheets[activeSheetIdx] || null, [sheets, activeSheetIdx]);
  const { sidebarWidth, startResizing } = useResizableSidebar();
  const {
    selectedDevice,
    selectedFreq,
    selectedRate,
    activeView,
    setSelectedRate,
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
      resetRfView();
      setDisplayFileName(selectedPath.split(/[/\\]/).pop() || selectedPath);
    } catch (err: any) {
      alert(`${t("importFailed", locale)}${err}`);
    } finally {
      setLoading(false);
    }
  };

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

        let matchesDevice = true;
        if (selectedDevice) {
          if (selectedDevice === "BLE") {
            matchesDevice = parsed.protocol === "BLE";
          } else if (selectedDevice.startsWith("Wi-Fi_")) {
            const type = selectedDevice.replace("Wi-Fi_", "");
            matchesDevice = parsed.protocol === "Wi-Fi" && parsed.testType === type;
          }
        }

        const matchesFreq = selectedFreq === null || parsed.frequency === selectedFreq;
        const matchesRate = selectedRate === null || parsed.rate === selectedRate;

        return matchesSearch && matchesStatus && matchesDevice && matchesFreq && matchesRate;
      });
  }, [currentSheet?.indicators, indicatorSearchQuery, enabledCpkStatuses, selectedDevice, selectedFreq, selectedRate, rfMappings]);

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
            selectedDevice={selectedDevice}
            onDeviceChange={handleDeviceChange}
            availableFrequencies={availableFrequencies}
            selectedFreq={selectedFreq}
            onFrequencyChange={handleFrequencyChange}
            availableRates={availableRates}
            selectedRate={selectedRate}
            onRateChange={setSelectedRate}
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
