"use client";

import { AlertTriangle } from "lucide-react";
import { hasAllergy } from "@/lib/format";
import type { HandoverResult, Patient, StructuredNote } from "@/lib/types";

/**
 * Brief Summary の直下に置く「まず確認する項目」。
 *
 * 表示するのは入力情報とAIが抽出した確認候補だけで、
 * 新しい指示・対策は追加しない。赤は本当に重要な情報だけに使う。
 */
export function HighPriorityPanel({
  patient,
  structured,
  result,
}: {
  patient: Patient;
  structured: StructuredNote;
  result: HandoverResult;
}) {
  const highRisks = result.risks.filter((risk) => risk.level === "HIGH");
  const allergy = hasAllergy(patient.allergies) ? patient.allergies : null;
  const doctorOrder = structured.doctorOrder.trim();

  if (highRisks.length === 0 && !allergy) return null;

  return (
    <section className="rounded-card border border-red-300 bg-red-50/70 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-300">
        <AlertTriangle size={15} aria-hidden />
        High Priority — 最初に確認する項目
      </h2>

      <ul className="mt-2 space-y-1.5">
        {highRisks.map((risk) => (
          <li key={risk.id} className="flex gap-2 text-sm text-fg">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span className="min-w-0">
              <span className="font-semibold">{risk.category}</span>
              <span className="text-fg-muted"> — {risk.detail}</span>
            </span>
          </li>
        ))}
        {allergy ? (
          <li className="flex gap-2 text-sm text-fg">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            <span className="min-w-0">
              <span className="font-semibold">登録アレルギー</span>
              <span className="text-fg-muted"> — {allergy}（投薬前に確認）</span>
            </span>
          </li>
        ) : null}
      </ul>

      {doctorOrder ? (
        <div className="mt-2.5 rounded border border-line bg-surface px-3 py-2">
          <p className="text-[11px] font-semibold text-fg-muted">
            入力済みの医師指示（入力内容をそのまま表示）
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-fg">{doctorOrder}</p>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-fg-muted">
        HIGH は申し送り時の確認優先度であり、医学的重症度や診断ではありません。
      </p>
    </section>
  );
}
