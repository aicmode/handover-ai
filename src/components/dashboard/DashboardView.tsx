"use client";

import { useState } from "react";
import { LayoutDashboard, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SafetyNotice } from "@/components/layout/SafetyNotice";
import { useToast } from "@/components/ui/ToastProvider";
import { SummaryCards } from "./SummaryCards";
import { PatientTable } from "./PatientTable";
import { patientRiskLevel, useStore } from "@/lib/store";

type Filter = "all" | "pending" | "completed" | "attention";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "pending", label: "未完了" },
  { id: "completed", label: "完了" },
  { id: "attention", label: "要確認（HIGH）" },
];

export function DashboardView() {
  const { patients, records, stats, resetDemo, hydrated } = useStore();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = patients.filter((patient) => {
    const record = records[patient.id];
    if (filter === "pending") return record?.status !== "completed";
    if (filter === "completed") return record?.status === "completed";
    if (filter === "attention") return patientRiskLevel(patient, record) === "HIGH";
    return true;
  });

  const handleReset = () => {
    resetDemo();
    showToast("デモデータに戻しました", "info");
  };

  return (
    <div className="space-y-4">
      {/*
        見出しと説明文は1つのブロックにまとめ、操作ボタンとは
        別の行に折り返せるようにする（狭い幅で説明文が潰れないようにするため）。
      */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="flex items-center gap-2 text-lg font-semibold leading-7 text-fg">
            <LayoutDashboard size={18} className="shrink-0 text-brand" aria-hidden />
            Dashboard
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            本日の担当患者と申し送り状況の一覧です。患者を選択すると申し送り画面に移動します。
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="shrink-0"
        >
          <RotateCcw size={14} aria-hidden />
          デモデータに戻す
        </Button>
      </div>

      <SafetyNotice />

      <SummaryCards
        total={stats.total}
        completed={stats.completed}
        pending={stats.pending}
        attention={stats.attention}
      />

      <Card>
        <CardHeader
          title="患者一覧"
          description={
            hydrated
              ? `${visible.length}件を表示中（全${patients.length}件） / 確認優先度は申し送り時に確認する優先度であり、医学的重症度ではありません`
              : "読み込み中..."
          }
          actions={
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={
                    filter === item.id
                      ? "rounded border border-brand bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg"
                      : "rounded border border-line-strong px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-muted">
            該当する患者はいません。
          </p>
        ) : (
          <PatientTable patients={visible} records={records} />
        )}
      </Card>
    </div>
  );
}
