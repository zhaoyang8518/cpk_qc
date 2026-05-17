import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { IndicatorSummary } from "../types";
import { calculateSpc } from "../utils/spc";

interface CpkChartProps {
  indicator: IndicatorSummary;
  pcbasnList: string[];
  selectedAsn: string | null;
  chartTheme?: string;
  lineWidth?: number;
}

const CpkChart: React.FC<CpkChartProps> = ({
  indicator,
  pcbasnList,
  selectedAsn,
  chartTheme = "#5470c6",
  lineWidth = 2.5,
}) => {
  const spcRes = useMemo(() => {
    return calculateSpc(indicator, pcbasnList);
  }, [indicator, pcbasnList]);

  const option = useMemo(() => {
    const { categories, barData, lineData, usl, lsl, bins, status, statusColor, actionTrigger } = spcRes;

    let highlightBinIdx = -1;
    if (selectedAsn) {
      highlightBinIdx = bins.findIndex((bin) => bin.pcbasnList.includes(selectedAsn));
    }

    const seriesBarData = barData.map((val, idx) => {
      const isHighlighted = idx === highlightBinIdx;
      return {
        value: val,
        itemStyle: {
          color: isHighlighted ? "#f59e0b" : chartTheme,
          borderColor: isHighlighted ? "#fbbf24" : chartTheme,
          borderWidth: isHighlighted ? 2 : 1,
          shadowBlur: isHighlighted ? 12 : 0,
          shadowColor: "#f59e0b",
          opacity: isHighlighted ? 1 : 0.85,
        },
        label: {
          show: isHighlighted || val > 0,
          position: "top",
          formatter: isHighlighted ? `{bg|单板所在}\n{c}` : "{c}",
          rich: {
            bg: {
              backgroundColor: "#f59e0b",
              color: "#fff",
              padding: [2, 4],
              borderRadius: 4,
              fontSize: 10,
              fontWeight: "bold",
            },
          },
        },
      };
    });

    const markLineData: any[] = [];
    if (usl !== null && usl !== undefined) {
      markLineData.push({
        xAxis: usl.toFixed(2),
        lineStyle: { color: "#ef4444", type: "dashed", width: 1.5 },
        label: { formatter: `USL: ${usl}`, position: "insideEndTop", color: "#ef4444", fontSize: 10 },
      });
    }
    if (lsl !== null && lsl !== undefined) {
      markLineData.push({
        xAxis: lsl.toFixed(2),
        lineStyle: { color: "#ef4444", type: "dashed", width: 1.5 },
        label: { formatter: `LSL: ${lsl}`, position: "insideStartTop", color: "#ef4444", fontSize: 10 },
      });
    }

    return {
      grid: {
        top: 35,
        bottom: 25,
        left: 35,
        right: 25,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        borderColor: statusColor,
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        formatter: (params: any[]) => {
          const bar = params.find((p) => p.seriesType === "bar");
          const line = params.find((p) => p.seriesType === "line");
          const bin = bins[bar?.dataIndex || 0];

          let html = `<div class="font-mono text-xs space-y-1">`;
          html += `<div class="font-bold border-b border-slate-700 pb-1 flex justify-between items-center">`;
          html += `<span>组距中心: ${bar?.name || ""}</span>`;
          html += `<span style="color: ${statusColor}; font-size: 10px; border: 1px solid ${statusColor}; padding: 0 4px; border-radius: 4px;">${status}</span>`;
          html += `</div>`;
          if (bar) html += `<div>实际频数: <span class="text-blue-400 font-bold">${bar.value}</span> 片</div>`;
          if (line) html += `<div>正态拟合: <span class="text-rose-400 font-bold">${line.value}</span></div>`;

          if (actionTrigger) {
            html += `<div class="mt-1 pt-1 border-t border-slate-700 text-[10px] text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 whitespace-normal">`;
            html += `💡 ${actionTrigger}`;
            html += `</div>`;
          }

          if (bin?.pcbasnList.length > 0) {
            html += `<div class="mt-1 pt-1 border-t border-slate-700 text-[10px] text-slate-400 max-h-20 overflow-y-auto">`;
            html += `单板列表 (${bin.pcbasnList.length}):<br/>` + bin.pcbasnList.slice(0, 5).join("<br/>");
            if (bin.pcbasnList.length > 5) html += `<br/>...等`;
            html += `</div>`;
          }
          html += `</div>`;
          return html;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#94a3b8", fontSize: 10, rotate: categories.length > 10 ? 30 : 0 },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(100, 116, 139, 0.15)" } },
        axisLine: { show: true, lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
      series: [
        {
          name: "实际频数",
          type: "bar",
          barCategoryGap: "2%",
          data: seriesBarData,
          animationDuration: 800,
        },
        {
          name: "正态拟合曲线",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#ee6666", width: lineWidth, shadowColor: "rgba(238, 102, 102, 0.3)", shadowBlur: 8 },
          data: lineData,
          markLine: markLineData.length > 0 ? { symbol: "none", data: markLineData } : undefined,
          animationDuration: 1000,
        },
      ],
    };
  }, [spcRes, selectedAsn, chartTheme, lineWidth]);

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} notMerge={true} lazyUpdate={true} />;
};

export default CpkChart;
