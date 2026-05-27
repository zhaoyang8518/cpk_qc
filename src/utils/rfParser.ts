export interface RfMappingConfig {
  protocols: {
    BLE: string[];
  };
  parameters: {
    PWR: string[];
    EVM: string[];
    FRQ: string[];
    MSK: string[];
    PER: string[];
    RSI: string[];
  };
}

export const DEFAULT_RF_MAPPINGS: RfMappingConfig = {
  protocols: {
    BLE: ["TBLE", "BLUE", "BT", "BLE"]
  },
  parameters: {
    PWR: ["PWR", "POWER", "TXPWR", "TX_PWR", "LEVEL", "TPWR", "TARGET_POWER", "TARGETPWR", "TARGET_PWR"],
    EVM: ["EVM", "TEVM", "MOD", "ERROR_VECTOR"],
    FRQ: ["FRQ", "FREQ", "ERROR", "OFFSET", "PPM"],
    MSK: ["MSK", "MASK", "SPEC_MASK", "SPECTRUM"],
    PER: ["PER", "BER", "LOSS", "ERR_RATE"],
    RSI: ["RSI", "RSSI", "SENS", "RX_SENS", "RX_LEVEL"]
  }
};

const mergeAliases = (savedAliases: string[] | undefined, defaultAliases: string[]) => {
  const aliases = new Set([...(savedAliases || []), ...defaultAliases]);
  return Array.from(aliases);
};

export const mergeRfMappingsWithDefaults = (saved: Partial<RfMappingConfig>): RfMappingConfig => ({
  protocols: {
    BLE: mergeAliases(saved.protocols?.BLE, DEFAULT_RF_MAPPINGS.protocols.BLE),
  },
  parameters: {
    PWR: mergeAliases(saved.parameters?.PWR, DEFAULT_RF_MAPPINGS.parameters.PWR),
    EVM: mergeAliases(saved.parameters?.EVM, DEFAULT_RF_MAPPINGS.parameters.EVM),
    FRQ: mergeAliases(saved.parameters?.FRQ, DEFAULT_RF_MAPPINGS.parameters.FRQ),
    MSK: mergeAliases(saved.parameters?.MSK, DEFAULT_RF_MAPPINGS.parameters.MSK),
    PER: mergeAliases(saved.parameters?.PER, DEFAULT_RF_MAPPINGS.parameters.PER),
    RSI: mergeAliases(saved.parameters?.RSI, DEFAULT_RF_MAPPINGS.parameters.RSI),
  },
});

export interface ParsedIndicator {
  rawName: string;
  testType: string;         // e.g. "PWR", "EVM", "FRQ", "MSK", "PER", "RSI", or "OTHER"
  protocol: string;         // e.g. "Wi-Fi", "BLE"
  frequency: number | null; // e.g. 5180, 2402
  rate: string;             // Legacy filter value. For modulation filters this is the numeric value, e.g. "6", "11"
  bandwidth: string;        // e.g. "H160"
  modulation: string;       // e.g. "M6", "M11", "MCS9"
  chain: string;            // e.g. "CHA1", "CHA2"
  run: string;              // e.g. "Test 1"
  lsl: number | null;
  usl: number | null;
  displayName: string;      // Beautified title
}

