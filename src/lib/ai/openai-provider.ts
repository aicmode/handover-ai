import type { HandoverInput, NextShiftTask, RiskItem, RiskLevel, Sbar } from "../types";
import { structuredToText } from "./analysis";

/**
 * 実AI API（OpenAI互換）連携。
 *
 * このモジュールはサーバー側（app/api/handover/route.ts）からのみ呼び出す。
 * APIキーは process.env からのみ読み取り、クライアントバンドルには含めない。
 * 環境変数が未設定の場合は isOpenAIConfigured() が false を返し、
 * 呼び出し側がモックエンジンにフォールバックする。
 */

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export const isOpenAIConfigured = (): boolean =>
  Boolean(process.env.OPENAI_API_KEY?.trim());

export interface GeneratedHandover {
  briefSummary: string;
  sbar: Sbar;
  risks: RiskItem[];
  tasks: NextShiftTask[];
}

const SYSTEM_PROMPT = `あなたは日本の病棟看護師の申し送りを支援するアシスタントです。
与えられた患者情報と勤務中の記録を整理し、次勤務者が確認すべき候補を提示します。
診断・治療方針・看護判断を行うことはありません。

必ず次のJSON形式のみを出力してください（前後に説明文を付けないこと）:
{
  "briefSummary": "口頭で30〜60秒程度で伝えられる日本語の要約。患者識別→主病名→重要な直近変化→現在状態→入力済み医師指示→次勤務での確認候補の順",
  "sbar": { "situation": "", "background": "", "assessment": "", "recommendation": "" },
  "risks": [{ "category": "確認候補の名称", "level": "LOW|MEDIUM|HIGH", "detail": "説明", "evidence": ["入力情報からの抽出根拠"] }],
  "tasks": [{ "label": "次勤務で確認する項目", "priority": "LOW|MEDIUM|HIGH" }]
}

制約:
- 入力に無い情報を推測して事実として記載しないこと。
- 診断名を断定せず、「〜の確認」「〜の確認候補」という表現にすること。
  例: ×「呼吸状態悪化」→ ○「呼吸状態の変化に関する確認」、×「脱水」→ ○「水分出納の確認」。
- 新しい看護指示・観察頻度・投与基準を作らないこと。
  例: ×「体温を4時間ごとに測定」→ ○「再発熱の有無と体温の推移を確認」。
- 閾値・基準値は、入力された医師指示に書かれているものだけを引用すること。
  入力に無い閾値をAIが新たに設定しないこと。
- recommendation は「入力済みの医師指示（原文のまま引用）」と
  「次勤務での確認候補」で構成すること。医師指示の文言は改変しないこと。
- 単一の測定値だけで状態を断定しないこと。時系列で低下が確認できる場合のみ
  「低下」と表現し、それ以外は「値・推移の確認」とすること。
- 過去値と現在値を混同しないこと（例: 昨夜38.2℃・現在36.8℃ の場合、「現在発熱」とは書かない）。
- 登録アレルギーは提示のみとし、禁忌薬・代替薬を提案しないこと。
- level / priority は患者の医学的重症度ではなく、申し送り時の「確認優先度」として判定すること。`;

const buildUserPrompt = (input: HandoverInput): string => {
  const { patient, freeText, structured } = input;
  return [
    "# 患者基本情報",
    `病室: ${patient.room}`,
    `氏名: ${patient.name}（${patient.age}歳 / ${patient.gender}）`,
    `患者ID: ${patient.patientCode}`,
    `主病名: ${patient.primaryDiagnosis}`,
    `入院日: ${patient.admissionDate}`,
    `担当医: ${patient.attendingDoctor}`,
    `ADL: ${patient.adl}`,
    `アレルギー: ${patient.allergies}`,
    `コードステータス: ${patient.codeStatus}`,
    `感染対策: ${patient.infectionControl}`,
    `転倒リスク: ${patient.fallRisk}`,
    "",
    "# 自由記載",
    freeText || "（記載なし）",
    "",
    "# 構造化入力",
    structuredToText(structured) || "（記載なし）",
  ].join("\n");
};

const asLevel = (value: unknown): RiskLevel =>
  value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : "MEDIUM";

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** モデル出力を型安全な形へ正規化する。 */
const normalize = (payload: unknown): GeneratedHandover => {
  if (!isRecord(payload)) {
    throw new Error("AI response is not an object");
  }
  const sbarRaw = isRecord(payload.sbar) ? payload.sbar : {};
  const risksRaw = Array.isArray(payload.risks) ? payload.risks : [];
  const tasksRaw = Array.isArray(payload.tasks) ? payload.tasks : [];

  return {
    briefSummary: asString(payload.briefSummary),
    sbar: {
      situation: asString(sbarRaw.situation),
      background: asString(sbarRaw.background),
      assessment: asString(sbarRaw.assessment),
      recommendation: asString(sbarRaw.recommendation),
    },
    risks: risksRaw.filter(isRecord).map((risk, index) => ({
      id: `risk-ai-${index}`,
      category: asString(risk.category) || "その他",
      level: asLevel(risk.level),
      detail: asString(risk.detail),
      evidence: asStringArray(risk.evidence),
    })),
    tasks: tasksRaw.filter(isRecord).map((task, index) => ({
      id: `task-ai-${index}`,
      label: asString(task.label),
      priority: asLevel(task.priority),
      done: false,
    })),
  };
};

export const generateWithOpenAI = async (
  input: HandoverInput,
): Promise<GeneratedHandover> => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  const content =
    isRecord(body) &&
    Array.isArray(body.choices) &&
    isRecord(body.choices[0]) &&
    isRecord(body.choices[0].message)
      ? asString(body.choices[0].message.content)
      : "";

  if (!content) throw new Error("AI response did not contain content");
  return normalize(JSON.parse(content));
};
