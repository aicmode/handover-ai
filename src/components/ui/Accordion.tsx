"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * 開閉できるセクション。
 * 縦に長い画面（患者詳細・AI生成結果）で、必要な情報だけを展開するために使う。
 * 折りたたんだ状態でも `badge` で中身の有無が分かるようにしている。
 */
export function Accordion({
  title,
  description,
  badge,
  icon,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** 折りたたみ時にも表示する補助情報（入力件数など） */
  badge?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={cn("rounded border border-line bg-surface-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface"
      >
        <ChevronDown
          size={15}
          aria-hidden
          className={cn(
            "shrink-0 text-fg-muted transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
        {icon ? <span className="shrink-0 text-brand">{icon}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-fg">{title}</span>
          {description ? (
            <span className="block text-[11px] text-fg-muted">{description}</span>
          ) : null}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </button>
      <div id={panelId} hidden={!open} className="border-t border-line px-3 py-3">
        {children}
      </div>
    </div>
  );
}

/** 折りたたみ時に「n件入力済み」等を示す小さなバッジ。 */
export function CountBadge({
  count,
  total,
  unit = "件",
}: {
  count: number;
  total?: number;
  unit?: string;
}) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        count > 0
          ? "border-brand/40 bg-brand-soft text-brand"
          : "border-line-strong bg-surface text-fg-muted",
      )}
    >
      {total === undefined ? `${count}${unit}` : `${count}/${total}${unit}`}
    </span>
  );
}
