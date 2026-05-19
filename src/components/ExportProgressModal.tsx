import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { t, useLocale } from "../i18n";

export interface ExportProgressState {
  visible: boolean;
  percent: number;
  text: string;
}

interface ExportProgressModalProps {
  progress: ExportProgressState;
  title?: string;
  description?: string;
}

const ExportProgressModal: React.FC<ExportProgressModalProps> = ({ progress, title, description }) => {
  const { locale } = useLocale();

  if (!progress.visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 w-96 shadow-2xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400">
            <FileSpreadsheet className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-slate-200 font-bold text-sm">{title || t("generatingReport", locale)}</h3>
            <p className="text-xs text-slate-400">{description || t("generatingReportDesc", locale)}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">{progress.text}</span>
            <span className="text-blue-400 font-bold">{progress.percent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportProgressModal;
