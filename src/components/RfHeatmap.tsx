import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Check, ChevronDown, Circle, RadioTower, Search, SlidersHorizontal, Target, MoreHorizontal } from "lucide-react";
import { IndicatorSummary } from "../types";
import { parseRFIndicator, RfMappingConfig } from "../utils/rfParser";
import { RF_TYPE_LABELS } from "../utils/rfFilters";
import { t, useLocale } from "../i18n";

interface RfHeatmapProps {
  indicators: IndicatorSummary[];
  pcbasnList: string[];
  rfMappings: RfMappingConfig;
  onSelectCell: (freq: number | null, deviceVal: string | null) => void;
}

interface MatrixColumn {
  indicator: IndicatorSummary;
  parsed: ReturnType<typeof parseRFIndicator>;
  mean: number;
  sigma: number;
  min: number;
  max: number;
}

interface MatrixCell {
  value: number | null;
  color: string;
  textColor: string;
  score: number;
  label: string;
  severity: "nominal" | "watch" | "warning" | "critical";
  sigmaScore: number;
  edgeRatio: number | null;
  reason: string;
}

interface SelectedCell {
  rowIdx: number;
  indicatorName: string;
}

const BAND_ORDER = ["2G", "5G", "6G", "Other"];

const getBandLabel = (frequency: number | null, protocol: string) => {
  if (protocol === "BLE") return "2G";
  if (frequency === null) return "Other";
  if (frequency >= 2400 && frequency < 2500) return "2G";
  if (frequency >= 4900 && frequency < 5925) return "5G";
  if (frequency >= 5925 && frequency <= 7125) return "6G";
  const ghz = Math.floor(frequency / 1000);
  return ghz > 0 ? `${ghz}G` : "Other";
};

const getBandSortIndex = (band: string) => {
  const index = BAND_ORDER.indexOf(band);
  return index === -1 ? BAND_ORDER.length : index;
};

