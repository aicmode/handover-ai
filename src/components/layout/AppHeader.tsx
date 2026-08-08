"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Moon, Sun } from "lucide-react";
import { useIsClient } from "@/lib/use-is-client";
import { useTheme } from "@/lib/theme-store";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 1秒ごとに更新する現在日時。SSRとの不一致を避けるためマウント後に表示する。 */
function Clock() {
  const isClient = useIsClient();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!isClient) {
    return <span className="font-mono text-xs text-header-fg/50">--:--:--</span>;
  }

  const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(
    now.getDate(),
  ).padStart(2, "0")}`;

  return (
    <div className="text-right leading-tight">
      <div className="text-[11px] text-header-fg/70">
        {date}（{WEEKDAYS[now.getDay()]}）
      </div>
      <div className="font-mono text-sm tabular-nums text-header-fg">
        {now.toLocaleTimeString("ja-JP", { hour12: false })}
      </div>
    </div>
  );
}

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-black/20 bg-header text-header-fg">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/20 bg-white/10">
            <Activity size={18} aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-base font-semibold tracking-wide">
              Handover AI
            </span>
            <span className="block text-[11px] tracking-wide text-header-fg/70">
              AI Nursing Handover Assistant
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <Clock />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"}
            className="flex h-9 items-center gap-1.5 rounded border border-white/20 bg-white/5 px-2.5 text-xs font-medium text-header-fg transition-colors hover:bg-white/15"
          >
            {theme === "dark" ? (
              <Sun size={15} aria-hidden />
            ) : (
              <Moon size={15} aria-hidden />
            )}
            <span className="hidden sm:inline">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
