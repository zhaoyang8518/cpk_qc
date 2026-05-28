import { useMemo, useState } from "react";
import { SheetData } from "../types";
import { RfMappingConfig, parseRFIndicator } from "../utils/rfParser";
import { MainView } from "../components/RfFilterBar";
import { getRfHeatmapBandLabel, sortRfHeatmapBands } from "../utils/rfHeatmap";

const sortNumericLabels = (values: string[]) =>
  [...values].sort((a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return a.localeCompare(b, undefined, { numeric: true });
  });

const sortBandwidths = (values: string[]) =>
  [...values].sort((a, b) => {
    const prefixDiff = a.charAt(0).localeCompare(b.charAt(0));
    if (prefixDiff !== 0) return prefixDiff;
    const aNum = Number(a.replace(/^\D+/, ""));
    const bNum = Number(b.replace(/^\D+/, ""));
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return a.localeCompare(b, undefined, { numeric: true });
  });

export const useRfFilters = (currentSheet: SheetData | null, rfMappings: RfMappingConfig) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedBands, setSelectedBands] = useState<string[]>([]);
  const [selectedFrequencies, setSelectedFrequencies] = useState<number[]>([]);
  const [selectedBandwidths, setSelectedBandwidths] = useState<string[]>([]);
  const [selectedRates, setSelectedRates] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<MainView>("grid");

  const resetRfFilters = () => {
    setSelectedDevices([]);
    setSelectedBands([]);
    setSelectedFrequencies([]);
    setSelectedBandwidths([]);
    setSelectedRates([]);
    setSelectedChannels([]);
  };

  const resetRfView = () => {
    resetRfFilters();
    setActiveView("grid");
  };

  const parsedIndicators = useMemo(() => {
    if (!currentSheet) return [];
    return currentSheet.indicators.map((indicator) => ({
      indicator,
      parsed: parseRFIndicator(indicator.name, rfMappings),
    }));
  }, [currentSheet, rfMappings]);

  const deviceOptions = useMemo(() => {
    const protocols = new Set(parsedIndicators.map(({ parsed }) => parsed.protocol));
    return Array.from(protocols)
      .sort((a, b) => {
        if (a === "Wi-Fi") return -1;
        if (b === "Wi-Fi") return 1;
        return a.localeCompare(b);
      })
      .map((protocol) => ({ value: protocol, label: protocol }));
  }, [parsedIndicators]);

  const availableBands = useMemo(() => {
    const bands = new Set<string>();
    parsedIndicators.forEach(({ parsed }) => {
      if (selectedDevices.length > 0 && !selectedDevices.includes(parsed.protocol)) return;
      if (parsed.frequency === null) return;
      bands.add(getRfHeatmapBandLabel(parsed.frequency, parsed.protocol));
    });
    return sortRfHeatmapBands(Array.from(bands));
  }, [parsedIndicators, selectedDevices]);

  const availableFrequencies = useMemo(() => {
    const freqs = new Set<number>();
    parsedIndicators.forEach(({ parsed }) => {
      if (selectedDevices.length > 0 && !selectedDevices.includes(parsed.protocol)) return;
      if (parsed.frequency === null) return;
      if (selectedBands.length > 0 && !selectedBands.includes(getRfHeatmapBandLabel(parsed.frequency, parsed.protocol))) return;
      freqs.add(parsed.frequency);
    });
    return Array.from(freqs).sort((a, b) => a - b);
  }, [parsedIndicators, selectedDevices, selectedBands]);

  const availableBandwidths = useMemo(() => {
    const bandwidths = new Set<string>();
    parsedIndicators.forEach(({ parsed }) => {
      if (selectedDevices.length > 0 && !selectedDevices.includes(parsed.protocol)) return;
      if (parsed.frequency === null) return;
      if (selectedBands.length > 0 && !selectedBands.includes(getRfHeatmapBandLabel(parsed.frequency, parsed.protocol))) return;
      if (selectedFrequencies.length > 0 && !selectedFrequencies.includes(parsed.frequency)) return;
      if (parsed.bandwidth) bandwidths.add(parsed.bandwidth);
    });
    return sortBandwidths(Array.from(bandwidths));
  }, [parsedIndicators, selectedDevices, selectedBands, selectedFrequencies]);

  const availableRates = useMemo(() => {
    const rates = new Set<string>();
    parsedIndicators.forEach(({ parsed }) => {
      if (selectedDevices.length > 0 && !selectedDevices.includes(parsed.protocol)) return;
      if (parsed.frequency === null) return;
      if (selectedBands.length > 0 && !selectedBands.includes(getRfHeatmapBandLabel(parsed.frequency, parsed.protocol))) return;
      if (selectedFrequencies.length > 0 && !selectedFrequencies.includes(parsed.frequency)) return;
      if (selectedBandwidths.length > 0 && !selectedBandwidths.includes(parsed.bandwidth)) return;
      if (parsed.rate) rates.add(parsed.rate);
    });
    return sortNumericLabels(Array.from(rates));
  }, [parsedIndicators, selectedDevices, selectedBands, selectedFrequencies, selectedBandwidths]);

  const availableChannels = useMemo(() => {
    const channels = new Set<string>();
    parsedIndicators.forEach(({ parsed }) => {
      if (selectedDevices.length > 0 && !selectedDevices.includes(parsed.protocol)) return;
      if (parsed.frequency === null) return;
      if (selectedBands.length > 0 && !selectedBands.includes(getRfHeatmapBandLabel(parsed.frequency, parsed.protocol))) return;
      if (selectedFrequencies.length > 0 && !selectedFrequencies.includes(parsed.frequency)) return;
      if (selectedBandwidths.length > 0 && !selectedBandwidths.includes(parsed.bandwidth)) return;
      if (selectedRates.length > 0 && !selectedRates.includes(parsed.rate)) return;
      if (parsed.chain) channels.add(parsed.chain);
    });
    return sortNumericLabels(Array.from(channels));
  }, [parsedIndicators, selectedDevices, selectedBands, selectedFrequencies, selectedBandwidths, selectedRates]);

  const handleDeviceChange = (devices: string[]) => {
    setSelectedDevices(devices);
    setSelectedBands([]);
    setSelectedFrequencies([]);
    setSelectedBandwidths([]);
    setSelectedRates([]);
    setSelectedChannels([]);
  };

  const handleBandChange = (bands: string[]) => {
    setSelectedBands(bands);
    setSelectedFrequencies([]);
    setSelectedBandwidths([]);
    setSelectedRates([]);
    setSelectedChannels([]);
  };

  const handleFrequencyChange = (frequencies: number[]) => {
    setSelectedFrequencies(frequencies);
    setSelectedBandwidths([]);
    setSelectedRates([]);
    setSelectedChannels([]);
  };

  const handleBandwidthChange = (bandwidths: string[]) => {
    setSelectedBandwidths(bandwidths);
    setSelectedRates([]);
    setSelectedChannels([]);
  };

  const handleRateChange = (rates: string[]) => {
    setSelectedRates(rates);
    setSelectedChannels([]);
  };

  const handleChannelChange = (channels: string[]) => {
    setSelectedChannels(channels);
  };

  const selectHeatmapCell = (frequency: number | null, device: string | null) => {
    const protocol = device ? device.split("_")[0] : "";
    setSelectedDevices(protocol ? [protocol] : []);
    setSelectedBands([]);
    setSelectedFrequencies(frequency !== null ? [frequency] : []);
    setSelectedBandwidths([]);
    setSelectedRates([]);
    setSelectedChannels([]);
    setActiveView("grid");
  };

  return {
    selectedDevices,
    selectedBands,
    selectedFrequencies,
    selectedBandwidths,
    selectedRates,
    selectedChannels,
    activeView,
    setActiveView,
    resetRfFilters,
    resetRfView,
    deviceOptions,
    availableBands,
    availableFrequencies,
    availableBandwidths,
    availableRates,
    availableChannels,
    handleDeviceChange,
    handleBandChange,
    handleFrequencyChange,
    handleBandwidthChange,
    handleRateChange,
    handleChannelChange,
    selectHeatmapCell,
  };
};
