import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { t, useLocale } from "../i18n";
import { RfHeatmapFilters } from "../types";
import MultiSelectFilter from "./MultiSelectFilter";

export type MainView = "grid" | "heatmap";

interface RfFilterBarProps {
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
  heatmapFilters: RfHeatmapFilters;
  onHeatmapFiltersChange: (filters: RfHeatmapFilters) => void;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
}

const SingleSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative w-36">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 w-full items-center rounded-2xl border border-slate-600/70 bg-slate-950/60 px-3 text-left text-xs text-slate-200 shadow-inner transition-colors hover:border-slate-500 focus:border-blue-500/80 focus:outline-none"
        title={`${label}: ${value || "-"}`}
      >
        <span className={`min-w-0 flex-1 truncate ${value ? "text-slate-200" : "text-slate-500"}`}>
          {value || label}
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-10 z-50 w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {options.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs transition-colors ${isSelected ? "bg-blue-500/15 text-blue-200" : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                    }`}
                >
                  <span
                    className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600 bg-slate-900"
                      }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const RfFilterBar: React.FC<RfFilterBarProps> = ({
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
  heatmapFilters,
  onHeatmapFiltersChange,
  activeView,
  onViewChange,
}) => {
  const { locale } = useLocale();
  const isHeatmap = activeView === "heatmap";
  const frequencyOptions = availableFrequencies.map((frequency) => ({
    value: String(frequency),
    label: `${frequency} MHz`,
  }));
  const bandwidthOptions = availableBandwidths.map((bandwidth) => ({ value: bandwidth, label: bandwidth }));
  const rateOptions = availableRates.map((rate) => ({ value: rate, label: rate }));
  const channelOptions = availableChannels.map((channel) => ({ value: channel, label: channel }));

  const handleDeviceChange = (values: string[]) => {
    onDeviceChange(isHeatmap ? values.slice(-1) : values);
  };

  const handleBandSelect = (band: string) => {
    onBandChange(band ? [band] : []);
  };

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 shrink-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <MultiSelectFilter
          label={t("deviceTypeFilter", locale)}
          options={deviceOptions}
          selectedValues={selectedDevices}
          onChange={handleDeviceChange}
          placeholder={t("allDeviceTypes", locale)}
          widthClassName="w-36"
        />

        {isHeatmap ? (
          <SingleSelect
            label={t("bandFilter", locale)}
            value={selectedBands[0] || ""}
            options={availableBands}
            onChange={handleBandSelect}
          />
        ) : (
          <MultiSelectFilter
            label={t("bandFilter", locale)}
            options={availableBands.map((band) => ({ value: band, label: band }))}
            selectedValues={selectedBands}
            onChange={onBandChange}
            placeholder={t("allBands", locale)}
            widthClassName="w-36"
          />
        )}

        <MultiSelectFilter
          label={t("freqFilter", locale)}
          options={frequencyOptions}
          selectedValues={selectedFrequencies.map(String)}
          onChange={(values) => onFrequencyChange(values.map((value) => parseInt(value)))}
          placeholder={t("allFreq", locale)}
          widthClassName="w-44"
        />

        {availableBandwidths.length > 0 && (
          <MultiSelectFilter
            label={t("bandwidthFilter", locale)}
            options={bandwidthOptions}
            selectedValues={selectedBandwidths}
            onChange={onBandwidthChange}
            placeholder={t("allBandwidths", locale)}
            widthClassName="w-36"
          />
        )}

        {availableRates.length > 0 && (
          <MultiSelectFilter
            label={t("rateFilter", locale)}
            options={rateOptions}
            selectedValues={selectedRates}
            onChange={onRateChange}
            placeholder={t("allRates", locale)}
            widthClassName="w-36"
          />
        )}

        {availableChannels.length > 0 && (
          <MultiSelectFilter
            label={t("channelFilter", locale)}
            options={channelOptions}
            selectedValues={selectedChannels}
            onChange={onChannelChange}
            placeholder={t("allChannels", locale)}
            widthClassName="w-36"
          />
        )}

        {isHeatmap && (
          <>
            <button
              type="button"
              onClick={() => onHeatmapFiltersChange({ ...heatmapFilters, showValues: !heatmapFilters.showValues })}
              className={`flex h-9 items-center justify-center rounded-2xl border px-3 text-xs font-bold transition-colors ${heatmapFilters.showValues
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                : "border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {locale === "zh" ? "数值" : "Values"}
            </button>

            <button
              type="button"
              onClick={() => onHeatmapFiltersChange({ ...heatmapFilters, sortByWorstCpk: !heatmapFilters.sortByWorstCpk })}
              className={`flex h-9 items-center justify-center rounded-2xl border px-3 text-xs font-bold transition-colors ${heatmapFilters.sortByWorstCpk
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                : "border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
            >
              {locale === "zh" ? "最差 Cpk 优先" : "Worst Cpk"}
            </button>
          </>
        )}
      </div>

      <div className="flex space-x-1 bg-slate-950/45 p-0.5 rounded-xl border border-slate-800/80">
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === "grid"
            ? "bg-slate-800 text-blue-400 shadow-md border border-slate-750"
            : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
        >
          {t("viewChartGrid", locale)}
        </button>
        <button
          type="button"
          onClick={() => onViewChange("heatmap")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === "heatmap"
            ? "bg-slate-800 text-blue-400 shadow-md border border-slate-750"
            : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
        >
          {t("viewRfHeatmap", locale)}
        </button>
      </div>
    </div>
  );
};

export default RfFilterBar;
