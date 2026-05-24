import React, { useState } from "react";
import { Bot, Loader2, MessageSquareText, RefreshCw, ShieldAlert, X } from "lucide-react";
import { SheetData } from "../types";
import { Locale } from "../i18n";
import { RfMappingConfig } from "../utils/rfParser";
import { AiReportResult, generateAiReport } from "../ai/qualityAssistant";

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheet: SheetData | null;
  fileName: string;
  rfMappings: RfMappingConfig;
  locale: Locale;
}

const emptyReport: AiReportResult | null = null;

const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  currentSheet,
  fileName,
  rfMappings,
  locale,
}) => {
  const [report, setReport] = useState<AiReportResult | null>(emptyReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const runReport = async () => {
    if (!currentSheet) return;
    setLoading(true);
    setError("");
    try {
      const nextReport = await generateAiReport(currentSheet, fileName, rfMappings, locale);
      setReport(nextReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const text = locale === "zh"
    ? {
      title: "AI 质量助手",
      subtitle: "当前批次报告与后续数据问答入口",
      generate: "生成批次报告",
      regenerate: "重新生成",
      noData: "请先导入 Excel 数据后再生成 AI 报告。",
      summary: "摘要",
      findings: "关键发现",
      risks: "质量风险",
      actions: "建议动作",
      priorities: "优先关注检测项",
      queryTitle: "自然语言查询",
      queryComing: "历史数据问答将基于 PostgreSQL 查询 DSL 接入，避免模型直接执行 SQL。",
      disclaimer: "AI 结论基于当前统计结果生成，仅供工程分析参考；最终判定以 CPK/SPC 数据与现场验证为准。",
    }
    : {
      title: "AI Quality Assistant",
      subtitle: "Current-batch report and future data Q&A",
      generate: "Generate Batch Report",
      regenerate: "Regenerate",
      noData: "Import Excel data before generating an AI report.",
      summary: "Summary",
      findings: "Key Findings",
      risks: "Quality Risks",
      actions: "Recommended Actions",
      priorities: "Priority Indicators",
      queryTitle: "Natural Language Query",
      queryComing: "Historical data Q&A will use a PostgreSQL query DSL so the model never executes raw SQL.",
      disclaimer: "AI conclusions are generated from current statistical results for engineering reference only. Final judgment should use CPK/SPC data and on-site verification.",
    };

  return (
    <aside className="absolute right-0 top-0 z-30 flex h-full w-[420px] flex-col border-l border-slate-700/70 bg-slate-950/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="flex min-w-0 items-center space-x-3">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-cyan-300">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-100">{text.title}</h2>
            <p className="truncate text-xs text-slate-500">{text.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
          <div className="mb-1 flex items-center space-x-2 font-bold">
            <ShieldAlert className="h-4 w-4" />
            <span>{locale === "zh" ? "可信度提示" : "Reliability Note"}</span>
          </div>
          <p>{text.disclaimer}</p>
        </div>

        <button
          type="button"
          onClick={runReport}
          disabled={!currentSheet || loading}
          className="flex w-full items-center justify-center space-x-2 rounded-lg border border-cyan-500/40 bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-600/15 transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : report ? <RefreshCw className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
          <span>{report ? text.regenerate : text.generate}</span>
        </button>

        {!currentSheet && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
            {text.noData}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-200">
            {error}
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <Section title={text.summary}>
              <p className="text-sm leading-relaxed text-slate-200">{report.summary}</p>
            </Section>
            <ListSection title={text.findings} items={report.keyFindings} />
            <ListSection title={text.risks} items={report.risks} />
            <ListSection title={text.actions} items={report.recommendedActions} />
            <ListSection title={text.priorities} items={report.priorityIndicators} mono />
          </div>
        )}

        <Section title={text.queryTitle}>
          <p className="text-xs leading-relaxed text-slate-400">{text.queryComing}</p>
        </Section>
      </div>
    </aside>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-cyan-300">{title}</h3>
      {children}
    </section>
  );
}

function ListSection({ title, items, mono = false }: { title: string; items: unknown[]; mono?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={title}>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`} className={`rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs leading-relaxed text-slate-300 ${mono ? "font-mono" : ""}`}>
            {formatAiListItem(item)}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function formatAiListItem(item: unknown): string {
  if (item === null || item === undefined) return "";
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return String(item);
  }
  if (Array.isArray(item)) {
    return item.map(formatAiListItem).filter(Boolean).join(", ");
  }
  if (typeof item === "object") {
    const entries = Object.entries(item as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${formatAiListItem(value)}`)
      .filter((part) => !part.endsWith(": "));
    return entries.join(" | ");
  }
  return String(item);
}

export default AiAssistantDrawer;