export function parseRFIndicator(rawName: string, config: RfMappingConfig): ParsedIndicator {
  let lsl: number | null = null;
  let usl: number | null = null;
  let baseName = rawName;

  // Extract LSL / USL limits in parenthesis (e.g. (16.00/20.00))
  const limitMatch = rawName.match(/\(([^/]+)\/([^)]+)\)/);
  if (limitMatch) {
    lsl = parseFloat(limitMatch[1]);
    usl = parseFloat(limitMatch[2]);
    baseName = rawName.replace(/\([^)]+\)/, "");
  }

  // Identify Protocol
  let protocol = "Wi-Fi";
  const isBle = config.protocols.BLE.some((alias) =>
    baseName.toLowerCase().includes(alias.toLowerCase())
  );
  if (isBle) {
    protocol = "BLE";
  }

  // Identify Test Type (Parameter Category)
  let testType = "OTHER";
  for (const [type, aliases] of Object.entries(config.parameters)) {
    if (aliases.some((alias) => baseName.toLowerCase().includes(alias.toLowerCase()))) {
      testType = type;
      break;
    }
  }

  // Extract Frequency (4 consecutive digits starting with 2, 5 or 6, e.g. 2402, 5180, 5610, 5885)
  let frequency: number | null = null;
  const freqMatches = baseName.match(/\d{4}/g);
  if (freqMatches) {
    const rfFreq = freqMatches.find((f) => f.startsWith("2") || f.startsWith("5") || f.startsWith("6"));
    if (rfFreq) {
      frequency = parseInt(rfFreq);
    } else {
      frequency = parseInt(freqMatches[0]);
    }
  }

  let bandwidth = "";
  let modulation = "";

  // TPWR item names encode modulation and channel after frequency:
  // TPWR5180M000006M01 -> M6, CHA1
  // TPWR6185MH160M1102 -> H160, M11, CHA2
  // TPWR2437MV20MCS801 -> V20, MCS8, CHA1
  const tpwrHMatch = baseName.match(/TPWR(\d+)MH(\d+)(MCS|MS|M)(\d+?)(?:M)?(\d{2})$/i);
  const tpwrVMatch = baseName.match(/TPWR(\d+)MV(\d+)(MCS|MS|M)(\d+?)(?:M)?(\d{2})$/i);
  const tpwrNoBandwidthMatch = baseName.match(/TPWR(\d+)(MCS|MS|M)(\d+?)(?:M)?(\d{2})$/i);
  const tpwrMatch = tpwrHMatch || tpwrVMatch || tpwrNoBandwidthMatch;
  if (tpwrMatch) {
    const hasBandwidth = Boolean(tpwrHMatch || tpwrVMatch);
    frequency = parseInt(tpwrMatch[1]);
    bandwidth = hasBandwidth ? `${tpwrHMatch ? "H" : "V"}${parseInt(tpwrMatch[2])}` : "";
    const modulationType = tpwrMatch[hasBandwidth ? 3 : 2].toUpperCase();
    const modulationValue = parseInt(tpwrMatch[hasBandwidth ? 4 : 3]);
    modulation = `${modulationType}${modulationValue}`;
    const chainNumber = parseInt(tpwrMatch[hasBandwidth ? 5 : 4]);
    const readableType = testType === "OTHER" ? "TX Power" : undefined;
    const typeLabelMap: Record<string, string> = {
      PWR: "TX Power",
      EVM: "EVM",
      FRQ: "Freq Error",
      MSK: "Spectrum Mask",
      PER: "PER",
      RSI: "RSSI",
      OTHER: "Test Item",
    };
    const typeLabel = readableType || typeLabelMap[testType] || testType;
    const detailParts = [bandwidth, modulation, `CHA${chainNumber}`].filter(Boolean);

    return {
      rawName,
      testType: testType === "OTHER" ? "PWR" : testType,
      protocol,
      frequency,
      rate: String(modulationValue),
      bandwidth,
      modulation,
      chain: `CHA${chainNumber}`,
      run: "",
      lsl,
      usl,
      displayName: `${protocol} ${typeLabel} @ ${frequency}MHz (${detailParts.join(", ")})`.trim(),
    };
  }

  // Extract Rate & Bandwidth (e.g., 54M, V80MCS9 -> 80M (MCS9), etc.)
  let rate = "";
  const vhtMatch = baseName.match(/V(\d+)MCS(\d+)/i);
  const vhtMatch2 = baseName.match(/V(\d+)/i);
  if (vhtMatch) {
    bandwidth = `${vhtMatch[1]}M`;
    const modulationValue = parseInt(vhtMatch[2]);
    modulation = `MCS${modulationValue}`;
    rate = String(modulationValue);
  } else if (vhtMatch2) {
    bandwidth = `${vhtMatch2[1]}M`;
    const mcsMatch = baseName.match(/MCS(\d+)/i);
    if (mcsMatch) {
      const modulationValue = parseInt(mcsMatch[1]);
      modulation = `MCS${modulationValue}`;
      rate = String(modulationValue);
    } else {
      rate = `${vhtMatch2[1]}M`;
    }
  } else {
    const matches = baseName.match(/\d+M/ig) || [];
    const rateVal = matches.find((m) => {
      const val = parseInt(m);
      return frequency === null || val !== frequency;
    });
    if (rateVal) {
      rate = rateVal.toUpperCase();
    }
  }

  // Extract Chain / Path
  let chain = "";
  const chainMatch = baseName.match(/(chain|ant|ch)[_-]?(\d+)/i);
  if (chainMatch) {
    chain = `CHA${parseInt(chainMatch[2])}`;
  } else {
    // Fallback: ending M01, M02 etc. but avoid matching the test run suffix at the very end
    const mMatch = baseName.match(/M(\d{2})(?=\d{2}$|$)/i);
    if (mMatch) {
      chain = `CHA${parseInt(mMatch[1])}`;
    }
  }

  // Extract Test Run Number (suffix 01, 02 indicating test run count)
  let run = "";
  const runMatch = baseName.match(/(\d{2})$/);
  if (runMatch) {
    run = `Test ${parseInt(runMatch[1])}`;
  }

  // Create human-readable title
  const typeMap: Record<string, string> = {
    PWR: "TX Power",
    EVM: "EVM",
    FRQ: "Freq Error",
    MSK: "Spectrum Mask",
    PER: "PER",
    RSI: "RSSI",
    OTHER: "Test Item",
  };

  const readableType = typeMap[testType] || testType;
  const protocolPrefix = `${protocol} `;
  const freqStr = frequency ? `${frequency}MHz` : "";
  
  const detailParts: string[] = [];
  if (bandwidth) detailParts.push(bandwidth);
  if (modulation) detailParts.push(modulation);
  if (!bandwidth && !modulation && rate) detailParts.push(rate);
  if (chain) detailParts.push(chain);
  if (run) detailParts.push(run);
  const detailStr = detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";

  const displayName = `${protocolPrefix}${readableType} @ ${freqStr}${detailStr}`.trim();

  return {
    rawName,
    testType,
    protocol,
    frequency,
    rate,
    bandwidth,
    modulation,
    chain,
    run,
    lsl,
    usl,
    displayName,
  };
}
