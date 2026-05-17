export interface IndicatorSummary {
  name: string;
  average: number | null;
  max: number | null;
  min: number | null;
  stdev: number | null;
  ca: number | null;
  cp: number | null;
  cpk: number | null;
  usl: number | null;
  lsl: number | null;
  values: number[];
  value_asns: string[];
}

export interface SheetData {
  sheet_name: string;
  pcbasn_list: string[];
  indicators: IndicatorSummary[];
}
