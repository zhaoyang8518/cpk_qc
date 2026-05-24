import { invoke } from "@tauri-apps/api/core";
import { IndicatorSummary, SheetData } from "../types";
import { Locale } from "../i18n";
import { loadModelSettings, ModelSettings } from "../model";
import { parseRFIndicator, RfMappingConfig } from "../utils/rfParser";
import { calculateSpc } from "../utils/spc";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type AiChatResponse = {
  content: string;
};

export type AiReportResult = {
  summary: string;
  keyFindings: string[];
  risks: string[];
  recommendedActions: string[];
  priorityIndicators: string[];
};

export type AiIndicatorExplanation = {
  summary: string;
  likelyCauses: string[];
  recommendedActions: string[];
  evidence: string[];
};

type IndicatorSnapshot = {
  name: string;
  displayName: string;
  protocol: string;
  testType: string;
  frequency: number | null;
  sampleCount: number;
  mean: number | null;
  stdev: number | null;
  min: number | null;
  max: number | null;
  usl: number | null;
  lsl: number | null;
  cp: number | null;
  cpk: number | null;
  sigmaLevel: number | null;
  status: string;
  diagnosisCode: string;
};

export type AiReportContext = {
  locale: Locale;
  fileName: string;
  sheetName: string;
  testMetric: string;
  sampleCount: number;
  indicatorCount: number;
  cpkBuckets: {
    fail: number;
    passable: number;
    good: number;
    worldClass: number;
    insufficient: number;
  };
  worstIndicators: IndicatorSnapshot[];
  rfGroups: Array<{
    protocol: string;
    testType: string;
    frequency: number | null;
    indicatorCount: number;
    failCount: number;
    worstCpk: number | null;
    avgCpk: number | null;
  }>;
};

export type AiIndicatorContext = IndicatorSnapshot & {
  locale: Locale;
  sheetName: string;
  binShape: {
    nonEmptyBins: number;
    maxBinCount: number;
    maxBinCenter: number | null;
    possibleBimodal: boolean;
  };
};

export async function generateAiReport(
  sheet: SheetData,
  fileName: string,
  rfMappings: RfMappingConfig,
  locale: Locale,
): Promise<AiReportResult> {
  const settings = await requireEnabledModel();
  const context = buildReportContext(sheet, fileName, rfMappings, locale);
  const response = await chat(settings, {
    temperature: 0.2,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          "You are a senior manufacturing quality engineer.",
          "Analyze CPK/SPC summary data only; do not invent measurements.",
          "Return strict JSON with keys: summary, keyFindings, risks, recommendedActions, priorityIndicators.",
          "Each list must contain concise engineering statements grounded in the provided data.",
          locale === "zh" ? "Respond in Simplified Chinese." : "Respond in English.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Generate a quality report from this JSON context:\n${JSON.stringify(context)}`,
      },
    ],
  });
  return parseJsonResult<AiReportResult>(response.content, {
    summary: response.content,
    keyFindings: [],
    risks: [],
    recommendedActions: [],
    priorityIndicators: [],
  });
}

