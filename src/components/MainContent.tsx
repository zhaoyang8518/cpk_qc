import React from "react";
import { IndicatorSummary, SheetData } from "../types";
import { RfMappingConfig } from "../utils/rfParser";
import ChartGrid from "./ChartGrid";
import RfHeatmap from "./RfHeatmap";
import RfFilterBar, { MainView } from "./RfFilterBar";

interface MainContentProps {
  currentSheet: SheetData | null;
  visibleIndicatorIndexes: Set<number>;
  gridCols: number;
  selectedIndicatorIdx: number | null;
  onSelectIndicator: (idx: number) => void;
  chartTheme: string;
  lineWidth: number;
  rfMappings: RfMappingConfig;
  deviceOptions: { value: string; label: string }[];
  selectedDevice: string | null;
  onDeviceChange: (device: string | null) => void;
  availableFrequencies: number[];
  selectedFreq: number | null;
  onFrequencyChange: (frequency: number | null) => void;
  availableRates: string[];
  selectedRate: string | null;
  onRateChange: (rate: string | null) => void;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
  onHeatmapCellSelect: (frequency: number | null, device: string | null) => void;
}

const emptyIndicators: IndicatorSummary[] = [];
const emptyPcbasnList: string[] = [];

const MainContent: React.FC<MainContentProps> = ({
  currentSheet,
  visibleIndicatorIndexes,
  gridCols,
  selectedIndicatorIdx,
  onSelectIndicator,
  chartTheme,
  lineWidth,
  rfMappings,
  deviceOptions,
  selectedDevice,
  onDeviceChange,
  availableFrequencies,
  selectedFreq,
  onFrequencyChange,
  availableRates,
  selectedRate,
  onRateChange,
  activeView,
  onViewChange,
  onHeatmapCellSelect,
}) => {
  const indicators = currentSheet?.indicators || emptyIndicators;
  const pcbasnList = currentSheet?.pcbasn_list || emptyPcbasnList;

  return (
    <main className="flex-1 overflow-hidden flex flex-col bg-slate-900/50">
      {currentSheet && currentSheet.indicators.length > 0 && (
        <RfFilterBar
          deviceOptions={deviceOptions}
          selectedDevice={selectedDevice}
          onDeviceChange={onDeviceChange}
          availableFrequencies={availableFrequencies}
          selectedFreq={selectedFreq}
          onFrequencyChange={onFrequencyChange}
          availableRates={availableRates}
          selectedRate={selectedRate}
          onRateChange={onRateChange}
          activeView={activeView}
          onViewChange={onViewChange}
        />
      )}

      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {activeView === "grid" ? (
          <ChartGrid
            indicators={indicators}
            visibleIndicatorIndexes={visibleIndicatorIndexes}
            gridCols={gridCols}
            pcbasnList={pcbasnList}
            selectedIndicatorIdx={selectedIndicatorIdx}
            onSelectIndicator={onSelectIndicator}
            chartTheme={chartTheme}
            lineWidth={lineWidth}
            rfMappings={rfMappings}
          />
        ) : (
          <RfHeatmap
            indicators={indicators}
            pcbasnList={pcbasnList}
            rfMappings={rfMappings}
            onSelectCell={onHeatmapCellSelect}
          />
        )}
      </div>
    </main>
  );
};

export default MainContent;
