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
        triggerOn: "click",
        enterable: true,
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        borderColor: statusColor,
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        extraCssText: "box-sizing: border-box; height: 100%; display: flex; flex-direction: column; justify-content: flex-start; box-shadow: -8px 0 25px rgba(0,0,0,0.6); border-radius: 0 12px 12px 0; z-index: 999;",
        position: (_point: any, _params: any, dom: any, _rect: any, size: any) => {
          // 顶部、右侧、底部与统计图的顶边、右边、底边完美对齐 (占据右侧整块面板)
          return [size.viewSize[0] - dom.offsetWidth, 0];
        },
        formatter: (params: any[]) => {
          const bar = params.find((p) => p.seriesType === "bar");
          const line = params.find((p) => p.seriesType === "line");
          const bin = bins[bar?.dataIndex || 0];

          let html = `<div class="font-mono text-xs flex flex-col h-full select-text overflow-hidden">`;
          
          html += `<div class="font-bold border-b border-slate-700 pb-1.5 mb-1.5 flex justify-between items-center flex-shrink-0">`;
          html += `<span>组距中心: ${bar?.name || ""}</span>`;
          html += `<span style="color: ${statusColor}; font-size: 10px; border: 1px solid ${statusColor}; padding: 0 4px; border-radius: 4px;">${status}</span>`;
          html += `</div>`;

          html += `<div class="flex-shrink-0 space-y-1 mb-1.5">`;
          if (bar) html += `<div>实际频数: <span class="text-blue-400 font-bold">${bar.value}</span> 片</div>`;
          if (line) html += `<div>正态拟合: <span class="text-rose-400 font-bold">${line.value}</span></div>`;
          html += `</div>`;

          if (actionTrigger) {
            html += `<div class="flex-shrink-0 my-1 pt-1 border-t border-slate-700 text-[10px] text-amber-300 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 whitespace-normal">`;
            html += `💡 ${actionTrigger}`;
            html += `</div>`;
          }

          if (bin?.pcbaItems && bin.pcbaItems.length > 0) {
            html += `<div class="flex-1 overflow-y-auto mt-1.5 pt-1.5 border-t border-slate-700 text-[10px] text-slate-400 pr-1 pointer-events-auto select-text">`;
            html += `<div class="text-slate-300 font-bold mb-1 flex justify-between items-center px-1 sticky top-0 bg-slate-800/95 py-0.5 border-b border-slate-700/50 backdrop-blur"><span>单板列表 (${bin.pcbaItems.length}):</span><span>测量值</span></div>`;
            bin.pcbaItems.forEach((item) => {
              html += `<div class="flex justify-between items-center py-0.5 border-b border-slate-800/40 hover:bg-slate-700/40 px-1 rounded transition-colors">`;
              html += `<span class="font-mono text-slate-300">${item.asn}</span>`;
              html += `<span class="font-mono font-bold text-blue-300">${item.val.toFixed(4)}</span>`;
              html += `</div>`;
            });
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
