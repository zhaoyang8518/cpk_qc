import { RF_TYPE_LABELS } from "./rfFilters";

export const HEATMAP_ALL_FILTER = "All";

const BAND_ORDER = ["2G", "5G", "6G+", "Other"];

export const getRfHeatmapBandLabel = (frequency: number | null, protocol: string) => {
  if (protocol === "BLE") return "2G";
  if (frequency === null) return "Other";
  if (frequency >= 2400 && frequency < 2500) return "2G";
  if (frequency >= 4900 && frequency < 5925) return "5G";
  if (frequency >= 5925) return "6G+";
  const ghz = Math.floor(frequency / 1000);
  return ghz > 0 ? `${ghz}G` : "Other";
};

export const getRfHeatmapBandSortIndex = (band: string) => {
  const index = BAND_ORDER.indexOf(band);
  return index === -1 ? BAND_ORDER.length : index;
};

export const sortRfHeatmapBands = (bands: string[]) =>
  [...bands].sort((a, b) => {
    const orderDiff = getRfHeatmapBandSortIndex(a) - getRfHeatmapBandSortIndex(b);
    return orderDiff !== 0 ? orderDiff : a.localeCompare(b, undefined, { numeric: true });
  });

export const getRfHeatmapTypeLabel = (testType: string) => RF_TYPE_LABELS[testType] || testType;
