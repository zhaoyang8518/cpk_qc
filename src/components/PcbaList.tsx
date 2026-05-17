import React, { useState, useRef, useMemo, useEffect } from "react";
import { Search, Cpu, ListFilter } from "lucide-react";

interface PcbaListProps {
  pcbasnList: string[];
  selectedAsn: string | null;
  onSelectAsn: (asn: string | null) => void;
}

const ITEM_HEIGHT = 36; // 固定行高 36px
const BUFFER_ITEMS = 10; // 前后缓冲渲染数量

const PcbaList: React.FC<PcbaListProps> = ({ pcbasnList, selectedAsn, onSelectAsn }) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [scrollTop, setScrollTop] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 模糊搜索过滤
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return pcbasnList;
    const q = searchQuery.toLowerCase();
    return pcbasnList.filter((asn) => asn.toLowerCase().includes(q));
  }, [pcbasnList, searchQuery]);

  // 重置滚动位置当列表重载或搜索变化时
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [filteredList]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // 虚拟滚动参数计算
  const totalHeight = filteredList.length * ITEM_HEIGHT;
  const containerHeight = containerRef.current?.clientHeight || 600; // 默认可视高度 600px

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
  const endIndex = Math.min(
    filteredList.length - 1,
    Math.floor((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_ITEMS
  );

  const visibleItems = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (filteredList[i]) {
        items.push({
          index: i,
          asn: filteredList[i],
          top: i * ITEM_HEIGHT,
        });
      }
    }
    return items;
  }, [filteredList, startIndex, endIndex]);

  return (
    <aside className="w-68 bg-slate-800/40 border-r border-slate-700/50 flex flex-col h-full overflow-hidden select-none">
      {/* Sidebar Header & Search */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-slate-200">
            <Cpu className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold tracking-wide">PCBASN 单板列表</h2>
          </div>
          {selectedAsn && (
            <button
              onClick={() => onSelectAsn(null)}
              className="text-[10px] text-blue-400 hover:text-blue-300 underline font-mono"
            >
              清除高亮
            </button>
          )}
        </div>

        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input
            type="text"
            placeholder="搜索单板条码 (如 R.DXX...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-900/60 border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-500 text-slate-200 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-xs text-slate-500 hover:text-slate-300 font-bold"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-400 px-1 font-mono">
          <div className="flex items-center space-x-1">
            <ListFilter className="w-3.5 h-3.5" />
            <span>过滤: {filteredList.length}</span>
          </div>
          <span>总计: {pcbasnList.length}</span>
        </div>
      </div>

      {/* Virtual Scroll List Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {filteredList.length > 0 ? (
          <div style={{ height: `${totalHeight}px` }} className="w-full relative">
            {visibleItems.map(({ index, asn, top }) => {
              const isSelected = selectedAsn === asn;
              return (
                <div
                  key={asn}
                  style={{ top: `${top}px`, height: `${ITEM_HEIGHT}px` }}
                  onClick={() => onSelectAsn(isSelected ? null : asn)}
                  className={`absolute w-full px-4 flex items-center justify-between text-xs font-mono cursor-pointer transition-all border-b border-slate-800/40 group ${
                    isSelected
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-inner font-bold"
                      : "text-slate-300 hover:bg-slate-700/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-blue-400 animate-pulse" : "bg-slate-600 group-hover:bg-slate-400"
                      }`}
                    />
                    <span className="truncate" title={asn}>
                      {asn}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isSelected ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500 group-hover:text-slate-300"
                    }`}
                  >
                    #{((index as number) + 1).toString().padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 p-6 text-center">
            <Cpu className="w-8 h-8 opacity-20" />
            <span className="text-xs">未找到匹配的单板记录</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default PcbaList;
