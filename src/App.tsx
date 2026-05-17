import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { SheetData } from "./types";
import Header from "./components/Header";
import SheetNav from "./components/SheetNav";
import PcbaList from "./components/PcbaList";
import ChartGrid from "./components/ChartGrid";

const App: React.FC = () => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("未导入文件");
  const [gridCols, setGridCols] = useState<number>(2);
  const [selectedAsn, setSelectedAsn] = useState<string | null>(null);

  // 处理 Excel 文件导入
  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Excel", extensions: ["xlsx", "xls", "xlsb"] }],
      });

      if (selected) {
        setLoading(true);
        const path = (selected as any).path || selected;
        setFileName(path.split("/").pop() || "已导入文件");

        // 调用 Rust 后端解析引擎
        const res: SheetData[] = await invoke("parse_excel", { path });
        setSheets(res);
        setActiveSheetIdx(0);
        setSelectedAsn(null);
        setLoading(false);
      }
    } catch (err) {
      console.error("Excel import failed:", err);
      setLoading(false);
    }
  };

  const currentSheet = sheets[activeSheetIdx] || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* 顶部操作栏 */}
      <Header
        fileName={fileName}
        loading={loading}
        gridCols={gridCols}
        onImport={handleImport}
        onGridChange={setGridCols}
      />

      {/* 主体视窗区域 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左侧单板虚拟滚动列表 */}
        <PcbaList
          pcbasnList={currentSheet?.pcbasn_list || []}
          selectedAsn={selectedAsn}
          onSelectAsn={setSelectedAsn}
        />

        {/* 右侧统计图表矩阵 */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900/50 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <ChartGrid
            indicators={currentSheet?.indicators || []}
            gridCols={gridCols}
            selectedAsn={selectedAsn}
            pcbasnList={currentSheet?.pcbasn_list || []}
          />
        </main>
      </div>

      {/* 底部 Sheet 横向滚动导航栏 */}
      <SheetNav
        sheets={sheets}
        activeSheetIdx={activeSheetIdx}
        onSheetChange={(idx) => {
          setActiveSheetIdx(idx);
          setSelectedAsn(null); // 切换Sheet时重置高亮单板
        }}
      />
    </div>
  );
};

export default App;
