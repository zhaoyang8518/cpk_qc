import { IndicatorSummary } from "../types";

export interface BinData {
  binMin: number;
  binMax: number;
  binCenter: number;
  label: string;
  count: number;
  pcbasnList: string[]; // 落在该分箱内的单板条码列表
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
  cpk: number | null;
}

/**
 * 核心统计与分箱分析算法
 */
export function calculateSpc(indicator: IndicatorSummary, pcbasnList: string[]): SpcCalculationResult {
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

  // 2. CPK 补充计算与单边保护
  if ((cpk === null || cpk === undefined) && sigma > 1e-9) {
    if (usl !== null && lsl !== null) {
      const cpu = (usl - mu) / (3 * sigma);
      const cpl = (mu - lsl) / (3 * sigma);
      cpk = Math.min(cpu, cpl);
    } else if (usl !== null) {
      cpk = (usl - mu) / (3 * sigma);
    } else if (lsl !== null) {
      cpk = (mu - lsl) / (3 * sigma);
    }
  }

  // 3. 直方图分箱算法 (Sturges 规则)
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
      cpk,
    };
  }

  let minVal = indicator.min !== null && indicator.min !== undefined ? indicator.min : Math.min(...values);
  let maxVal = indicator.max !== null && indicator.max !== undefined ? indicator.max : Math.max(...values);

  if (minVal === maxVal) {
    minVal -= 0.5;
    maxVal += 0.5;
  }

  // 计算组数 K (Sturges 规则)
  const K = Math.max(5, Math.ceil(1 + 3.322 * Math.log10(N)));
  const rawBinWidth = (maxVal - minVal) / K;
  const binWidth = rawBinWidth === 0 ? 1 : rawBinWidth;

  // 向外扩展半个组距，确保数据处于分箱内部
  const startVal = minVal - binWidth * 0.5;

  const bins: BinData[] = [];
  const categories: string[] = [];
  const barData: number[] = [];
  const lineData: number[] = [];

  for (let i = 0; i < K + 1; i++) {
    const bMin = startVal + i * binWidth;
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
    });
    categories.push(label);
  }

  // 统计频数与单板归属
  values.forEach((val, idx) => {
    const asn = pcbasnList[idx] || `UNKNOWN-${idx}`;
    for (const bin of bins) {
      if (val >= bin.binMin && val < bin.binMax) {
        bin.count++;
        bin.pcbasnList.push(asn);
        break;
      }
    }
  });

  bins.forEach((bin) => barData.push(bin.count));

  // 4. 正态拟合曲线计算 (PDF 乘以 N * binWidth 进行量级对齐)
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
    cpk,
  };
}