const getCellTone = (value: number | null, column: MatrixColumn): MatrixCell => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return {
      value: null,
      color: "#0f172a",
      textColor: "#64748b",
      score: 0,
      label: "",
      severity: "nominal",
      sigmaScore: 0,
      edgeRatio: null,
      reason: "No measurement",
    };
  }

  const { lsl, usl } = column.indicator;
  const hasLsl = lsl !== null && lsl !== undefined;
  const hasUsl = usl !== null && usl !== undefined;

  // Case 1: Double-sided limits
  if (hasLsl && hasUsl && usl > lsl) {
    if (value < lsl || value > usl) {
      return {
        value,
        color: "#be123c", // Red (OOS)
        textColor: "#fff1f2",
        score: 4,
        label: value.toFixed(2),
        severity: "critical",
        sigmaScore: 0,
        edgeRatio: 1,
        reason: value < lsl ? "Below LSL" : "Above USL",
      };
    }

    const center = (lsl + usl) / 2;
    const halfRange = (usl - lsl) / 2;
    const ratio = halfRange > 1e-9 ? Math.abs(value - center) / halfRange : 0;
    if (ratio >= 0.8) {
      return {
        value,
        color: "#ea580c", // Orange
        textColor: "#fff7ed",
        score: 3,
        label: value.toFixed(2),
        severity: "warning",
        sigmaScore: 0,
        edgeRatio: ratio,
        reason: "Near specification limit",
      };
    }
    if (ratio >= 0.6) {
      return {
        value,
        color: "#f59e0b", // Yellow
        textColor: "#1f2937",
        score: 2,
        label: value.toFixed(2),
        severity: "watch",
        sigmaScore: 0,
        edgeRatio: ratio,
        reason: "Approaching specification limit",
      };
    }
    return {
      value,
      color: "#16a34a", // Green
      textColor: "#ecfdf5",
      score: 0,
      label: value.toFixed(2),
      severity: "nominal",
      sigmaScore: 0,
      edgeRatio: ratio,
      reason: "Nominal",
    };
  }

  // Case 2: Only LSL is present
  if (hasLsl) {
    if (value < lsl) {
      return {
        value,
        color: "#be123c", // Red (OOS)
        textColor: "#fff1f2",
        score: 4,
        label: value.toFixed(2),
        severity: "critical",
        sigmaScore: 0,
        edgeRatio: 1,
        reason: "Below LSL",
      };
    }
    const mean = column.mean;
    const margin = mean - lsl;
    if (margin > 1e-9) {
      const ratio = (mean - value) / margin;
      if (ratio >= 0.8) {
        return {
          value,
          color: "#ea580c", // Orange
          textColor: "#fff7ed",
          score: 3,
          label: value.toFixed(2),
          severity: "warning",
          sigmaScore: 0,
          edgeRatio: ratio,
          reason: "Near LSL limit",
        };
      }
      if (ratio >= 0.6) {
        return {
          value,
          color: "#f59e0b", // Yellow
          textColor: "#1f2937",
          score: 2,
          label: value.toFixed(2),
          severity: "watch",
          sigmaScore: 0,
          edgeRatio: ratio,
          reason: "Approaching LSL limit",
        };
      }
    }
    return {
      value,
      color: "#16a34a", // Green
      textColor: "#ecfdf5",
      score: 0,
      label: value.toFixed(2),
      severity: "nominal",
      sigmaScore: 0,
      edgeRatio: null,
      reason: "Nominal",
    };
  }

  // Case 3: Only USL is present
  if (hasUsl) {
    if (value > usl) {
      return {
        value,
        color: "#be123c", // Red (OOS)
        textColor: "#fff1f2",
        score: 4,
        label: value.toFixed(2),
        severity: "critical",
        sigmaScore: 0,
        edgeRatio: 1,
        reason: "Above USL",
      };
    }
    const mean = column.mean;
    const margin = usl - mean;
    if (margin > 1e-9) {
      const ratio = (value - mean) / margin;
      if (ratio >= 0.8) {
        return {
          value,
          color: "#ea580c", // Orange
          textColor: "#fff7ed",
          score: 3,
          label: value.toFixed(2),
          severity: "warning",
          sigmaScore: 0,
          edgeRatio: ratio,
          reason: "Near USL limit",
        };
      }
      if (ratio >= 0.6) {
        return {
          value,
          color: "#f59e0b", // Yellow
          textColor: "#1f2937",
          score: 2,
          label: value.toFixed(2),
          severity: "watch",
          sigmaScore: 0,
          edgeRatio: ratio,
          reason: "Approaching USL limit",
        };
      }
    }
    return {
      value,
      color: "#16a34a", // Green
      textColor: "#ecfdf5",
      score: 0,
      label: value.toFixed(2),
      severity: "nominal",
      sigmaScore: 0,
      edgeRatio: null,
      reason: "Nominal",
    };
  }

  // Case 4: No specification limits at all
  return {
    value,
    color: "#1e293b", // Slate 800 (Neutral background, as there is no limit target)
    textColor: "#94a3b8", // Slate 400
    score: 0,
    label: value.toFixed(2),
    severity: "nominal",
    sigmaScore: 0,
    edgeRatio: null,
    reason: "No specification limits",
  };
};

const compactTitle = (column: MatrixColumn) => {
  const { parsed } = column;
  const pieces = [
    parsed.frequency ? `${parsed.frequency}` : "",
    parsed.bandwidth,
    parsed.modulation ? `M${parsed.rate}` : parsed.rate,
    parsed.chain,
  ].filter(Boolean);
  return pieces.join(" ");
};

const fullTitle = (column: MatrixColumn) => {
  const type = RF_TYPE_LABELS[column.parsed.testType] || column.parsed.testType;
  return `${type} | ${column.parsed.displayName}`;
};

