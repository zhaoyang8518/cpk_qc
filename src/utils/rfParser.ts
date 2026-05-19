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
    PWR: ["PWR", "POWER", "TXPWR", "TX_PWR", "LEVEL", "TPWR"],
    EVM: ["EVM", "TEVM", "MOD", "ERROR_VECTOR"],
    FRQ: ["FRQ", "FREQ", "ERROR", "OFFSET", "PPM"],
    MSK: ["MSK", "MASK", "SPEC_MASK", "SPECTRUM"],
    PER: ["PER", "BER", "LOSS", "ERR_RATE"],
    RSI: ["RSI", "RSSI", "SENS", "RX_SENS", "RX_LEVEL"]
  }
};

export interface ParsedIndicator {
  rawName: string;
  testType: string;         // e.g. "PWR", "EVM", "FRQ", "MSK", "PER", "RSI", or "OTHER"
  protocol: string;         // e.g. "Wi-Fi", "BLE"
  frequency: number | null; // e.g. 5180, 2402
  rate: string;             // e.g. "6M", "54M", "80M (MCS9)"
  chain: string;            // e.g. "Chain 01", "Chain 02"
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

  // Extract Rate & Bandwidth (e.g., 54M, V80MCS9 -> 80M (MCS9), etc.)
  let rate = "";
  const vhtMatch = baseName.match(/V(\d+)MCS(\d+)/i);
  const vhtMatch2 = baseName.match(/V(\d+)/i);
  if (vhtMatch) {
    rate = `${vhtMatch[1]}M (MCS${vhtMatch[2]})`;
  } else if (vhtMatch2) {
    rate = `${vhtMatch2[1]}M`;
    const mcsMatch = baseName.match(/MCS(\d+)/i);
    if (mcsMatch) {
      rate = `${vhtMatch2[1]}M (MCS${mcsMatch[1]})`;
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
    chain = `Chain ${parseInt(chainMatch[2])}`;
  } else {
    // Fallback: ending M01, M02 etc. but avoid matching the test run suffix at the very end
    const mMatch = baseName.match(/M(\d{2})(?=\d{2}$|$)/i);
    if (mMatch) {
      chain = `Chain ${parseInt(mMatch[1])}`;
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
  const protocolPrefix = protocol === "BLE" ? "BLE " : "";
  const freqStr = frequency ? `${frequency}MHz` : "";
  
  const detailParts: string[] = [];
  if (rate) detailParts.push(rate);
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
    chain,
    run,
    lsl,
    usl,
    displayName,
  };
}
