import React from "react";
import { CpkStatus } from "../types";
import { getCpkStatus } from "../utils/cpk";

type CpkLevelTagVariant = "count" | "badge" | "status";

interface CpkLevelTagProps {
  cpk?: number | null;
  status?: CpkStatus;
  active?: boolean;
  selected?: boolean;
  variant?: CpkLevelTagVariant;
  title?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const statusClasses: Record<CpkStatus, string> = {
  red: "text-rose-700 bg-rose-50 border-rose-200 shadow-rose-900/5 dark:text-rose-50 dark:bg-rose-500/25 dark:border-rose-300/45 dark:shadow-rose-950/30",
  yellow:
    "text-amber-800 bg-amber-50 border-amber-200 shadow-amber-900/5 dark:text-amber-50 dark:bg-amber-500/25 dark:border-amber-300/45 dark:shadow-amber-950/30",
  green:
    "text-emerald-700 bg-emerald-50 border-emerald-200 shadow-emerald-900/5 dark:text-emerald-50 dark:bg-emerald-500/25 dark:border-emerald-300/45 dark:shadow-emerald-950/30",
  cyan: "text-cyan-700 bg-cyan-50 border-cyan-200 shadow-cyan-900/5 dark:text-cyan-50 dark:bg-cyan-500/25 dark:border-cyan-300/45 dark:shadow-cyan-950/30",
};

const unknownClass =
  "text-slate-300 bg-slate-800 border-slate-700 shadow-sm";

const variantClasses: Record<CpkLevelTagVariant, string> = {
  count: "rounded-md px-2 py-1 text-[10px] font-mono font-bold shadow-sm",
  badge: "rounded-md px-1.5 py-0.5 text-[8px] font-semibold shadow-sm",
  status: "rounded-lg px-2 py-0.5 text-[10px] font-mono font-semibold shadow-sm",
};

export const CpkLevelTag: React.FC<CpkLevelTagProps> = ({
  cpk,
  status,
  active = true,
  selected = false,
  variant = "badge",
  title,
  className,
  children,
  onClick,
}) => {
  const isUnknown = !status && (cpk === null || cpk === undefined);
  const level = status ?? getCpkStatus(cpk ?? null);
  const baseClassName = cn(
    "inline-flex shrink-0 items-center justify-center border transition-all",
    variantClasses[variant],
    selected
      ? "bg-blue-600 text-white border-blue-400/50 shadow-blue-950/20"
      : active
        ? isUnknown
          ? unknownClass
          : statusClasses[level]
        : "bg-slate-800/40 text-slate-400 border-slate-700/40 opacity-60 shadow-none",
    onClick && active && "hover:-translate-y-px",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={baseClassName}>
        {children}
      </button>
    );
  }

  return (
    <span title={title} className={baseClassName}>
      {children}
    </span>
  );
};
