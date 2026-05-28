import React, { useMemo } from "react";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import { IndicatorSummary } from "../types";
import { calculateSpc, HistogramBinPrecision } from "../utils/spc";
import { t, useLocale } from "../i18n";

interface CpkChartProps {
  indicator: IndicatorSummary;
  pcbasnList: string[];
  selectedAsn: string | null;
  chartTheme?: string;
  lineWidth?: number;
  binPrecision?: HistogramBinPrecision;
}

const CpkChart: React.FC<CpkChartProps> = ({
  indicator,
  pcbasnList,
  selectedAsn,
  chartTheme = "#5470c6",
  lineWidth = 2.5,
  binPrecision,
}) => {
  const { locale } = useLocale();
  const spcRes = useMemo(() => {
    return calculateSpc(indicator, pcbasnList, locale, { binPrecision });
  }, [indicator, pcbasnList, locale, binPrecision]);

  const option = useMemo(() => {
    const { normalCurve, usl, lsl, bins, status, statusColor } = spcRes;

    let highlightBinIdx = -1;
    if (selectedAsn) {
      highlightBinIdx = bins.findIndex((bin) => bin.pcbasnList.includes(selectedAsn));
    }

    const seriesBarData = bins.map((bin, idx) => {
      const isHighlighted = idx === highlightBinIdx;
      return {
        value: [bin.binMin, bin.binMax, bin.count, idx, isHighlighted ? 1 : 0],
        itemStyle: {
          color: isHighlighted ? "#f59e0b" : chartTheme,
          borderColor: isHighlighted ? "#fbbf24" : chartTheme,
          borderWidth: isHighlighted ? 2 : 1,
          shadowBlur: isHighlighted ? 12 : 0,
          shadowColor: "#f59e0b",
          opacity: isHighlighted ? 1 : 0.85,
        },
      };
    });

    const markLineData: any[] = [];
    if (usl !== null && usl !== undefined) {
      markLineData.push({
        xAxis: usl,
        lineStyle: { color: "#fca5a5", type: "dashed", width: 2.5, opacity: 0.95 },
        label: { formatter: `USL: ${usl}`, position: "insideEndTop", color: "#fca5a5", fontSize: 10 },
      });
    }
    if (lsl !== null && lsl !== undefined) {
      markLineData.push({
        xAxis: lsl,
        lineStyle: { color: "#fca5a5", type: "dashed", width: 2.5, opacity: 0.95 },
        label: { formatter: `LSL: ${lsl}`, position: "insideStartTop", color: "#fca5a5", fontSize: 10 },
      });
    }

    const binMin = bins.length > 0 ? bins[0].binMin : undefined;
    const binMax = bins.length > 0 ? bins[bins.length - 1].binMax : undefined;
    const specValues = [lsl, usl].filter((value): value is number => value !== null && value !== undefined);
    const axisMinValue = Math.min(...[binMin, ...specValues].filter((value): value is number => value !== undefined));
    const axisMaxValue = Math.max(...[binMax, ...specValues].filter((value): value is number => value !== undefined));
    const axisPadding = Number.isFinite(axisMaxValue - axisMinValue) ? Math.max((axisMaxValue - axisMinValue) * 0.04, 1e-9) : 0;
    const xMin = Number.isFinite(axisMinValue) ? axisMinValue - axisPadding : undefined;
    const xMax = Number.isFinite(axisMaxValue) ? axisMaxValue + axisPadding : undefined;

    return {
      grid: {
        top: 35,
        bottom: 25,
        left: 35,
        right: 25,
        containLabel: true,
      },
      tooltip: {
        trigger: "item",
        triggerOn: "click",
        enterable: true,
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        borderColor: statusColor,
        borderWidth: 1,
        textStyle: { color: "#f8fafc", fontSize: 12 },
        extraCssText: "box-sizing: border-box; height: 100%; display: flex; flex-direction: column; justify-content: flex-start; box-shadow: -8px 0 25px rgba(0,0,0,0.6); border-radius: 0 12px 12px 0; z-index: 999;",
        position: (_point: any, _params: any, dom: any, _rect: any, size: any) => {
          // 顶部、右侧、底部与统计图的顶边、右边、底边完美对齐 (占据右侧整块面板)
          return [size.viewSize[0] - dom.offsetWidth, 0];
        },
        formatter: (params: any) => {
          const bar = Array.isArray(params) ? params.find((p) => p.seriesType === "custom") : params;
          const bin = bins[bar?.value?.[3] ?? bar?.dataIndex ?? 0];
          const barCount = Array.isArray(bar?.value) ? bar.value[2] : bar?.value;
          const lineValue = bin?.normalCount;

          let html = `<div class="font-mono text-xs flex flex-col h-full select-text overflow-hidden">`;
          
          html += `<div class="font-bold border-b border-slate-700 pb-1.5 mb-1.5 flex justify-between items-center flex-shrink-0">`;
          html += `<span>${t("binCenter", locale)}: ${bin?.label || ""}</span>`;
          html += `<span style="color: ${statusColor}; font-size: 10px; border: 1px solid ${statusColor}; padding: 0 4px; border-radius: 4px;">${status}</span>`;
          html += `</div>`;

          html += `<div class="flex-shrink-0 space-y-1 mb-1.5">`;
          if (bar) html += `<div>${t("actualCount", locale)}: <span class="text-blue-400 font-bold">${barCount}</span></div>`;
          if (lineValue !== undefined && lineValue !== null) html += `<div>${t("normalFit", locale)}: <span class="text-rose-400 font-bold">${lineValue}</span></div>`;
          html += `</div>`;

          if (bin?.pcbaItems && bin.pcbaItems.length > 0) {
            html += `<div class="flex-1 overflow-y-auto mt-1.5 pt-1.5 border-t border-slate-700 text-[10px] text-slate-400 pr-1 pointer-events-auto select-text">`;
            html += `<div class="text-slate-300 font-bold mb-1 flex justify-between items-center px-1 sticky top-0 bg-slate-800/95 py-0.5 border-b border-slate-700/50 backdrop-blur"><span>${t("pcbaListTitle", locale)} (${bin.pcbaItems.length}):</span><span>${t("measuredVal", locale)}</span></div>`;
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
        type: "value",
        min: xMin,
        max: xMax,
        axisLine: { lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#94a3b8", fontSize: 10, formatter: (value: number) => value.toFixed(2) },
        axisTick: { alignWithLabel: false },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(100, 116, 139, 0.15)" } },
        axisLine: { show: true, lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#94a3b8", fontSize: 10 },
      },
      series: [
        {
          name: t("actualFreqSeries", locale),
          type: "custom",
          renderItem: (params: any, api: any) => {
            const binMin = api.value(0);
            const binMax = api.value(1);
            const count = api.value(2);
            const isHighlighted = api.value(4) === 1;
            const start = api.coord([binMin, 0]);
            const end = api.coord([binMax, count]);
            const zero = api.coord([binMax, 0]);
            const width = Math.max(1, zero[0] - start[0] - 1);
            const height = Math.max(0, zero[1] - end[1]);
            const hitShape = echarts.graphic.clipRectByRect(
              {
                x: start[0],
                y: params.coordSys.y,
                width: Math.max(1, zero[0] - start[0]),
                height: params.coordSys.height,
              },
              {
                x: params.coordSys.x,
                y: params.coordSys.y,
                width: params.coordSys.width,
                height: params.coordSys.height,
              }
            );
            const rectShape = echarts.graphic.clipRectByRect(
              {
                x: start[0] + 0.5,
                y: end[1],
                width,
                height,
              },
              {
                x: params.coordSys.x,
                y: params.coordSys.y,
                width: params.coordSys.width,
                height: params.coordSys.height,
              }
            );

            if (!rectShape) return null;

            const children: any[] = [
              ...(hitShape
                ? [
                    {
                      type: "rect",
                      shape: hitShape,
                      style: {
                        fill: "rgba(0, 0, 0, 0)",
                      },
                      cursor: "pointer",
                    },
                  ]
                : []),
              {
                type: "rect",
                shape: rectShape,
                style: {
                  fill: isHighlighted ? "#f59e0b" : chartTheme,
                  stroke: isHighlighted ? "#fbbf24" : chartTheme,
                  lineWidth: isHighlighted ? 2 : 1,
                  opacity: isHighlighted ? 1 : 0.85,
                  shadowBlur: isHighlighted ? 12 : 0,
                  shadowColor: "#f59e0b",
                },
              },
            ];

            if (count > 0 && rectShape.width > 8) {
              children.push({
                type: "text",
                style: {
                  text: isHighlighted ? `${t("pcbaLoc", locale)}\n${count}` : String(count),
                  x: rectShape.x + rectShape.width / 2,
                  y: rectShape.y - 4,
                  fill: isHighlighted ? "#fbbf24" : "#cbd5e1",
                  fontSize: 10,
                  fontWeight: isHighlighted ? "bold" : "normal",
                  align: "center",
                  verticalAlign: "bottom",
                },
              });
            }

            return {
              type: "group",
              children,
            };
          },
          data: seriesBarData,
          animationDuration: 800,
          z: 3,
        },
        {
          name: t("normalCurveSeries", locale),
          type: "line",
          smooth: true,
          silent: true, // 使曲线不阻挡鼠标悬浮和点击事件，点击能够直达下方的柱子
          symbol: "none",
          lineStyle: { color: "#ee6666", width: lineWidth, shadowColor: "rgba(238, 102, 102, 0.3)", shadowBlur: 8 },
          data: normalCurve.map((point) => [point.x, parseFloat(point.y.toFixed(2))]),
          markLine: markLineData.length > 0 ? { symbol: "none", data: markLineData, silent: true } : undefined,
          animationDuration: 1000,
          tooltip: { show: false },
          z: 2,
        },
      ],
    };
  }, [spcRes, selectedAsn, chartTheme, lineWidth, locale]);

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} notMerge={true} lazyUpdate={true} />;
};

export default CpkChart;
