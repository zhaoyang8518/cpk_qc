import React, { useEffect, useState } from "react";
import { IndicatorSummary, RfHeatmapFilters, SheetData } from "../types";
import { RfMappingConfig } from "../utils/rfParser";
import { HistogramBinPrecision } from "../utils/spc";
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
  binPrecision: HistogramBinPrecision;
  rfMappings: RfMappingConfig;
  deviceOptions: { value: string; label: string }[];
  selectedDevices: string[];
  onDeviceChange: (devices: string[]) => void;
  availableBands: string[];
  selectedBands: string[];
  onBandChange: (bands: string[]) => void;
  availableFrequencies: number[];
  selectedFrequencies: number[];
  onFrequencyChange: (frequencies: number[]) => void;
  availableBandwidths: string[];
  selectedBandwidths: string[];
  onBandwidthChange: (bandwidths: string[]) => void;
  availableRates: string[];
  selectedRates: string[];
  onRateChange: (rates: string[]) => void;
  availableChannels: string[];
  selectedChannels: string[];
  onChannelChange: (channels: string[]) => void;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
  onHeatmapCellSelect: (frequency: number | null, device: string | null) => void;
  isAiEnabled: boolean;
}

const emptyIndicators: IndicatorSummary[] = [];
const emptyPcbasnList: string[] = [];
const defaultHeatmapFilters: RfHeatmapFilters = {
  showValues: true,
  sortByWorstCpk: false,
};

const MainContent: React.FC<MainContentProps> = ({
  currentSheet,
  visibleIndicatorIndexes,
  gridCols,
  selectedIndicatorIdx,
  onSelectIndicator,
  chartTheme,
  lineWidth,
  binPrecision,
  rfMappings,
  deviceOptions,
  selectedDevices,
  onDeviceChange,
  availableBands,
  selectedBands,
  onBandChange,
  availableFrequencies,
  selectedFrequencies,
  onFrequencyChange,
  availableBandwidths,
  selectedBandwidths,
  onBandwidthChange,
  availableRates,
  selectedRates,
  onRateChange,
  availableChannels,
  selectedChannels,
  onChannelChange,
  activeView,
  onViewChange,
  onHeatmapCellSelect,
  isAiEnabled,
}) => {
  const indicators = currentSheet?.indicators || emptyIndicators;
  const pcbasnList = currentSheet?.pcbasn_list || emptyPcbasnList;
  const [heatmapFilters, setHeatmapFilters] = useState<RfHeatmapFilters>(defaultHeatmapFilters);

  useEffect(() => {
    if (activeView !== "heatmap") return;

    if (selectedDevices.length !== 1) {
      const nextDevice = selectedDevices[0] || deviceOptions[0]?.value;
      if (nextDevice) onDeviceChange([nextDevice]);
      return;
    }

    if (selectedBands.length !== 1) {
      const nextBand = selectedBands[0] || availableBands[0];
      if (nextBand) onBandChange([nextBand]);
    }
  }, [activeView, selectedDevices, selectedBands, deviceOptions, availableBands, onDeviceChange, onBandChange]);

  return (
    <main className="flex-1 overflow-hidden flex flex-col bg-slate-900/50">
      {currentSheet && currentSheet.indicators.length > 0 && (
        <RfFilterBar
          deviceOptions={deviceOptions}
          selectedDevices={selectedDevices}
          onDeviceChange={onDeviceChange}
          availableBands={availableBands}
          selectedBands={selectedBands}
          onBandChange={onBandChange}
          availableFrequencies={availableFrequencies}
          selectedFrequencies={selectedFrequencies}
          onFrequencyChange={onFrequencyChange}
          availableBandwidths={availableBandwidths}
          selectedBandwidths={selectedBandwidths}
          onBandwidthChange={onBandwidthChange}
          availableRates={availableRates}
          selectedRates={selectedRates}
          onRateChange={onRateChange}
          availableChannels={availableChannels}
          selectedChannels={selectedChannels}
          onChannelChange={onChannelChange}
          heatmapFilters={heatmapFilters}
          onHeatmapFiltersChange={setHeatmapFilters}
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
            binPrecision={binPrecision}
            rfMappings={rfMappings}
            isAiEnabled={isAiEnabled}
          />
        ) : (
          <RfHeatmap
            indicators={indicators}
            pcbasnList={pcbasnList}
            rfMappings={rfMappings}
            filters={heatmapFilters}
            selectedDevices={selectedDevices}
            selectedBands={selectedBands}
            selectedFrequencies={selectedFrequencies}
            selectedBandwidths={selectedBandwidths}
            selectedRates={selectedRates}
            selectedChannels={selectedChannels}
            onSelectCell={onHeatmapCellSelect}
          />
        )}
      </div>
    </main>
  );
};

export default MainContent;
