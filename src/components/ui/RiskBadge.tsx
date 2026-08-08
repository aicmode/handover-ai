import { cn } from "@/lib/cn";
import type { RiskLevel } from "@/lib/types";

/**
 * リスクレベル表示。
 * HIGH = 赤系 / MEDIUM = アンバー系 / LOW = ブルー系（ニュートラル）
 */
const LEVEL_STYLES: Record<RiskLevel, string> = {
  HIGH: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300",
  MEDIUM:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  LOW: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
};

export function RiskBadge({
  level,
  label,
  className,
}: {
  level: RiskLevel;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide",
        LEVEL_STYLES[level],
        className,
      )}
    >
      {label ?? level}
    </span>
  );
}

export const riskAccentClass: Record<RiskLevel, string> = {
  HIGH: "border-l-red-500 dark:border-l-red-400",
  MEDIUM: "border-l-amber-500 dark:border-l-amber-400",
  LOW: "border-l-blue-400 dark:border-l-blue-500",
};