const SelectControl = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const displayValue = value === "All" ? label : value;

  return (
    <div ref={rootRef} className="relative w-28">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 w-full items-center rounded-2xl border border-slate-600/70 bg-slate-950/60 px-3 text-left text-xs text-slate-200 shadow-inner transition-colors hover:border-slate-500 focus:border-blue-500/80 focus:outline-none"
        title={`${label}: ${value}`}
      >
        <span className={`min-w-0 flex-1 truncate ${value === "All" ? "text-slate-500" : "text-slate-200"}`}>
          {displayValue}
        </span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-10 z-50 w-40 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {options.map((option) => {
              const isSelected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                    isSelected ? "bg-blue-500/15 text-blue-200" : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                  }`}
                >
                  <span
                    className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600 bg-slate-900"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const Metric = ({ label, value, accent }: { label: string; value: string; accent: string }) => (
  <div className="rounded border border-slate-800 bg-slate-900 px-2 py-2">
    <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    <div className={`mt-1 truncate font-mono text-sm font-bold ${accent}`} title={value}>
      {value}
    </div>
  </div>
);

const getCpkCellClass = (val: number | null) => {
  if (val === null || val === undefined || Number.isNaN(val)) return "text-slate-500 bg-slate-900/60";
  if (val < 1.0) return "bg-rose-950/80 text-rose-300 font-bold border border-rose-800/40";
  if (val < 1.33) return "bg-amber-950/60 text-amber-300 font-bold border border-amber-800/40";
  return "bg-emerald-950/40 text-emerald-400 font-semibold";
};

const summaryRows = [
  { label: "Mean", key: "average", decimals: 3 },
  { label: "MAX", key: "max", decimals: 3 },
  { label: "MIN", key: "min", decimals: 3 },
  { label: "Cp", key: "cp", decimals: 2 },
  { label: "Cpk", key: "cpk", decimals: 2, isCpk: true },
  { label: "LSL", key: "lsl", decimals: 3 },
  { label: "USL", key: "usl", decimals: 3 },
];


const RfHeatmap: React.FC<RfHeatmapProps> = ({
  indicators,
  pcbasnList,
  rfMappings,
  onSelectCell,
}) => {
  const { locale } = useLocale();
  const [selectedBand, setSelectedBand] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedModulation, setSelectedModulation] = useState<string>("All");
  const [selectedChain, setSelectedChain] = useState<string>("All");
  const [selectedFrequency, setSelectedFrequency] = useState<string>("All");
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [query, setQuery] = useState("");
  const [showValues, setShowValues] = useState<boolean>(true);
  const [sortByWorstCpk, setSortByWorstCpk] = useState<boolean>(false);

  const matrix = useMemo(() => {
    const columns: MatrixColumn[] = indicators
      .map((indicator) => {
        const parsed = parseRFIndicator(indicator.name, rfMappings);
        const values = indicator.values.filter((value) => Number.isFinite(value));
        const mean = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        const variance =
          values.length > 1
            ? values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1)
            : 0;
        return {
          indicator,
          parsed,
          mean,
          sigma: Math.sqrt(variance),
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
        };
      })
      .filter((column) => column.parsed.frequency !== null)
      .sort((a, b) => {
        const bandDiff =
          getBandSortIndex(getBandLabel(a.parsed.frequency, a.parsed.protocol)) -
          getBandSortIndex(getBandLabel(b.parsed.frequency, b.parsed.protocol));
        if (bandDiff !== 0) return bandDiff;
        if ((a.parsed.frequency || 0) !== (b.parsed.frequency || 0)) {
          return (a.parsed.frequency || 0) - (b.parsed.frequency || 0);
        }
        return compactTitle(a).localeCompare(compactTitle(b), undefined, { numeric: true });
      });

    const bands = Array.from(new Set(columns.map((column) => getBandLabel(column.parsed.frequency, column.parsed.protocol))))
      .sort((a, b) => {
        const orderDiff = getBandSortIndex(a) - getBandSortIndex(b);
        return orderDiff !== 0 ? orderDiff : a.localeCompare(b, undefined, { numeric: true });
      });

    const rows = pcbasnList.map((sn, rowIdx) => {
      let riskScore = 0;
      let warningCount = 0;
      let failCount = 0;
      columns.forEach((column) => {
        const cell = getCellTone(column.indicator.values[rowIdx] ?? null, column);
        riskScore += cell.score;
        if (cell.score >= 2) warningCount += 1;
        if (cell.score >= 4) failCount += 1;
      });
      return { sn, rowIdx, riskScore, warningCount, failCount };
    });

    const types = Array.from(new Set(columns.map((column) => RF_TYPE_LABELS[column.parsed.testType] || column.parsed.testType))).sort();
    const modulations = Array.from(new Set(columns.map((column) => column.parsed.rate).filter(Boolean))).sort((a, b) => {
      const aNum = Number(a);
      const bNum = Number(b);
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    const chains = Array.from(new Set(columns.map((column) => column.parsed.chain).filter(Boolean))).sort();
    const frequencies = Array.from(new Set(columns.map((column) => column.parsed.frequency).filter((value): value is number => value !== null))).sort((a, b) => a - b);

    return { columns, bands, rows, types, modulations, chains, frequencies };
  }, [indicators, pcbasnList, rfMappings]);

  const visibleColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = matrix.columns.filter((column) => {
      const band = getBandLabel(column.parsed.frequency, column.parsed.protocol);
      if (selectedBand !== "All" && band !== selectedBand) return false;
      const typeLabel = RF_TYPE_LABELS[column.parsed.testType] || column.parsed.testType;
      if (selectedType !== "All" && typeLabel !== selectedType) return false;
      if (selectedModulation !== "All" && column.parsed.rate !== selectedModulation) return false;
      if (selectedChain !== "All" && column.parsed.chain !== selectedChain) return false;
      if (selectedFrequency !== "All" && String(column.parsed.frequency) !== selectedFrequency) return false;
      if (!normalizedQuery) return true;
      return (
        column.indicator.name.toLowerCase().includes(normalizedQuery) ||
        column.parsed.displayName.toLowerCase().includes(normalizedQuery) ||
        compactTitle(column).toLowerCase().includes(normalizedQuery)
      );
    });

    if (sortByWorstCpk) {
      return [...filtered].sort((a, b) => {
        const cpkA = a.indicator.cpk !== null && a.indicator.cpk !== undefined && !Number.isNaN(a.indicator.cpk) ? a.indicator.cpk : 999;
        const cpkB = b.indicator.cpk !== null && b.indicator.cpk !== undefined && !Number.isNaN(b.indicator.cpk) ? b.indicator.cpk : 999;
        return cpkA - cpkB;
      });
    }
    return filtered;
  }, [matrix.columns, selectedBand, selectedType, selectedModulation, selectedChain, selectedFrequency, query, sortByWorstCpk]);

  const visibleRows = useMemo(() => {
    return matrix.rows
      .map((row) => {
        let riskScore = 0;
        let warningCount = 0;
        let failCount = 0;
        visibleColumns.forEach((column) => {
          const cell = getCellTone(column.indicator.values[row.rowIdx] ?? null, column);
          riskScore += cell.score;
          if (cell.score >= 2) warningCount += 1;
          if (cell.score >= 4) failCount += 1;
        });
        return { ...row, riskScore, warningCount, failCount };
      })
      .sort((a, b) => b.riskScore - a.riskScore || a.rowIdx - b.rowIdx);
  }, [matrix.rows, visibleColumns]);

  const riskRows = visibleRows.filter((row) => row.warningCount > 0 || row.failCount > 0).length;
  const displayRows = visibleRows.slice(0, 180);
  const displayColumns = visibleColumns.slice(0, 120);
  const selectedColumn = selectedCell ? matrix.columns.find((column) => column.indicator.name === selectedCell.indicatorName) : null;
  const selectedRow = selectedCell ? matrix.rows.find((row) => row.rowIdx === selectedCell.rowIdx) : null;
  const selectedTone = selectedColumn && selectedCell ? getCellTone(selectedColumn.indicator.values[selectedCell.rowIdx] ?? null, selectedColumn) : null;
  const topRiskRows = visibleRows.slice(0, 5);

  if (matrix.columns.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center space-y-4 rounded border border-slate-800 bg-slate-900/60 p-4 text-slate-500">
        <div className="rounded-full border border-slate-700/30 bg-slate-800/40 p-5">
          <Activity className="h-12 w-12 text-slate-600" />
        </div>
        <div className="max-w-xs space-y-1 text-center">
          <h3 className="text-sm font-bold text-slate-400">No RF Matrix Data</h3>
          <p className="text-xs leading-relaxed">The current sheet contains no RF indicators with recognizable frequencies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded border border-slate-800 bg-slate-950 shadow-inner">
      <div className="border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <RadioTower className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-100">
                {t("rfHeatmapTitle", locale)}
              </h2>
              <p className="truncate text-[11px] text-slate-500">
                {locale === "zh" ? "单板 SN × 测试项热力图，按行风险排序" : "SN x test item heatmap, sorted by row risk"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded border border-slate-700 bg-slate-950 p-0.5">
              {["All", ...matrix.bands].map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setSelectedBand(band)}
                  className={`h-8 px-3 text-xs font-bold transition-colors ${
                    selectedBand === band
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  }`}
                >
                  {band}
                </button>
              ))}
            </div>

            <SelectControl label="Type" value={selectedType} options={["All", ...matrix.types]} onChange={setSelectedType} />
            <SelectControl label="Mod" value={selectedModulation} options={["All", ...matrix.modulations]} onChange={setSelectedModulation} />
            <SelectControl label="CHA" value={selectedChain} options={["All", ...matrix.chains]} onChange={setSelectedChain} />
            <SelectControl
              label="Freq"
              value={selectedFrequency}
              options={["All", ...matrix.frequencies.map(String)]}
              onChange={setSelectedFrequency}
            />

            <button
              type="button"
              onClick={() => setShowValues(!showValues)}
              className={`flex h-9 items-center justify-center rounded-2xl border px-3 text-xs font-bold transition-colors ${
                showValues
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              {locale === "zh" ? "显示数值" : "Show Values"}
            </button>

            <button
              type="button"
              onClick={() => setSortByWorstCpk(!sortByWorstCpk)}
              className={`flex h-9 items-center justify-center rounded-2xl border px-3 text-xs font-bold transition-colors ${
                sortByWorstCpk
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200"
              }`}
              title={locale === "zh" ? "按最差 Cpk 排序测试列" : "Sort columns by worst Cpk first"}
            >
              {locale === "zh" ? "最差 Cpk 优先" : "Worst Cpk First"}
            </button>

            <label className="flex h-9 w-64 items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 text-slate-500">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter test items"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] uppercase text-slate-500">Devices</div>
            <div className="mt-1 text-lg font-bold text-slate-100">{pcbasnList.length}</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] uppercase text-slate-500">Visible Tests</div>
            <div className="mt-1 text-lg font-bold text-slate-100">{visibleColumns.length}</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase text-slate-500">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              Risk Rows
            </div>
            <div className="mt-1 text-lg font-bold text-amber-300">{riskRows}</div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase text-slate-500">
              <SlidersHorizontal className="h-3 w-3 text-cyan-300" />
              Color Rule
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1"><Circle className="h-2 w-2 fill-green-500 text-green-500" />Nominal</span>
              <span className="inline-flex items-center gap-1"><Circle className="h-2 w-2 fill-amber-400 text-amber-400" />Drift</span>
              <span className="inline-flex items-center gap-1"><Circle className="h-2 w-2 fill-rose-600 text-rose-600" />OOS</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
          <table className="min-w-full border-separate border-spacing-0 text-[10px]">
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-[0_1px_0_#1e293b]">
              <tr>
                <th className="sticky left-0 z-30 w-44 min-w-44 border-r border-slate-800 bg-slate-900 px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-400">
                  SN
                </th>
                <th className="sticky left-44 z-30 w-20 min-w-20 border-r border-slate-800 bg-slate-900 px-2 py-2 text-center text-[10px] font-bold uppercase text-slate-400">
                  {locale === "zh" ? "风险" : "Risk"}
                </th>
                {displayColumns.map((column) => (
                  <th
                    key={column.indicator.name}
                    className={`h-12 border-r border-slate-800 bg-slate-900 p-0 text-slate-300 ${
                      showValues ? "w-16 min-w-16" : "w-7 min-w-7"
                    }`}
                    title={`${fullTitle(column)}\n${column.indicator.name}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCell(column.parsed.frequency, `${column.parsed.protocol}_${column.parsed.testType}`)}
                      className="flex h-full w-full items-center justify-center hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                    >
                      <MoreHorizontal className={`text-slate-600/60 hover:text-cyan-400 transition-colors ${showValues ? "h-4 w-4" : "h-3 w-3"}`} />
                    </button>
                  </th>
                ))}
              </tr>

              {/* 7 Summary rows below the column headers */}
              {summaryRows.map((sRow) => (
                <tr key={sRow.label} className="h-6 bg-slate-900/95 text-[10px] border-b border-slate-800">
                  <td className="sticky left-0 z-30 w-44 min-w-44 border-r border-slate-800 bg-slate-900 px-3 py-1 font-bold text-slate-400 text-left uppercase">
                    {sRow.label}
                  </td>
                  <td className="sticky left-44 z-30 w-20 min-w-20 border-r border-slate-800 bg-slate-900 px-2 py-1 text-slate-500 text-center font-bold">
                    -
                  </td>
                  {displayColumns.map((column) => {
                    const indicator = column.indicator;
                    const val = indicator[sRow.key as keyof typeof indicator] as number | null;
                    const formatted = val === null || val === undefined || Number.isNaN(val)
                      ? "N/A"
                      : val.toFixed(sRow.decimals);
                    
                    const isCpkRow = sRow.isCpk;
                    const cpkClass = isCpkRow ? getCpkCellClass(val) : "text-slate-300";
                    const cellWidthClass = showValues ? "w-16 min-w-16" : "w-7 min-w-7";

                    return (
                      <td
                        key={`${sRow.label}-${column.indicator.name}`}
                        className={`border-r border-b border-slate-800 text-center font-mono py-0.5 px-0.5 truncate ${cellWidthClass} ${cpkClass}`}
                        title={`${fullTitle(column)}\n${sRow.label}: ${formatted}`}
                      >
                        {showValues ? formatted : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const hasFailure = row.failCount > 0;
                const hasWarning = row.failCount === 0 && row.warningCount > 0;
                const leftHighlightClass = hasFailure 
                  ? "bg-rose-950/40 text-rose-200 border-l-2 border-l-rose-500 px-2.5" 
                  : hasWarning 
                    ? "bg-amber-950/30 text-amber-200 border-l-2 border-l-amber-500 px-2.5" 
                    : "bg-slate-950 text-slate-300 px-3";
                
                const riskBgClass = hasFailure 
                  ? "bg-rose-950/40" 
                  : hasWarning 
                    ? "bg-amber-950/30" 
                    : "bg-slate-950";

                return (
                  <tr key={`${row.sn}-${row.rowIdx}`} className="group">
                    <td className={`sticky left-0 z-10 border-b border-r border-slate-800 font-mono text-[11px] group-hover:bg-slate-900 ${leftHighlightClass}`}>
                      <span className="block max-w-40 truncate" title={row.sn}>{row.sn}</span>
                    </td>
                    <td className={`sticky left-44 z-10 border-b border-r border-slate-800 text-center font-mono text-[11px] font-bold group-hover:bg-slate-900 ${riskBgClass}`}>
                      <span className={row.failCount > 0 ? "text-rose-400" : row.warningCount > 0 ? "text-amber-300" : "text-emerald-400"}>
                        {row.riskScore}
                      </span>
                    </td>
                    {displayColumns.map((column) => {
                      const cell = getCellTone(column.indicator.values[row.rowIdx] ?? null, column);
                      const isSelected = selectedCell?.rowIdx === row.rowIdx && selectedCell.indicatorName === column.indicator.name;
                      const cellWidthClass = showValues ? "w-16 min-w-16" : "w-7 min-w-7";
                      const cellHeightClass = showValues ? "h-8" : "h-6";
                      return (
                        <td
                          key={`${row.rowIdx}-${column.indicator.name}`}
                          className={`border-b border-r border-slate-900 p-0 text-center font-mono ${cellWidthClass} ${isSelected ? "ring-2 ring-cyan-300 ring-inset" : ""}`}
                          title={`${row.sn}\n${column.indicator.name}\nValue: ${cell.label || "N/A"}\nMean: ${column.mean.toFixed(3)}\nSigma: ${column.sigma.toFixed(4)}\nReason: ${cell.reason}`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCell({ rowIdx: row.rowIdx, indicatorName: column.indicator.name })}
                            className={`block w-full text-center transition-all ${cellHeightClass} ${showValues ? "px-1 py-1 text-[10px]" : "p-0 text-[0px]"}`}
                            style={{ backgroundColor: cell.color, color: cell.textColor }}
                          >
                            {showValues ? cell.label : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="hidden w-80 shrink-0 border-l border-slate-800 bg-slate-900/80 p-4 xl:block">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Diagnosis</h3>
              <p className="text-[11px] text-slate-500">Selected cell and top-risk devices</p>
            </div>
            <Target className="h-4 w-4 text-cyan-300" />
          </div>

          {selectedColumn && selectedRow && selectedTone ? (
            <div className="mt-4 space-y-3">
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <div className="truncate font-mono text-xs font-bold text-slate-100" title={selectedRow.sn}>{selectedRow.sn}</div>
                <div className="mt-1 truncate text-[11px] text-slate-500" title={selectedColumn.indicator.name}>
                  {fullTitle(selectedColumn)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Metric label="Value" value={selectedTone.label || "N/A"} accent="text-slate-100" />
                  <Metric label="Risk" value={String(selectedTone.score)} accent={selectedTone.score >= 3 ? "text-rose-300" : selectedTone.score >= 2 ? "text-amber-300" : "text-emerald-300"} />
                  <Metric label="Mean" value={selectedColumn.mean.toFixed(3)} accent="text-slate-300" />
                  <Metric label="Sigma" value={selectedColumn.sigma.toFixed(4)} accent="text-slate-300" />
                  <Metric label="Z Drift" value={`${selectedTone.sigmaScore.toFixed(2)}σ`} accent="text-slate-300" />
                  <Metric label="Spec Edge" value={selectedTone.edgeRatio === null ? "N/A" : `${Math.round(selectedTone.edgeRatio * 100)}%`} accent="text-slate-300" />
                </div>
                <div className="mt-3 rounded px-2 py-1.5 text-xs font-bold" style={{ backgroundColor: selectedTone.color, color: selectedTone.textColor }}>
                  {selectedTone.reason}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectCell(selectedColumn.parsed.frequency, `${selectedColumn.parsed.protocol}_${selectedColumn.parsed.testType}`)}
                  className="mt-3 h-8 w-full rounded border border-cyan-500/40 bg-cyan-500/10 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20"
                >
                  Open Related Charts
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-500">
              Click any colored measurement cell to inspect its specification margin, sigma drift, and related chart group.
            </div>
          )}

          <div className="mt-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Top Risk Devices</div>
            <div className="space-y-2">
              {topRiskRows.map((row) => (
                <button
                  key={`risk-${row.rowIdx}`}
                  type="button"
                  onClick={() => {
                    const firstRiskColumn = visibleColumns.find((column) => getCellTone(column.indicator.values[row.rowIdx] ?? null, column).score >= 2);
                    if (firstRiskColumn) setSelectedCell({ rowIdx: row.rowIdx, indicatorName: firstRiskColumn.indicator.name });
                  }}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-left hover:border-cyan-500/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-slate-300">{row.sn}</span>
                    <span className={row.failCount > 0 ? "text-xs font-bold text-rose-300" : "text-xs font-bold text-amber-300"}>{row.riskScore}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                    <div className="h-full rounded bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${Math.min(100, row.riskScore * 5)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {(visibleRows.length > displayRows.length || visibleColumns.length > displayColumns.length) && (
        <div className="border-t border-slate-800 bg-slate-900 px-4 py-2 text-[11px] text-slate-500">
          Showing {displayRows.length}/{visibleRows.length} rows and {displayColumns.length}/{visibleColumns.length} columns for performance.
        </div>
      )}
    </div>
  );
};

export default RfHeatmap;
