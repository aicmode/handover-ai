import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/**
 * AI生成結果が「確認前のドラフト」であることを明示するバッジ。
 * 完成した正式記録と誤解されないよう、生成結果の先頭に置く。
 */
export function AiDraftNotice({ meta }: { meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-brand/30 bg-brand-soft px-3 py-2">
      <span className="inline-flex items-center gap-1.5 rounded border border-brand/40 bg-surface px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand">
        <Sparkles size={12} aria-hidden />
        AI Generated Draft — AI生成ドラフト
      </span>
      <span className="text-[11px] text-fg-muted">
        内容を確認・必要に応じて編集してから申し送りを完了してください。AIは診断・治療・看護判断を行いません。
      </span>
      {meta ? <span className="text-[11px] text-fg-muted">{meta}</span> : null}
    </div>
  );
}
