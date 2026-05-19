import React from "react";
import { t, useLocale } from "../i18n";

export type MainView = "grid" | "heatmap";

interface RfFilterBarProps {
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
}

const RfFilterBar: React.FC<RfFilterBarProps> = ({
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
}) => {
  const { locale } = useLocale();

  return (
    <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 shrink-0">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">{t("deviceFilter", locale)}:</span>
          <select
            value={selectedDevice || ""}
            onChange={(e) => onDeviceChange(e.target.value || null)}
            className="bg-slate-950 border border-slate-750/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono transition-colors cursor-pointer"
          >
            <option value="">{t("allDevices", locale)}</option>
            {deviceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">{t("freqFilter", locale)}:</span>
          <select
            value={selectedFreq || ""}
            onChange={(e) => onFrequencyChange(e.target.value ? parseInt(e.target.value) : null)}
            className="bg-slate-950 border border-slate-750/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono transition-colors cursor-pointer"
          >
            <option value="">{t("allFreq", locale)}</option>
            {availableFrequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency} MHz
              </option>
            ))}
          </select>
        </div>

        {availableRates.length > 0 && (
          <div className="flex items-center space-x-2 transition-all">
            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">{t("rateFilter", locale)}:</span>
            <select
              value={selectedRate || ""}
              onChange={(e) => onRateChange(e.target.value || null)}
              className="bg-slate-950 border border-slate-750/80 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono transition-colors cursor-pointer"
            >
              <option value="">{t("allRates", locale)}</option>
              {availableRates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </div>
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
