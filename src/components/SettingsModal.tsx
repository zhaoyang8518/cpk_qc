import React from "react";
import { Settings, X, Palette, Activity } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartTheme: string;
  onChangeTheme: (theme: string) => void;
  lineWidth: number;
  onChangeLineWidth: (width: number) => void;
}

const THEMES = [
  { name: "经典深蓝", value: "#5470c6", bg: "bg-blue-600" },
  { name: "翡翠常绿", value: "#10b981", bg: "bg-emerald-500" },
  { name: "暗夜罗兰", value: "#8b5cf6", bg: "bg-purple-500" },
  { name: "落日霞光", value: "#f97316", bg: "bg-orange-500" },
  { name: "赛博青芒", value: "#06b6d4", bg: "bg-cyan-500" },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  chartTheme,
  onChangeTheme,
  lineWidth,
  onChangeLineWidth,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 w-[480px] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/60 border-b border-slate-700/60">
          <div className="flex items-center space-x-2 text-slate-100">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-base tracking-wide">高级系统设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Section 1: Chart Theme */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>直方柱颜色主题</span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onChangeTheme(t.value)}
                  className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    chartTheme === t.value
                      ? "border-blue-500 bg-blue-600/20 text-white shadow-lg shadow-blue-500/10 scale-105"
                      : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${t.bg} flex-shrink-0 shadow`} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Normal Curve Line Width */}
          <div className="space-y-3 border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                <Activity className="w-4 h-4 text-rose-400" />
                <span>正态拟合曲线宽度</span>
              </div>
              <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-blue-400 font-bold border border-slate-700">
                {lineWidth} px
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={lineWidth}
              onChange={(e) => onChangeLineWidth(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
              <span>细 (1px)</span>
              <span>中 (2.5px)</span>
              <span>粗 (5px)</span>
            </div>
          </div>

          {/* Section 3: SPC Algorithm Info */}
          <div className="space-y-2 border-t border-slate-800 pt-5 text-xs text-slate-400 leading-relaxed">
            <div className="font-bold text-slate-300 mb-1">直方图分箱引擎说明</div>
            <p>
              系统内置经典的 <span className="text-blue-400 font-mono">Sturges 规则</span> 动态自适应组距计算：
              <code className="bg-slate-800 px-1.5 py-0.5 rounded ml-1 font-mono text-slate-300">
                K = ⌈1 + 3.322 log₁₀ N⌉
              </code>
            </p>
            <p>
              正态分布红线基于量级对齐公式进行概率密度缩放，确保在横向分箱柱体坐标系下实现无缝贴合。
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-slate-800/40 border-t border-slate-800 space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-medium rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 border border-blue-500/50"
          >
            完成设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
