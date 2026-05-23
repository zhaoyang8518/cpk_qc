import React, { useState, useRef, useMemo, useEffect } from "react";
import { Search, BarChart2, ListFilter } from "lucide-react";
import { CpkStatus, IndicatorSummary } from "../types";
import { t, useLocale } from "../i18n";
import { parseRFIndicator, RfMappingConfig } from "../utils/rfParser";
import { CpkLevelTag } from "./CpkLevelTag";

interface PcbaListProps {
  indicators: IndicatorSummary[];
  visibleIndicators: { indicator: IndicatorSummary; index: number }[];
  selectedIndicatorIdx: number | null;
  onSelectIndicator: (idx: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  enabledStatuses: Set<CpkStatus>;
  statusCounts: Record<CpkStatus, number>;
  onToggleStatus: (status: CpkStatus) => void;
  width?: number;
  rfMappings: RfMappingConfig;
}

const ITEM_HEIGHT = 48; // 固定行高，支持两行文本展示
const BUFFER_ITEMS = 10; // 前后缓冲渲染数量

const formatCpk = (cpk: number | null) => (cpk === null || cpk === undefined ? "N/A" : cpk.toFixed(2));

const PcbaList: React.FC<PcbaListProps> = ({
  indicators,
  visibleIndicators,
  selectedIndicatorIdx,
  onSelectIndicator,
  searchQuery,
  onSearchChange,
  enabledStatuses,
  statusCounts,
  onToggleStatus,
  width,
  rfMappings,
}) => {
  const { locale } = useLocale();
  const [scrollTop, setScrollTop] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 重置滚动位置当列表重载或搜索变化时
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [visibleIndicators]);

  // 监听外部反向选中检测项变化，实现左侧虚拟列表平滑滚动并垂直居中对齐
  useEffect(() => {
    if (selectedIndicatorIdx !== null && containerRef.current) {
      const visibleIdx = visibleIndicators.findIndex((v) => v.index === selectedIndicatorIdx);
      if (visibleIdx !== -1) {
        const targetTop = visibleIdx * ITEM_HEIGHT;
        const containerHalf = containerRef.current.clientHeight / 2;
        containerRef.current.scrollTo({
          top: Math.max(0, targetTop - containerHalf + ITEM_HEIGHT / 2),
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndicatorIdx, visibleIndicators]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // 虚拟滚动参数计算
  const totalHeight = visibleIndicators.length * ITEM_HEIGHT;
  const containerHeight = containerRef.current?.clientHeight || 600; // 默认可视高度 600px

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
  const endIndex = Math.min(
    visibleIndicators.length - 1,
    Math.floor((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_ITEMS
  );

  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (visibleIndicators[i]) {
        items.push({
          item: visibleIndicators[i],
          top: i * ITEM_HEIGHT,
        });
      }
    }
    return items;
  }, [visibleIndicators, startIndex, endIndex]);

  return (
    <aside
      style={{ width: width ? `${width}px` : "272px" }}
      className="bg-slate-800/40 flex flex-col h-full overflow-hidden select-none shrink-0"
    >
      {/* Sidebar Header & Search */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-slate-200">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold tracking-wide">{t("indicatorList", locale)}</h2>
          </div>
        </div>

        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input
            type="text"
            placeholder={t("searchPlaceholder", locale)}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-900/60 border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-500 text-slate-200 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 text-xs text-slate-500 hover:text-slate-300 font-bold"
            >
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1 mt-3">
          {[
            {
              status: "red" as const,
              title: `CPK < 1.00 (${t("fail", locale)})`,
            },
            {
              status: "yellow" as const,
              title: `1.00 ≤ CPK < 1.33 (${t("passable", locale)})`,
            },
            {
              status: "green" as const,
              title: `1.33 ≤ CPK < 2.00 (${t("good", locale)})`,
            },
            {
              status: "cyan" as const,
              title: `CPK ≥ 2.00 (${t("worldClass", locale)})`,
            },
          ].map((option) => {
            const isEnabled = enabledStatuses.has(option.status);
            return (
              <CpkLevelTag
                key={option.status}
                status={option.status}
                active={isEnabled}
                variant="count"
                onClick={() => onToggleStatus(option.status)}
                title={option.title}
                className="truncate"
              >
                {statusCounts[option.status]}
              </CpkLevelTag>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-400 px-1 font-mono">
          <div className="flex items-center space-x-1">
            <ListFilter className="w-3.5 h-3.5" />
            <span>{t("filterFiltered", locale)}: {visibleIndicators.length}</span>
          </div>
          <span>{t("filterTotal", locale)}: {indicators.length}</span>
        </div>
      </div>

      {/* Virtual Scroll List Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {visibleIndicators.length > 0 ? (
          <div style={{ height: `${totalHeight}px` }} className="w-full relative">
            {visibleItems.map(({ item, top }) => {
              const { indicator, index } = item;
              const isSelected = selectedIndicatorIdx === index;
              const parsed = parseRFIndicator(indicator.name, rfMappings);
              
              return (
                <div
                  key={`${index}-${indicator.name}`}
                  style={{ top: `${top}px`, height: `${ITEM_HEIGHT}px` }}
                  onClick={() => onSelectIndicator(index)}
                  className={`absolute w-full px-4 flex items-center justify-between text-xs font-mono cursor-pointer transition-all border-b border-slate-800/40 group ${isSelected
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-inner font-bold"
                      : "text-slate-300 hover:bg-slate-700/40 hover:text-white"
                    }`}
                >
                  <div className="flex items-center space-x-2 truncate mr-2 max-w-[70%]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-blue-400 animate-pulse" : "bg-slate-600 group-hover:bg-slate-400"
                        }`}
                    />
                    <div className="flex flex-col truncate leading-tight py-1">
                      <span className="truncate" title={parsed.displayName}>
                        {parsed.displayName}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono truncate" title={indicator.name}>
                        {indicator.name}
                      </span>
                    </div>
                  </div>
                  <CpkLevelTag cpk={indicator.cpk} selected={isSelected}>
                    CPK {formatCpk(indicator.cpk)}
                  </CpkLevelTag>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 p-6 text-center">
            <BarChart2 className="w-8 h-8 opacity-20" />
            <span className="text-xs">{t("noMatchingIndicators", locale)}</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default PcbaList;
