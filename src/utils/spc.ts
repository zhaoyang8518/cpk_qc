import { IndicatorSummary } from "../types";
import { t, Locale } from "../i18n";

export interface BinData {
  binMin: number;
  binMax: number;
  binCenter: number;
  label: string;
  count: number;
  pcbasnList: string[]; // 落在该分箱内的单板条码列表
  pcbaItems: { asn: string; val: number }[]; // 落在该分箱内的单板条码与具体数值对
}

export interface SpcCalculationResult {
  bins: BinData[];
  normalCurve: { x: number; y: number }[];
  categories: string[];
  barData: number[];
  lineData: number[];
  mu: number;
  sigma: number;
  usl: number | null;
  lsl: number | null;
  cp: number | null;
  cpk: number | null;
  sigmaLevel: number | null; // 精确 Sigma 水平 (Z = 3 * Cpk)
  status: string; // 六西格玛判定状态
  statusColor: string; // 状态颜色
  actionTrigger: string | null; // 优化动作建议
  cpAlert: boolean; // Cp < 1.0 警报
}

/**
 * 严格遵循六西格玛 (Six Sigma) 标准的 SPC 统计算法与分箱引擎
 */
export function calculateSpc(indicator: IndicatorSummary, pcbasnList: string[], locale: Locale = "en"): SpcCalculationResult {
  const values = indicator.values || [];
  const N = values.length;

  // 1. 获取或计算均值 (mu) 与标准差 (sigma)
  let mu = indicator.average;
  let sigma = indicator.stdev;

  if (mu === null || mu === undefined) {
    mu = N > 0 ? values.reduce((acc, v) => acc + v, 0) / N : 0;
  }

  if (sigma === null || sigma === undefined) {
    if (N > 1) {
      const variance = values.reduce((acc, v) => acc + Math.pow(v - (mu as number), 2), 0) / (N - 1);
      sigma = Math.sqrt(variance);
    } else {
      sigma = 0;
    }
  }

  const usl = indicator.usl !== undefined ? indicator.usl : null;
  const lsl = indicator.lsl !== undefined ? indicator.lsl : null;
  let cpk = indicator.cpk !== undefined ? indicator.cpk : null;
  let cp: number | null = null;
  let sigmaLevel: number | null = null;

  // 2. 六西格玛 Cp / Cpk 严密计算与单边保护
  if (sigma > 1e-9) {
    if (usl !== null && lsl !== null) {
      cp = (usl - lsl) / (6 * sigma);
      const cpu = (usl - mu) / (3 * sigma);
      const cpl = (mu - lsl) / (3 * sigma);
      if (cpk === null || cpk === undefined) cpk = Math.min(cpu, cpl);
    } else if (usl !== null) {
      if (cpk === null || cpk === undefined) cpk = (usl - mu) / (3 * sigma);
    } else if (lsl !== null) {
      if (cpk === null || cpk === undefined) cpk = (mu - lsl) / (3 * sigma);
    }
  }

  if (cpk !== null) {
    sigmaLevel = 3 * cpk; // 精确计算短期 Sigma Level (Z)
  }

  // 3. 过程能力判定与警报机制 (Cp / Cpk 评估)
  let status = t("statusInsufficient", locale);
  let statusColor = "#64748b";
  let actionTrigger: string | null = null;
  let cpAlert = false;

  if (cp !== null && cp < 1.0) {
    cpAlert = true; // 流程波动过大，不具备能力
  }

  if (cpk !== null) {
    if (cpk < 1.0) {
      status = t("statusFail", locale);
      statusColor = "#ef4444"; // 红色
      if (cp !== null && cp >= 1.0) {
        actionTrigger = t("actionMeanOffset", locale);
      } else {
        actionTrigger = t("actionVariation", locale);
      }
    } else if (cpk >= 1.0 && cpk < 1.33) {
      status = t("statusPassable", locale);
      statusColor = "#f59e0b"; // 琥珀黄
      actionTrigger = t("actionMonitor", locale);
    } else if (cpk >= 1.33 && cpk < 2.0) {
      status = t("statusGood", locale);
      statusColor = "#10b981"; // 翡翠绿
    } else if (cpk >= 2.0) {
      status = t("statusWorldClass", locale);
      statusColor = "#06b6d4"; // 赛博青
    }
  }

  // 4. 直方图 X 轴范围围绕实际分布，避免规格上下限过宽时压扁柱形。
  if (N === 0) {
    return {
      bins: [],
      normalCurve: [],
      categories: [],
      barData: [],
      lineData: [],
      mu,
      sigma,
      usl,
      lsl,
      cp,
      cpk,
      sigmaLevel: null,
      status,
      statusColor,
      actionTrigger,
      cpAlert,
    };
  }

  const observedMin = Math.min(...values);
  const observedMax = Math.max(...values);
  const statisticalMin = sigma > 1e-9 ? mu - 3 * sigma : observedMin;
  const statisticalMax = sigma > 1e-9 ? mu + 3 * sigma : observedMax;
  const distributionMin = Math.min(observedMin, statisticalMin);
  const distributionMax = Math.max(observedMax, statisticalMax);
  const distributionRange = distributionMax - distributionMin;
  const buffer = Math.max(distributionRange * 0.04, sigma * 0.35, 1e-9);
  let xMin = distributionMin - buffer;
  let xMax = distributionMax + buffer;

  // 异常保护：若数据完全一致
  if (xMin === xMax) {
    xMin -= 0.5;
    xMax += 0.5;
  }

  // 5. 直方图分箱算法：比 Sturges 更细，N=100 时约 18 个柱，接近 Excel 常见输出。
  const K = Math.min(36, Math.max(10, Math.ceil(Math.sqrt(N) * 1.8)));
  const binWidth = (xMax - xMin) / K;

  const bins: BinData[] = [];
  const categories: string[] = [];
  const barData: number[] = [];
  const lineData: number[] = [];

  for (let i = 0; i < K; i++) {
    const bMin = xMin + i * binWidth;
    const bMax = bMin + binWidth;
    const bCenter = (bMin + bMax) / 2;
    const label = bCenter.toFixed(2);

    bins.push({
      binMin: bMin,
      binMax: bMax,
      binCenter: bCenter,
      label,
      count: 0,
      pcbasnList: [],
      pcbaItems: [],
    });
    categories.push(label);
  }

  // 统计频数与单板归属
  values.forEach((val, idx) => {
    const asn = pcbasnList[idx] || `UNKNOWN-${idx}`;
    for (let binIdx = 0; binIdx < bins.length; binIdx++) {
      const bin = bins[binIdx];
      const isLastBin = binIdx === bins.length - 1;
      if (val >= bin.binMin && (val < bin.binMax || (isLastBin && val <= bin.binMax))) {
        bin.count++;
        bin.pcbasnList.push(asn);
        bin.pcbaItems.push({ asn, val });
        break;
      }
    }
  });

  bins.forEach((bin) => barData.push(bin.count));

  // 6. 正态拟合曲线计算 (PDF 乘以 N * binWidth 进行量级对齐)
  const normalCurve: { x: number; y: number }[] = [];
  const areaScale = N * binWidth;

  bins.forEach((bin) => {
    const x = bin.binCenter;
    let y = 0;
    if (sigma > 1e-9) {
      const exponent = -0.5 * Math.pow((x - mu) / sigma, 2);
      const pdf = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
      y = areaScale * pdf;
    }
    lineData.push(parseFloat(y.toFixed(2)));
    normalCurve.push({ x, y });
  });

  return {
    bins,
    normalCurve,
    categories,
    barData,
    lineData,
    mu,
    sigma,
    usl,
    lsl,
    cp,
    cpk,
    sigmaLevel,
    status,
    statusColor,
    actionTrigger,
    cpAlert,
  };
}
