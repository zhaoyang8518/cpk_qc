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
  raw_sheet_name: string;
  test_metric_key: string;
  display_name: string;
  pcbasn_list: string[];
  indicators: IndicatorSummary[];
}

export interface Supplier {
  supplier_key: string;
  supplier_name: string;
}

export type CpkStatus = "red" | "yellow" | "green" | "cyan";
