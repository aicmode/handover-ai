"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil, UserRound, X } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatDate, genderLabel, hasAllergy, hospitalDay } from "@/lib/format";
import type { CodeStatus, Gender, Patient, RiskLevel } from "@/lib/types";

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "other", label: "その他" },
];

const CODE_OPTIONS: Array<{ value: CodeStatus; label: string }> = [
  { value: "Full Code", label: "Full Code" },
  { value: "DNAR", label: "DNAR" },
  { value: "未確認", label: "未確認" },
];

const RISK_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
  { value: "LOW", label: "LOW" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "HIGH", label: "HIGH" },
];

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-1.5 last:border-b-0">
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{value || "—"}</dd>
    </div>
  );
}

/** 申し送りで真っ先に確認したい情報を、目立つ形でまとめて表示する。 */
function KeyItem({
  label,
  children,
  emphasis,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 dark:border-amber-900 dark:bg-amber-950/40"
          : "rounded border border-line bg-surface-2 px-2.5 py-1.5"
      }
    >
      <p
        className={
          emphasis
            ? "text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300"
            : "text-[10px] uppercase tracking-wide text-fg-muted"
        }
      >
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-fg">{children}</div>
    </div>
  );
}

export function PatientInfoCard({
  patient,
  onSave,
}: {
  patient: Patient;
  onSave: (patch: Partial<Patient>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Patient>(patient);

  const startEdit = () => {
    setDraft(patient);
    setEditing(true);
  };

  const save = () => {
    onSave({
      ...draft,
      age: Number.isFinite(Number(draft.age)) ? Number(draft.age) : patient.age,
    });
    setEditing(false);
  };

  const day = hospitalDay(patient.admissionDate);
  const hasAllergyValue = hasAllergy(patient.allergies);

  return (
    <Card>
      <CardHeader
        title="患者基本情報"
        description={`患者ID ${patient.patientCode}${day ? ` / 入院${day}日目` : ""}`}
        icon={<UserRound size={16} aria-hidden />}
        actions={
          editing ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X size={14} aria-hidden />
                取消
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={save}>
                <Check size={14} aria-hidden />
                保存
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
              <Pencil size={14} aria-hidden />
              編集
            </Button>
          )
        }
      />
      <CardBody>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="氏名">
              <TextInput
                value={draft.name}
                onChange={(value) => setDraft({ ...draft, name: value })}
              />
            </Field>
            <Field label="フリガナ">
              <TextInput
                value={draft.nameKana}
                onChange={(value) => setDraft({ ...draft, nameKana: value })}
              />
            </Field>
            <Field label="年齢">
              <TextInput
                type="number"
                value={String(draft.age)}
                onChange={(value) => setDraft({ ...draft, age: Number(value) || 0 })}
              />
            </Field>
            <Field label="性別">
              <Select
                value={draft.gender}
                onChange={(value) => setDraft({ ...draft, gender: value })}
                options={GENDER_OPTIONS}
              />
            </Field>
            <Field label="病室">
              <TextInput
                value={draft.room}
                onChange={(value) => setDraft({ ...draft, room: value })}
              />
            </Field>
            <Field label="患者ID" hint="架空ID">
              <TextInput
                value={draft.patientCode}
                onChange={(value) => setDraft({ ...draft, patientCode: value })}
              />
            </Field>
            <Field label="主病名" className="sm:col-span-2">
              <TextInput
                value={draft.primaryDiagnosis}
                onChange={(value) => setDraft({ ...draft, primaryDiagnosis: value })}
              />
            </Field>
            <Field label="入院日">
              <TextInput
                type="date"
                value={draft.admissionDate}
                onChange={(value) => setDraft({ ...draft, admissionDate: value })}
              />
            </Field>
            <Field label="担当医">
              <TextInput
                value={draft.attendingDoctor}
                onChange={(value) => setDraft({ ...draft, attendingDoctor: value })}
              />
            </Field>
            <Field label="担当看護師">
              <TextInput
                value={draft.nurseInCharge}
                onChange={(value) => setDraft({ ...draft, nurseInCharge: value })}
              />
            </Field>
            <Field label="コードステータス">
              <Select
                value={draft.codeStatus}
                onChange={(value) => setDraft({ ...draft, codeStatus: value })}
                options={CODE_OPTIONS}
              />
            </Field>
            <Field label="ADL" className="sm:col-span-2">
              <TextArea
                rows={2}
                value={draft.adl}
                onChange={(value) => setDraft({ ...draft, adl: value })}
              />
            </Field>
            <Field label="アレルギー">
              <TextInput
                value={draft.allergies}
                onChange={(value) => setDraft({ ...draft, allergies: value })}
                placeholder="なし"
              />
            </Field>
            <Field label="感染対策">
              <TextInput
                value={draft.infectionControl}
                onChange={(value) => setDraft({ ...draft, infectionControl: value })}
              />
            </Field>
            <Field label="転倒リスク">
              <Select
                value={draft.fallRisk}
                onChange={(value) => setDraft({ ...draft, fallRisk: value })}
                options={RISK_OPTIONS}
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 重要情報は常に見える位置へ、それ以外は折りたたんで縦の長さを抑える。 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <KeyItem label="氏名">{patient.name}</KeyItem>
              <KeyItem label="病室">
                <span className="font-mono">{patient.room}</span>
              </KeyItem>
              <KeyItem label="主病名">{patient.primaryDiagnosis}</KeyItem>
              <KeyItem label="登録アレルギー" emphasis={hasAllergyValue}>
                {hasAllergyValue ? patient.allergies : "なし"}
              </KeyItem>
              <KeyItem label="コードステータス">{patient.codeStatus}</KeyItem>
              <KeyItem label="転倒リスク（患者背景）">
                <RiskBadge level={patient.fallRisk} />
              </KeyItem>
            </div>

            <Accordion
              title="その他の患者情報"
              description="フリガナ・年齢・患者ID・入院日・担当医・担当看護師・ADL・感染対策"
              defaultOpen={false}
            >
              <dl className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                <ReadRow label="フリガナ" value={patient.nameKana} />
                <ReadRow
                  label="年齢 / 性別"
                  value={`${patient.age}歳 / ${genderLabel(patient.gender)}`}
                />
                <ReadRow label="患者ID" value={patient.patientCode} />
                <ReadRow label="入院日" value={formatDate(patient.admissionDate)} />
                <ReadRow label="担当医" value={patient.attendingDoctor} />
                <ReadRow label="担当看護師" value={patient.nurseInCharge} />
                <ReadRow label="ADL" value={patient.adl} />
                <ReadRow label="感染対策" value={patient.infectionControl} />
              </dl>
            </Accordion>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
