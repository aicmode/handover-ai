import type {
  Gender,
  HandoverResult,
  NextShiftTask,
  Patient,
  RiskItem,
  Sbar,
} from "./types";

/** 「なし」等の記載を除き、実際にアレルギーが登録されているか。 */
export const hasAllergy = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/^(なし|無し|特になし|none)$/i.test(trimmed);
};

export const genderLabel = (gender: Gender): string =>
  gender === "male" ? "男性" : gender === "female" ? "女性" : "その他";

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatDate(iso)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

/** 入院からの経過日数（当日を1日目とする） */
export const hospitalDay = (admissionDate: string): number | null => {
  const start = new Date(`${admissionDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  const diff = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) /
      86_400_000,
  );
  return diff >= 0 ? diff + 1 : null;
};

export const sbarToText = (sbar: Sbar): string =>
  [
    `【S / Situation】\n${sbar.situation}`,
    `【B / Background】\n${sbar.background}`,
    `【A / Assessment】\n${sbar.assessment}`,
    `【R / Recommendation】\n${sbar.recommendation}`,
  ].join("\n\n");

export const risksToText = (risks: RiskItem[]): string =>
  risks.length === 0
    ? "抽出された確認候補はありません。"
    : [
        "※ HIGH / MEDIUM / LOW は申し送り時の確認優先度であり、医学的重症度ではありません。",
        ...risks.map(
          (risk) =>
            `[${risk.level}] ${risk.category}\n  ${risk.detail}${
              risk.evidence.length > 0
                ? `\n  入力情報からの抽出根拠: ${risk.evidence.join(" / ")}`
                : ""
            }`,
        ),
      ].join("\n");

export const tasksToText = (tasks: NextShiftTask[]): string =>
  tasks.length === 0
    ? "確認候補はありません。"
    : tasks
        .map((task) => `${task.done ? "[x]" : "[ ]"} (${task.priority}) ${task.label}`)
        .join("\n");

export const patientToText = (patient: Patient): string =>
  [
    `病室: ${patient.room}`,
    `氏名: ${patient.name}（${patient.nameKana}）`,
    `年齢/性別: ${patient.age}歳 ${genderLabel(patient.gender)}`,
    `患者ID: ${patient.patientCode}`,
    `主病名: ${patient.primaryDiagnosis}`,
    `入院日: ${formatDate(patient.admissionDate)}`,
    `担当医: ${patient.attendingDoctor}`,
    `担当看護師: ${patient.nurseInCharge}`,
    `ADL: ${patient.adl}`,
    `登録アレルギー: ${patient.allergies || "なし"}`,
    `コードステータス: ${patient.codeStatus}`,
    `感染対策: ${patient.infectionControl}`,
    `転倒リスク（患者背景）: ${patient.fallRisk}`,
  ].join("\n");

/** 申し送り全文（コピー用） */
export const fullHandoverToText = (
  patient: Patient,
  result: HandoverResult,
): string =>
  [
    "==============================",
    "  申し送り（Handover AI 生成ドラフト）",
    "==============================",
    "※ 本文はAIが入力情報を整理した確認前のドラフトです。",
    "",
    "■ 患者基本情報",
    patientToText(patient),
    "",
    "■ Brief Summary",
    result.briefSummary,
    "",
    "■ SBAR",
    sbarToText(result.sbar),
    "",
    "■ 確認優先度（入力情報からの抽出）",
    risksToText(result.risks),
    "",
    "■ 次勤務への観察項目（確認候補）",
    tasksToText(result.tasks),
    "",
    "------------------------------",
    `生成日時: ${formatDateTime(result.generatedAt)}`,
    "※ AI生成内容は参考情報です。AIは診断・治療・看護判断を代替しません。",
    "※ 最終的な判断・確認は医療従事者が行ってください。",
  ].join("\n");

/** SBAR全文（読み上げ用に記号を減らした形） */
export const sbarToSpeechText = (sbar: Sbar): string =>
  [
    `シチュエーション。${sbar.situation}`,
    `バックグラウンド。${sbar.background}`,
    `アセスメント。${sbar.assessment.replace(/【|】/g, " ")}`,
    `レコメンデーション。${sbar.recommendation.replace(/・/g, "")}`,
  ].join("\n");
