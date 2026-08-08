"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { genderLabel } from "@/lib/format";
import { patientRiskLevel } from "@/lib/store";
import type { HandoverRecord, Patient } from "@/lib/types";

function StatusPill({ status }: { status: HandoverRecord["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
        <CheckCircle2 size={12} aria-hidden />
        完了
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-fg-muted">
      <Clock3 size={12} aria-hidden />
      未完了
    </span>
  );
}

export function PatientTable({
  patients,
  records,
}: {
  patients: Patient[];
  records: Record<string, HandoverRecord>;
}) {
  return (
    <>
      {/* デスクトップ: テーブル表示 */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-xs text-fg-muted">
              <th className="px-3 py-2 font-medium">病室</th>
              <th className="px-3 py-2 font-medium">氏名</th>
              <th className="px-3 py-2 font-medium">年齢</th>
              <th className="px-3 py-2 font-medium">性別</th>
              <th className="px-3 py-2 font-medium">主病名</th>
              <th className="px-3 py-2 font-medium">担当</th>
              <th className="px-3 py-2 font-medium">申し送り状況</th>
              <th className="px-3 py-2 font-medium">リスク</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => {
              const record = records[patient.id];
              const level = patientRiskLevel(patient, record);
              return (
                <tr
                  key={patient.id}
                  className="border-b border-line last:border-b-0 transition-colors hover:bg-brand-soft"
                >
                  <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                    {patient.room}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/patients/${patient.id}`}
                      className="font-medium text-fg hover:text-brand hover:underline"
                    >
                      {patient.name}
                    </Link>
                    <span className="ml-2 font-mono text-[11px] text-fg-muted">
                      {patient.patientCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-fg-muted">
                    {patient.age}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {genderLabel(patient.gender)}
                  </td>
                  <td className="px-3 py-2 text-fg">{patient.primaryDiagnosis}</td>
                  <td className="px-3 py-2 text-fg-muted">{patient.nurseInCharge}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={record?.status ?? "pending"} />
                  </td>
                  <td className="px-3 py-2">
                    <RiskBadge level={level} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/patients/${patient.id}`}
                      className="inline-flex items-center gap-0.5 text-xs text-brand hover:underline"
                      aria-label={`${patient.name}さんの申し送り詳細へ`}
                    >
                      申し送り
                      <ChevronRight size={14} aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* タブレット・モバイル: カード表示 */}
      <ul className="divide-y divide-line lg:hidden">
        {patients.map((patient) => {
          const record = records[patient.id];
          const level = patientRiskLevel(patient, record);
          return (
            <li key={patient.id}>
              <Link
                href={`/patients/${patient.id}`}
                className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-brand-soft"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-fg-muted">
                      {patient.room}
                    </span>
                    <span className="font-medium text-fg">{patient.name}</span>
                    <span className="text-xs text-fg-muted">
                      {patient.age}歳 / {genderLabel(patient.gender)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-fg">
                    {patient.primaryDiagnosis}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill status={record?.status ?? "pending"} />
                    <RiskBadge level={level} />
                    <span className="text-[11px] text-fg-muted">
                      担当: {patient.nurseInCharge}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="mt-1 shrink-0 text-fg-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
