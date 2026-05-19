import React from "react";
import { t, useLocale } from "../i18n";
import MultiSelectFilter from "./MultiSelectFilter";

export type MainView = "grid" | "heatmap";

interface RfFilterBarProps {
  deviceOptions: { value: string; label: string }[];
  selectedDevices: string[];
  onDeviceChange: (devices: string[]) => void;
  availableFrequencies: number[];
  selectedFrequencies: number[];
  onFrequencyChange: (frequencies: number[]) => void;
  availableRates: string[];
  selectedRates: string[];
  onRateChange: (rates: string[]) => void;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
}

const RfFilterBar: React.FC<RfFilterBarProps> = ({
  deviceOptions,
  selectedDevices,
  onDeviceChange,
  availableFrequencies,
  selectedFrequencies,
  onFrequencyChange,
  availableRates,
  selectedRates,
  onRateChange,
  activeView,
  onViewChange,
}) => {
  const { locale } = useLocale();
  const frequencyOptions = availableFrequencies.map((frequency) => ({
    value: String(frequency),
    label: `${frequency} MHz`,
  }));
  const rateOptions = availableRates.map((rate) => ({
    value: rate,
    label: rate,
  }));

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 shrink-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <MultiSelectFilter
          label={t("deviceFilter", locale)}
          options={deviceOptions}
          selectedValues={selectedDevices}
          onChange={onDeviceChange}
          placeholder={t("allDevices", locale)}
          widthClassName="w-64"
        />

        <MultiSelectFilter
          label={t("freqFilter", locale)}
          options={frequencyOptions}
          selectedValues={selectedFrequencies.map(String)}
          onChange={(values) => onFrequencyChange(values.map((value) => parseInt(value)))}
          placeholder={t("allFreq", locale)}
          widthClassName="w-48"
        />

        {availableRates.length > 0 && (
          <MultiSelectFilter
            label={t("rateFilter", locale)}
            options={rateOptions}
            selectedValues={selectedRates}
            onChange={onRateChange}
            placeholder={t("allRates", locale)}
            widthClassName="w-56"
          />
        )}
      </div>

      <div className="flex space-x-1 bg-slate-950/45 p-0.5 rounded-xl border border-slate-800/80">
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "grid"
              ? "bg-slate-800 text-blue-400 shadow-md border border-slate-750"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          {t("viewChartGrid", locale)}
        </button>
        <button
          type="button"
          onClick={() => onViewChange("heatmap")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeView === "heatmap"
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
