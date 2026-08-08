/**
 * Handover AI — shared domain types.
 * All patient data used in this prototype is fictional.
 */

export type Gender = "male" | "female" | "other";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type HandoverStatus = "pending" | "completed";

export type CodeStatus = "Full Code" | "DNAR" | "未確認";

export type AiEngine = "mock" | "openai";

/** 患者基本情報（すべて架空データ） */
export interface Patient {
  id: string;
  /** 架空の患者ID（例: P-1042） */
  patientCode: string;
  name: string;
  nameKana: string;
  age: number;
  gender: Gender;
  /** 病室（例: 301-A） */
  room: string;
  primaryDiagnosis: string;
  /** 入院日 YYYY-MM-DD */
  admissionDate: string;
  attendingDoctor: string;
  /** 担当看護師 */
  nurseInCharge: string;
  adl: string;
  allergies: string;
  codeStatus: CodeStatus;
  infectionControl: string;
  fallRisk: RiskLevel;
}

/** バイタルサイン（文字列で保持し、解析時に数値化する） */
export interface Vitals {
  temperature: string;
  bloodPressure: string;
  pulse: string;
  spo2: string;
  respiratoryRate: string;
}

/** 構造化入力（自由記載と併用可能） */
export interface StructuredNote {
  vitals: Vitals;
  consciousness: string;
  pain: string;
  mealIntake: string;
  fluidIntake: string;
  elimination: string;
  sleep: string;
  infusion: string;
  medication: string;
  treatment: string;
  examination: string;
  doctorOrder: string;
  family: string;
  other: string;
}

/** SBAR 4項目 */
export interface Sbar {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

/** 抽出されたリスク */
export interface RiskItem {
  id: string;
  /** リスク種別（例: 転倒リスク） */
  category: string;
  level: RiskLevel;
  /** リスクの説明 */
  detail: string;
  /** 判定根拠（入力のどこから判定したか） */
  evidence: string[];
}

/** 次勤務への観察項目 */
export interface NextShiftTask {
  id: string;
  label: string;
  priority: RiskLevel;
  done: boolean;
}

/** AI生成結果 */
export interface HandoverResult {
  briefSummary: string;
  sbar: Sbar;
  risks: RiskItem[];
  tasks: NextShiftTask[];
  /** ISO文字列 */
  generatedAt: string;
  engine: AiEngine;
}

/** 患者ごとの申し送りレコード */
export interface HandoverRecord {
  patientId: string;
  freeText: string;
  structured: StructuredNote;
  result: HandoverResult | null;
  status: HandoverStatus;
  /** ISO文字列 */
  completedAt: string | null;
  updatedAt: string;
}

/** localStorageへ保存する全体状態 */
export interface AppState {
  version: number;
  patients: Patient[];
  records: Record<string, HandoverRecord>;
}

/** AI処理への入力 */
export interface HandoverInput {
  patient: Patient;
  freeText: string;
  structured: StructuredNote;
}
