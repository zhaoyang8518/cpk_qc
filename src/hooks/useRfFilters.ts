import { useMemo, useState } from "react";
import { SheetData } from "../types";
import { RfMappingConfig, parseRFIndicator } from "../utils/rfParser";
import { MainView } from "../components/RfFilterBar";
import { getRfDeviceFilterLabel, getRfDeviceFilterValue, matchesRfDeviceFilter } from "../utils/rfFilters";

export const useRfFilters = (currentSheet: SheetData | null, rfMappings: RfMappingConfig) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedFrequencies, setSelectedFrequencies] = useState<number[]>([]);
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<MainView>("grid");

  const resetRfFilters = () => {
    setSelectedDevices([]);
    setSelectedFrequencies([]);
    setSelectedRates([]);
  };

  const resetRfView = () => {
    resetRfFilters();
    setActiveView("grid");
  };

  const deviceOptions = useMemo(() => {
    if (!currentSheet) return [];
    const optionMap = new Map<string, { value: string; label: string }>();

    currentSheet.indicators.forEach((indicator) => {
      const parsed = parseRFIndicator(indicator.name, rfMappings);
      if (!parsed.testType) return;

      const value = getRfDeviceFilterValue(parsed.protocol, parsed.testType);
      optionMap.set(value, {
        value,
        label: getRfDeviceFilterLabel(parsed.protocol, parsed.testType),
      });
    });

    return Array.from(optionMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [currentSheet, rfMappings]);

  const availableFrequencies = useMemo(() => {
    if (!currentSheet) return [];
    const freqs = new Set<number>();

    currentSheet.indicators.forEach((indicator) => {
      const parsed = parseRFIndicator(indicator.name, rfMappings);

      if (!matchesRfDeviceFilter(parsed, selectedDevices)) return;

      if (parsed.frequency) {
        freqs.add(parsed.frequency);
      }
    });

    return Array.from(freqs).sort((a, b) => a - b);
  }, [currentSheet, selectedDevices, rfMappings]);

  const availableRates = useMemo(() => {
    if (!currentSheet) return [];
    const rates = new Set<string>();

    currentSheet.indicators.forEach((indicator) => {
      const parsed = parseRFIndicator(indicator.name, rfMappings);

      if (!matchesRfDeviceFilter(parsed, selectedDevices)) return;

      if (selectedFrequencies.length > 0 && (parsed.frequency === null || !selectedFrequencies.includes(parsed.frequency))) {
        return;
      }

      if (parsed.rate) {
        rates.add(parsed.rate);
      }
    });

    return Array.from(rates).sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return aNum - bNum;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [currentSheet, selectedDevices, selectedFrequencies, rfMappings]);

  const handleDeviceChange = (devices: string[]) => {
    setSelectedDevices(devices);
    setSelectedFrequencies([]);
    setSelectedRates([]);
  };

  const handleFrequencyChange = (frequencies: number[]) => {
    setSelectedFrequencies(frequencies);
    setSelectedRates([]);
  };

  const selectHeatmapCell = (frequency: number | null, device: string | null) => {
    setSelectedDevices(device ? [device] : []);
    setSelectedFrequencies(frequency !== null ? [frequency] : []);
    setSelectedRates([]);
    setActiveView("grid");
  };

  return {
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
  };
};
