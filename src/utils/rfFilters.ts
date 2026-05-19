import { ParsedIndicator } from "./rfParser";

export const RF_TYPE_LABELS: Record<string, string> = {
  PWR: "TX Power",
  EVM: "EVM",
  FRQ: "Freq Error",
  MSK: "Spectrum Mask",
  PER: "PER",
  RSI: "RSSI",
  OTHER: "Other",
};

export const getRfDeviceFilterValue = (protocol: string, testType: string) => `${protocol}_${testType}`;

export const getRfDeviceFilterLabel = (protocol: string, testType: string) => {
  const typeLabel = RF_TYPE_LABELS[testType] || testType;
  return `${protocol} - ${typeLabel}`;
};

const matchesSingleRfDeviceFilter = (parsed: ParsedIndicator, selectedDevice: string) => {
  if (selectedDevice === "BLE") return parsed.protocol === "BLE";

  const separatorIndex = selectedDevice.lastIndexOf("_");
  if (separatorIndex === -1) return parsed.protocol === selectedDevice;

  const protocol = selectedDevice.slice(0, separatorIndex);
  const testType = selectedDevice.slice(separatorIndex + 1);
  return parsed.protocol === protocol && parsed.testType === testType;
};

export const matchesRfDeviceFilter = (parsed: ParsedIndicator, selectedDevices: string[]) => {
  if (selectedDevices.length === 0) return true;
  return selectedDevices.some((selectedDevice) => matchesSingleRfDeviceFilter(parsed, selectedDevice));
};
