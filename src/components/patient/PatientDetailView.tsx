"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { SafetyNotice } from "@/components/layout/SafetyNotice";
import { requestHandover } from "@/lib/ai/client";
import { formatDateTime, fullHandoverToText, genderLabel } from "@/lib/format";
import { patientRiskLevel, useStore } from "@/lib/store";
import type { HandoverResult, Patient, Sbar, StructuredNote } from "@/lib/types";
import { BriefSummaryCard } from "./BriefSummaryCard";
import { HandoverInputCard } from "./HandoverInputCard";
import { NextShiftTasksCard } from "./NextShiftTasksCard";
import { PatientInfoCard } from "./PatientInfoCard";
import { RiskPanel } from "./RiskPanel";
import { SbarPanel } from "./SbarPanel";
import { SpeechPanel } from "./SpeechPanel";
import { StructuredInputCard } from "./StructuredInputCard";

function PatientHeading({ patient }: { patient: Patient }) {
  const { records } = useStore();
  const record = records[patient.id];
  const level = patientRiskLevel(patient, record);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="rounded border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg-muted">
        {patient.room}
      </span>
      <h1 className="text-lg font-semibold text-fg">{patient.name}</h1>
      <span className="text-sm text-fg-muted">
        {patient.age}歳 / {genderLabel(patient.gender)} / {patient.primaryDiagnosis}
      </span>
      <RiskBadge level={level} />
      {record?.status === "completed" ? (
        <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 size={12} aria-hidden />
          申し送り完了
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-fg-muted">
          <Clock3 size={12} aria-hidden />
          未完了
        </span>
      )}
    </div>
  );
}

export function PatientDetailView({ patientId }: { patientId: string }) {
  const { getPatient, getRecord, updatePatient, updateRecord, hydrated } = useStore();
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);

  const patient = getPatient(patientId);
  const record = getRecord(patientId);

  /** 生成結果の一部だけを更新する（編集・チェック操作用） */
  const setResult = (updater: (current: HandoverResult) => HandoverResult) => {
    const currentResult = record?.result;
    if (!currentResult) return;
    updateRecord(patientId, { result: updater(currentResult) });
  };

  if (!patient || !record) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <p className="text-sm text-fg-muted">
            {hydrated ? "指定された患者が見つかりません。" : "読み込み中..."}
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <ArrowLeft size={14} aria-hidden />
            ダッシュボードへ戻る
          </Link>
        </CardBody>
      </Card>
    );
  }

  const result = record.result;

  const handleGenerate = async () => {
    if (!record.freeText.trim() && !hasStructuredInput(record.structured)) {
      showToast("申し送り内容を入力してからAI生成を実行してください", "error");
      return;
    }
    setGenerating(true);
    try {
      const generated = await requestHandover({
        patient,
        freeText: record.freeText,
        structured: record.structured,
      });
      updateRecord(patientId, { result: generated });
      showToast(
        generated.engine === "openai"
          ? "AI（外部API）で申し送りを生成しました"
          : "モックAIで申し送りを生成しました",
        "success",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = () => {
    const completed = record.status === "completed";
    updateRecord(patientId, {
      status: completed ? "pending" : "completed",
      completedAt: completed ? null : new Date().toISOString(),
    });
    showToast(
      completed ? "申し送りを未完了に戻しました" : "申し送りを完了にしました",
      completed ? "info" : "success",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-brand"
          >
            <ArrowLeft size={14} aria-hidden />
            Dashboard
          </Link>
          <div className="mt-1">
            <PatientHeading patient={patient} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            text={() => (result ? fullHandoverToText(patient, result) : "")}
            label="申し送り全文をコピー"
            successMessage="申し送り全文をコピーしました"
            size="md"
            disabled={!result}
          />
          <Button
            type="button"
            variant={record.status === "completed" ? "secondary" : "primary"}
            onClick={handleComplete}
          >
            {record.status === "completed" ? (
              <>
                <RotateCcw size={15} aria-hidden />
                未完了に戻す
              </>
            ) : (
              <>
                <CheckCircle2 size={15} aria-hidden />
                申し送り完了
              </>
            )}
          </Button>
        </div>
      </div>

      <SafetyNotice />

      <PatientInfoCard
        patient={patient}
        onSave={(patch) => {
          updatePatient(patientId, patch);
          showToast("患者情報を保存しました", "success");
        }}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <HandoverInputCard
          value={record.freeText}
          onChange={(value) => updateRecord(patientId, { freeText: value })}
        />
        <StructuredInputCard
          value={record.structured}
          onChange={(next: StructuredNote) =>
            updateRecord(patientId, { structured: next })
          }
        />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-fg">AI申し送り生成</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              入力内容から要約・SBAR・リスク・次勤務への観察項目を生成します。
              {result
                ? ` 最終生成: ${formatDateTime(result.generatedAt)}（${
                    result.engine === "openai" ? "外部AI API" : "モックAI"
                  }）`
                : " APIキー未設定時はモックAIで動作します。"}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden />
                生成中...
              </>
            ) : (
              <>
                <Sparkles size={15} aria-hidden />
                AIで申し送りを生成
              </>
            )}
          </Button>
        </CardBody>
      </Card>

      {generating ? (
        <Card>
          <CardBody className="space-y-2">
            {["要約を作成しています", "SBARを組み立てています", "リスクを抽出しています"].map(
              (label) => (
                <div key={label} className="flex items-center gap-2 text-sm text-fg-muted">
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  {label}
                </div>
              ),
            )}
            <div className="h-2 w-full overflow-hidden rounded bg-surface-2">
              <div className="h-full w-1/2 animate-pulse rounded bg-brand" />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <BriefSummaryCard
              value={result.briefSummary}
              onChange={(next) =>
                setResult((current) => ({ ...current, briefSummary: next }))
              }
            />
            <SpeechPanel briefSummary={result.briefSummary} sbar={result.sbar} />
          </div>

          <SbarPanel
            sbar={result.sbar}
            onChange={(next: Sbar) =>
              setResult((current) => ({ ...current, sbar: next }))
            }
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <RiskPanel risks={result.risks} />
            <NextShiftTasksCard
              tasks={result.tasks}
              onToggle={(id, done) =>
                setResult((current) => ({
                  ...current,
                  tasks: current.tasks.map((task) =>
                    task.id === id ? { ...task, done } : task,
                  ),
                }))
              }
            />
          </div>

          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-fg-muted">
                患者基本情報・Brief Summary・SBAR・リスク・観察項目をまとめてコピーできます。
              </p>
              <CopyButton
                text={() => fullHandoverToText(patient, result)}
                label="申し送り全文をコピー"
                successMessage="申し送り全文をコピーしました"
                variant="primary"
                size="md"
              />
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardBody className="py-10 text-center">
            <ClipboardCopy size={22} className="mx-auto text-fg-muted" aria-hidden />
            <p className="mt-2 text-sm text-fg-muted">
              まだAI生成結果がありません。入力後に「AIで申し送りを生成」を実行してください。
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/** 構造化入力に何らかの記載があるか */
function hasStructuredInput(structured: StructuredNote): boolean {
  const { vitals, ...rest } = structured;
  return (
    Object.values(vitals).some((value) => value.trim().length > 0) ||
    Object.values(rest).some((value) => value.trim().length > 0)
  );
}
