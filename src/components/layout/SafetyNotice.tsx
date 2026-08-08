import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * 医療安全上の注意書き。
 * AI生成物の位置づけと、個人情報を入力しない旨を常時表示する。
 */
export function SafetyNotice({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p>
            Handover AIは看護申し送りを支援するプロトタイプです。AI生成内容は参考情報であり、最終的な判断・確認は医療従事者が行ってください。
          </p>
          <p className="font-semibold">
            実在患者の個人情報を入力しないでください。本アプリのデータはすべて架空のものです。
          </p>
        </div>
      </div>
    </aside>
  );
}
