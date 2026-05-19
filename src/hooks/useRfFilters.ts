import { useMemo, useState } from "react";
import { SheetData } from "../types";
import { RfMappingConfig, parseRFIndicator } from "../utils/rfParser";
import { MainView } from "../components/RfFilterBar";

export const useRfFilters = (currentSheet: SheetData | null, rfMappings: RfMappingConfig) => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedFreq, setSelectedFreq] = useState<number | null>(null);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<MainView>("grid");

  const resetRfFilters = () => {
    setSelectedDevice(null);
    setSelectedFreq(null);
    setSelectedRate(null);
  };

  const resetRfView = () => {
    resetRfFilters();
    setActiveView("grid");
  };

  const deviceOptions = useMemo(() => {
    if (!currentSheet) return [];
    const options: { value: string; label: string }[] = [];

    const hasBle = currentSheet.indicators.some(
      (indicator) => parseRFIndicator(indicator.name, rfMappings).protocol === "BLE"
    );
    if (hasBle) {
      options.push({ value: "BLE", label: "BLE" });
    }

    const wifiTypes = new Set<string>();
    currentSheet.indicators.forEach((indicator) => {
      const parsed = parseRFIndicator(indicator.name, rfMappings);
      if (parsed.protocol === "Wi-Fi" && parsed.testType) {
        wifiTypes.add(parsed.testType);
      }
    });

    const typeLabels: Record<string, string> = {
      PWR: "Wi-Fi - TX Power",
      EVM: "Wi-Fi - EVM",
      FRQ: "Wi-Fi - Freq Error",
      MSK: "Wi-Fi - Spectrum Mask",
      PER: "Wi-Fi - PER",
      RSI: "Wi-Fi - RSSI",
      OTHER: "Wi-Fi - Other",
    };

    Array.from(wifiTypes).sort().forEach((type) => {
      options.push({
        value: `Wi-Fi_${type}`,
        label: typeLabels[type] || `Wi-Fi - ${type}`,
      });
    });

    return options;
  }, [currentSheet, rfMappings]);

  const availableFrequencies = useMemo(() => {
    if (!currentSheet) return [];
    const freqs = new Set<number>();

    currentSheet.indicators.forEach((indicator) => {
      const parsed = parseRFIndicator(indicator.name, rfMappings);

      if (selectedDevice) {
        if (selectedDevice === "BLE" && parsed.protocol !== "BLE") return;
        if (selectedDevice.startsWith("Wi-Fi_")) {
          const type = selectedDevice.replace("Wi-Fi_", "");
          if (parsed.protocol !== "Wi-Fi" || parsed.testType !== type) return;
        }
      }

      if (parsed.frequency) {
        freqs.add(parsed.frequency);
      }
    });

    return Array.from(freqs).sort((a, b) => a - b);
  }, [currentSheet, selectedDevice, rfMappings]);

  const availableRates = useMemo(() => {
    if (!currentSheet) return [];
    const rates = new Set<string>();

    currentSheet.indicators.forEach((indicator) => {
      const parsed = parseRFIndicator(indicator.name, rfMappings);

      if (selectedDevice) {
        if (selectedDevice === "BLE" && parsed.protocol !== "BLE") return;
        if (selectedDevice.startsWith("Wi-Fi_")) {
          const type = selectedDevice.replace("Wi-Fi_", "");
          if (parsed.protocol !== "Wi-Fi" || parsed.testType !== type) return;
        }
      }

      if (selectedFreq !== null && parsed.frequency !== selectedFreq) {
        return;
      }

      if (parsed.rate) {
        rates.add(parsed.rate);
      }
    });

    return Array.from(rates).sort();
  }, [currentSheet, selectedDevice, selectedFreq, rfMappings]);

  const handleDeviceChange = (device: string | null) => {
    setSelectedDevice(device);
    setSelectedFreq(null);
    setSelectedRate(null);
  };

  const handleFrequencyChange = (frequency: number | null) => {
    setSelectedFreq(frequency);
    setSelectedRate(null);
  };

  const selectHeatmapCell = (frequency: number | null, device: string | null) => {
    setSelectedDevice(device);
    setSelectedFreq(frequency);
    setSelectedRate(null);
    setActiveView("grid");
  };

  return {
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
  };
};