export async function explainIndicatorWithAi(
  sheet: SheetData,
  indicator: IndicatorSummary,
  rfMappings: RfMappingConfig,
  locale: Locale,
): Promise<string> {
  const settings = await requireEnabledModel();
  const context = buildIndicatorContext(sheet, indicator, rfMappings, locale);
  const response = await chat(settings, {
    temperature: 0.2,
    maxTokens: 2500,
    messages: [
      {
        role: "system",
        content: [
          "You are a senior manufacturing quality engineer.",
          "Explain likely root causes using only the provided CPK/SPC facts.",
          "Provide a structured report in standard Markdown format.",
          "Do not claim certainty; use engineering language and cite numeric evidence.",
          "Use the following structure: ### Summary, ### Likely Causes, ### Recommended Actions, ### Evidence.",
          "Keep the response concise, under 300 words. Make sure to complete the entire response, ending all sentences cleanly without cutting off.",
          locale === "zh" ? "Respond in Simplified Chinese." : "Respond in English.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Explain this indicator from the JSON context:\n${JSON.stringify(context)}`,
      },
    ],
  });
  return response.content;
}

export function buildReportContext(
  sheet: SheetData,
  fileName: string,
  rfMappings: RfMappingConfig,
  locale: Locale,
): AiReportContext {
  const snapshots = sheet.indicators.map((indicator) => buildIndicatorSnapshot(indicator, sheet.pcbasn_list, rfMappings, locale));
  const cpkBuckets = {
    fail: 0,
    passable: 0,
    good: 0,
    worldClass: 0,
    insufficient: 0,
  };

  snapshots.forEach((item) => {
    if (item.cpk === null || item.cpk === undefined) cpkBuckets.insufficient += 1;
    else if (item.cpk < 1.0) cpkBuckets.fail += 1;
    else if (item.cpk < 1.33) cpkBuckets.passable += 1;
    else if (item.cpk < 2.0) cpkBuckets.good += 1;
    else cpkBuckets.worldClass += 1;
  });

  const worstIndicators = snapshots
    .filter((item) => item.cpk !== null && item.cpk !== undefined)
    .sort((a, b) => (a.cpk ?? Number.POSITIVE_INFINITY) - (b.cpk ?? Number.POSITIVE_INFINITY))
    .slice(0, 12);

  const groupMap = new Map<string, IndicatorSnapshot[]>();
  snapshots.forEach((item) => {
    const key = `${item.protocol}|${item.testType}|${item.frequency ?? "NA"}`;
    const group = groupMap.get(key) || [];
    group.push(item);
    groupMap.set(key, group);
  });

  const rfGroups = Array.from(groupMap.values())
    .map((group) => {
      const cpkValues = group.map((item) => item.cpk).filter((value): value is number => value !== null && value !== undefined);
      return {
        protocol: group[0].protocol,
        testType: group[0].testType,
        frequency: group[0].frequency,
        indicatorCount: group.length,
        failCount: group.filter((item) => item.cpk !== null && item.cpk < 1.0).length,
        worstCpk: cpkValues.length ? Math.min(...cpkValues) : null,
        avgCpk: cpkValues.length ? round(cpkValues.reduce((sum, value) => sum + value, 0) / cpkValues.length, 4) : null,
      };
    })
    .sort((a, b) => (a.worstCpk ?? Number.POSITIVE_INFINITY) - (b.worstCpk ?? Number.POSITIVE_INFINITY))
    .slice(0, 12);

  return {
    locale,
    fileName,
    sheetName: sheet.raw_sheet_name || sheet.sheet_name,
    testMetric: sheet.display_name,
    sampleCount: sheet.pcbasn_list.length,
    indicatorCount: sheet.indicators.length,
    cpkBuckets,
    worstIndicators,
    rfGroups,
  };
}

function buildIndicatorContext(
  sheet: SheetData,
  indicator: IndicatorSummary,
  rfMappings: RfMappingConfig,
  locale: Locale,
): AiIndicatorContext {
  const snapshot = buildIndicatorSnapshot(indicator, sheet.pcbasn_list, rfMappings, locale);
  const spc = calculateSpc(indicator, sheet.pcbasn_list, locale);
  const nonEmptyBins = spc.bins.filter((bin) => bin.count > 0);
  const maxBin = nonEmptyBins.reduce((best, bin) => (bin.count > (best?.count ?? -1) ? bin : best), nonEmptyBins[0]);
  const peakBins = spc.bins.filter((bin, idx, bins) => {
    if (bin.count === 0) return false;
    const left = bins[idx - 1]?.count ?? 0;
    const right = bins[idx + 1]?.count ?? 0;
    return bin.count >= left && bin.count >= right && bin.count >= (maxBin?.count ?? 0) * 0.45;
  });

  return {
    ...snapshot,
    locale,
    sheetName: sheet.raw_sheet_name || sheet.sheet_name,
    binShape: {
      nonEmptyBins: nonEmptyBins.length,
      maxBinCount: maxBin?.count ?? 0,
      maxBinCenter: maxBin?.binCenter !== undefined ? round(maxBin.binCenter, 4) : null,
      possibleBimodal: peakBins.length >= 2,
    },
  };
}

function buildIndicatorSnapshot(
  indicator: IndicatorSummary,
  pcbasnList: string[],
  rfMappings: RfMappingConfig,
  locale: Locale,
): IndicatorSnapshot {
  const parsed = parseRFIndicator(indicator.name, rfMappings);
  const spc = calculateSpc(indicator, pcbasnList, locale);
  return {
    name: indicator.name,
    displayName: parsed.displayName,
    protocol: parsed.protocol,
    testType: parsed.testType,
    frequency: parsed.frequency,
    sampleCount: indicator.values?.length ?? 0,
    mean: nullableRound(spc.mu, 6),
    stdev: nullableRound(spc.sigma, 6),
    min: nullableRound(indicator.min, 6),
    max: nullableRound(indicator.max, 6),
    usl: nullableRound(spc.usl, 6),
    lsl: nullableRound(spc.lsl, 6),
    cp: nullableRound(spc.cp, 6),
    cpk: nullableRound(spc.cpk, 6),
    sigmaLevel: nullableRound(spc.sigmaLevel, 6),
    status: spc.status,
    diagnosisCode: getDiagnosisCode(spc.cp, spc.cpk, spc.usl, spc.lsl, spc.mu),
  };
}

function getDiagnosisCode(cp: number | null, cpk: number | null, usl: number | null, lsl: number | null, mean: number): string {
  if (cpk === null || cpk === undefined) return "INSUFFICIENT_DATA";
  if (cp !== null && cp < 1.0) return "HIGH_VARIATION";
  if (usl !== null && lsl !== null) {
    const center = (usl + lsl) / 2;
    if (cpk < 1.33 && mean > center) return "MEAN_SHIFT_TO_USL";
    if (cpk < 1.33 && mean < center) return "MEAN_SHIFT_TO_LSL";
  }
  if (cpk < 1.0) return "LOW_CPK";
  if (cpk < 1.33) return "MARGINAL_CAPABILITY";
  return "CONTROLLED";
}

async function requireEnabledModel(): Promise<ModelSettings> {
  const settings = await loadModelSettings();
  if (!settings.enabled || settings.provider === "none") {
    throw new Error("AI model is not enabled. Configure and enable an AI model in Settings first.");
  }
  if (!settings.model) {
    throw new Error("AI model name is empty. Select or enter a model in Settings first.");
  }
  return settings;
}

async function chat(settings: ModelSettings, request: AiChatRequest): Promise<AiChatResponse> {
  return invoke<AiChatResponse>("ai_chat_completion", { settings, request });
}

function parseJsonResult<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(stripJsonFence(content)) as T;
  } catch {
    return fallback;
  }
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : trimmed;
}

function nullableRound(value: number | null | undefined, digits: number): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return round(value, digits);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
