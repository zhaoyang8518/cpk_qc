import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { IndicatorSummary } from "../types";
import { parseRFIndicator, RfMappingConfig } from "../utils/rfParser";
import { t, useLocale } from "../i18n";

interface RfHeatmapProps {
  indicators: IndicatorSummary[];
  pcbasnList: string[];
  rfMappings: RfMappingConfig;
  onSelectCell: (freq: number | null, deviceVal: string | null) => void;
}

const getCpkHexColor = (cpk: number | null) => {
  if (cpk === null || cpk === undefined) return "#64748b";
  if (cpk >= 2.0) return "#06b6d4";
  if (cpk >= 1.33) return "#10b981";
  if (cpk >= 1.0) return "#eab308";
  return "#f43f5e";
};

const RfHeatmap: React.FC<RfHeatmapProps> = ({
  indicators,
  rfMappings,
  onSelectCell,
}) => {
  const { locale } = useLocale();

  // 1. Group indicators by Frequency and Parameter Category
  const groupedData = useMemo(() => {
    const freqs = new Set<number>();
    const types = new Set<string>();
    
    // Map of key `${freq}_${type}` -> list of indicators
    const map: Record<string, { name: string; cpk: number | null }[]> = {};

    indicators.forEach((ind) => {
      const parsed = parseRFIndicator(ind.name, rfMappings);
      if (parsed.frequency && parsed.testType) {
        freqs.add(parsed.frequency);
        types.add(parsed.testType);
        
        const key = `${parsed.frequency}_${parsed.testType}`;
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push({
          name: ind.name,
          cpk: ind.cpk,
        });
      }
    });

    const frequencies = Array.from(freqs).sort((a, b) => a - b);
    const testTypes = Array.from(types).sort();

    return {
      frequencies,
      testTypes,
      map,
    };
  }, [indicators, rfMappings]);

  // 2. Prepare ECharts Option
  const option = useMemo(() => {
    const { frequencies, testTypes, map } = groupedData;

    // ECharts series data: [x_index, y_index, worst_cpk, count, details]
    const data: any[] = [];

    frequencies.forEach((freq, xIdx) => {
      testTypes.forEach((type, yIdx) => {
        const key = `${freq}_${type}`;
        const items = map[key] || [];
        if (items.length > 0) {
          // Calculate Worst CPK (the minimum CPK in this frequency/type category)
          const validCpkValues = items
            .map((item) => item.cpk)
            .filter((val): val is number => val !== null && val !== undefined);
          
          const worstCpk = validCpkValues.length > 0 ? Math.min(...validCpkValues) : 0;
          data.push([xIdx, yIdx, worstCpk, items.length, items]);
        }
      });
    });

    const typeMap: Record<string, string> = {
      PWR: "TX Power (功率)",
      EVM: "EVM (误差矢量幅度)",
      FRQ: "Freq Error (频率偏差)",
      MSK: "Spectrum Mask (频谱模版)",
      PER: "PER (误包率)",
      RSI: "RSSI (接收强度)",
      OTHER: "Test Item (其他测试项)",
    };

    return {
      title: {
        text: t("rfHeatmapTitle", locale) || "射频制程能力一致性热力图 (最差 CPK)",
        left: "center",
        top: 5,
        textStyle: { color: "#f1f5f9", fontSize: 13, fontWeight: "bold" },
      },
      tooltip: {
        position: "top",
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        borderColor: "#475569",
        borderWidth: 1,
        textStyle: { color: "#f8fafc" },
        extraCssText: "box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); border-radius: 8px; pointer-events: auto;",
        formatter: (params: any) => {
          const val = params.data;
          if (!val) return "";
          const xIdx = val[0];
          const yIdx = val[1];
          const worstCpk = val[2];
          const count = val[3];
          const details = val[4] as { name: string; cpk: number | null }[];

          const freqName = frequencies[xIdx];
          const typeName = testTypes[yIdx];
          const readableType = typeMap[typeName] || typeName;

          let html = `<div class="font-mono text-xs p-2 max-w-sm">`;
          html += `<div class="font-bold border-b border-slate-700 pb-1.5 mb-1.5 text-slate-100 flex justify-between items-center">`;
          html += `<span>${readableType}</span>`;
          html += `<span class="text-blue-400 font-bold">${freqName} MHz</span>`;
          html += `</div>`;

          html += `<div class="mb-2 text-slate-300">`;
          html += `最差 CPK: <span class="font-bold" style="color: ${getCpkHexColor(worstCpk)}">${worstCpk.toFixed(2)}</span>`;
          html += `<span class="text-slate-500 text-[10px] ml-2">(${count} 个测试项)</span>`;
          html += `</div>`;

          html += `<div class="space-y-1 max-h-40 overflow-y-auto pr-1">`;
          details.forEach((d) => {
            const parsed = parseRFIndicator(d.name, rfMappings);
            html += `<div class="flex justify-between items-center text-[10px] py-0.5 border-b border-slate-800/40 text-slate-300">`;
            html += `<span class="truncate mr-4 text-slate-400" title="${d.name}">${parsed.displayName}</span>`;
            html += `<span class="font-bold font-mono" style="color: ${getCpkHexColor(d.cpk)}">${d.cpk !== null ? d.cpk.toFixed(2) : "N/A"}</span>`;
            html += `</div>`;
          });
          html += `</div>`;

          html += `<div class="text-[9px] text-slate-500 mt-2 border-t border-slate-800 pt-1 text-center font-bold">`;
          html += `💡 ${t("heatmapTooltipDesc", locale) || "点击单元格以下钻过滤对应图表"}`;
          html += `</div>`;
          html += `</div>`;

          return html;
        },
      },
      grid: {
        top: 60,
        bottom: 75,
        left: 100,
        right: 40,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: frequencies.map((f) => `${f} MHz`),
        splitArea: { show: true },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
        axisLine: { lineStyle: { color: "#475569" } },
      },
      yAxis: {
        type: "category",
        data: testTypes.map((t) => typeMap[t] || t),
        splitArea: { show: true },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
        axisLine: { lineStyle: { color: "#475569" } },
      },
      visualMap: {
        min: 0,
        max: 3,
        splitNumber: 4,
        type: "piecewise",
        orient: "horizontal",
        left: "center",
        bottom: 15,
        textStyle: { color: "#94a3b8", fontSize: 10, fontFamily: "monospace" },
        pieces: [
          { min: 2.0, label: "CPK ≥ 2.00 (世界级水平 / Cyan)", color: "#06b6d4" },
          { min: 1.33, max: 2.0, label: "1.33 ≤ CPK < 2.00 (制程良好 / Green)", color: "#10b981" },
          { min: 1.0, max: 1.33, label: "1.00 ≤ CPK < 1.33 (公差边缘 / Yellow)", color: "#eab308" },
          { max: 1.0, label: "CPK < 1.00 (超差不合格 / Red)", color: "#f43f5e" },
        ],
      },
      series: [
        {
          name: "Worst CPK",
          type: "heatmap",
          data: data,
          label: {
            show: true,
            color: "#fff",
            fontSize: 10,
            fontWeight: "bold",
            formatter: (p: any) => {
              const val = p.data[2];
              return val ? val.toFixed(2) : "";
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };
  }, [groupedData, rfMappings, locale]);

  // Click handler
  const onChartClick = (params: any) => {
    if (params.seriesType === "heatmap") {
      const dataVal = params.data;
      if (!dataVal) return;
      const xIdx = dataVal[0];
      const yIdx = dataVal[1];
      const freq = groupedData.frequencies[xIdx];
      const type = groupedData.testTypes[yIdx];
      
      const key = `${freq}_${type}`;
      const items = groupedData.map[key] || [];
      const hasBle = items.some(item => {
        const parsed = parseRFIndicator(item.name, rfMappings);
        return parsed.protocol === "BLE";
      });
      
      const deviceVal = hasBle ? "BLE" : `Wi-Fi_${type}`;
      onSelectCell(freq, deviceVal);
    }
  };

  return (
    <div className="w-full h-full bg-slate-900/60 p-4 border border-slate-800 rounded-2xl relative shadow-inner flex flex-col justify-between">
      <div className="flex-1 min-h-[360px]">
        <ReactECharts
          option={option}
          onEvents={{
            click: onChartClick,
          }}
          style={{ height: "100%", width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};

export default RfHeatmap;
