"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
import { scrollToElement } from "@/lib/scroll";
import { patientRiskLevel, useStore } from "@/lib/store";
import type { HandoverResult, Patient, Sbar, StructuredNote } from "@/lib/types";
import { AiDraftNotice } from "./AiDraftNotice";
import { BriefSummaryCard } from "./BriefSummaryCard";
import { HandoverInputCard } from "./HandoverInputCard";
import { HighPriorityPanel } from "./HighPriorityPanel";
import { NextShiftTasksCard } from "./NextShiftTasksCard";
import { PatientInfoCard } from "./PatientInfoCard";
import { RiskPanel } from "./RiskPanel";
import { SbarPanel } from "./SbarPanel";
import { SectionNav, type SectionLink } from "./SectionNav";
import { SpeechPanel } from "./SpeechPanel";
import { StructuredInputCard } from "./StructuredInputCard";

const SECTION_IDS = {
  patient: "section-patient",
  input: "section-input",
  summary: "section-ai-summary",
  sbar: "section-sbar",
  priority: "section-priority",
  nextShift: "section-next-shift",
} as const;

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
  /** AI生成ドラフトを確認済みかどうか（セッション内のみ保持） */
  const [draftReviewed, setDraftReviewed] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const patient = getPatient(patientId);
  const record = getRecord(patientId);
  const result = record?.result ?? null;

  /**
   * 生成結果が描画されてから Brief Summary 付近へスクロールする。
   * 描画タイミングのずれに備えて数フレーム待つ。
   */
  const scrollToResultWhenReady = (attempt = 0) => {
    window.requestAnimationFrame(() => {
      if (resultRef.current) {
        scrollToElement(resultRef.current);
        return;
      }
      if (attempt < 10) scrollToResultWhenReady(attempt + 1);
    });
  };

  /** 生成結果の一部だけを更新する（編集・チェック操作用） */
  const setResult = (updater: (current: HandoverResult) => HandoverResult) => {
    if (!result) return;
    updateRecord(patientId, { result: updater(result) });
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
      setDraftReviewed(false);
      scrollToResultWhenReady();
      showToast(
        generated.engine === "openai"
          ? "AI（外部API）で申し送りドラフトを生成しました"
          : "モックAIで申し送りドラフトを生成しました",
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

  // AI生成ドラフトが未確認の状態では完了させない。
  const showReviewCheck = Boolean(result) && record.status !== "completed";
  const needsReview = showReviewCheck && !draftReviewed;

  const navLinks: SectionLink[] = [
    { id: SECTION_IDS.patient, label: "患者情報" },
    { id: SECTION_IDS.input, label: "入力" },
    ...(result
      ? [
          { id: SECTION_IDS.summary, label: "AI要約" },
          { id: SECTION_IDS.sbar, label: "SBAR" },
          { id: SECTION_IDS.priority, label: "確認優先度" },
          { id: SECTION_IDS.nextShift, label: "次勤務" },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
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

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              disabled={needsReview}
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
          {showReviewCheck ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-muted">
              <input
                type="checkbox"
                checked={draftReviewed}
                onChange={(event) => setDraftReviewed(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--brand)]"
              />
              AI生成ドラフトの内容を確認しました
            </label>
          ) : null}
        </div>
      </div>

      <SectionNav links={navLinks} />

      <SafetyNotice />

      <div id={SECTION_IDS.patient}>
        <PatientInfoCard
          patient={patient}
          onSave={(patch) => {
            updatePatient(patientId, patch);
            showToast("患者情報を保存しました", "success");
          }}
        />
      </div>

      <div id={SECTION_IDS.input} className="grid gap-4 xl:grid-cols-2">
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
              入力内容を整理し、要約・SBAR・確認優先度・次勤務への確認候補を生成します。
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
            {[
              "入力情報を整理しています",
              "SBARを組み立てています",
              "確認候補を抽出しています",
            ].map((label) => (
              <div key={label} className="flex items-center gap-2 text-sm text-fg-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                {label}
              </div>
            ))}
            <div className="h-2 w-full overflow-hidden rounded bg-surface-2">
              <div className="h-full w-1/2 animate-pulse rounded bg-brand" />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {result ? (
        <div ref={resultRef} id={SECTION_IDS.summary} className="space-y-4">
          <AiDraftNotice meta={`生成: ${formatDateTime(result.generatedAt)}`} />

          {/* 1. Brief Summary → 2. High Priority の順で重要度を示す */}
          <div className="grid gap-4 xl:grid-cols-2">
            <BriefSummaryCard
              value={result.briefSummary}
              onChange={(next) =>
                setResult((current) => ({ ...current, briefSummary: next }))
              }
            />
            <SpeechPanel briefSummary={result.briefSummary} sbar={result.sbar} />
          </div>

          <HighPriorityPanel
            patient={patient}
            structured={record.structured}
            result={result}
          />

          <div id={SECTION_IDS.sbar}>
            <SbarPanel
              sbar={result.sbar}
              onChange={(next: Sbar) =>
                setResult((current) => ({ ...current, sbar: next }))
              }
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div id={SECTION_IDS.priority}>
              <RiskPanel risks={result.risks} />
            </div>
            <div id={SECTION_IDS.nextShift}>
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
          </div>

          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-fg-muted">
                患者基本情報・Brief Summary・SBAR・確認優先度・観察項目をまとめてコピーできます。
                <br />
                AI生成内容を確認してから申し送りを完了してください。
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
