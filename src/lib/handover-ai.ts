import type {
  HandoverInput,
  HandoverResult,
  NextShiftTask,
  RiskItem,
  Sbar,
} from "./types";
import {
  detectRisks as detectRisksMock,
  generateBriefSummary as generateBriefSummaryMock,
  generateMockHandover,
  generateNextShiftTasks as generateNextShiftTasksMock,
  generateSbar as generateSbarMock,
} from "./ai/mock-engine";
import { generateWithOpenAI, isOpenAIConfigured } from "./ai/openai-provider";

/**
 * AI処理のエントリポイント。UIからは直接ここだけを参照する。
 *
 * - OPENAI_API_KEY が設定されていれば実AI APIを利用
 * - 未設定、または呼び出しに失敗した場合はモックエンジンへフォールバック
 *
 * サーバー側（Route Handler）から呼び出すことを前提としている。
 */

export const isAiConfigured = isOpenAIConfigured;

/** リスク抽出（モックエンジンのルールベース判定） */
export const detectRisks = (input: HandoverInput): RiskItem[] =>
  detectRisksMock(input);

/** SBAR生成（モックエンジン） */
export const generateSBAR = (input: HandoverInput, risks?: RiskItem[]): Sbar =>
  generateSbarMock(input, risks ?? detectRisksMock(input));

/** 次勤務への観察項目生成（モックエンジン） */
export const generateNextShiftTasks = (
  input: HandoverInput,
  risks?: RiskItem[],
): NextShiftTask[] =>
  generateNextShiftTasksMock(input, risks ?? detectRisksMock(input));

/** 口頭申し送り用の要約生成（モックエンジン） */
export const generateBriefSummary = (
  input: HandoverInput,
  risks?: RiskItem[],
): string => generateBriefSummaryMock(input, risks ?? detectRisksMock(input));

/** 申し送り一式（要約・SBAR・リスク・観察項目）を生成する。 */
export const generateHandover = async (
  input: HandoverInput,
): Promise<HandoverResult> => {
  if (isOpenAIConfigured()) {
    try {
      const generated = await generateWithOpenAI(input);
      return {
        ...generated,
        generatedAt: new Date().toISOString(),
        engine: "openai",
      };
    } catch {
      // 実APIが失敗した場合でもデモを継続できるようモックへフォールバックする。
    }
  }

  return {
    ...generateMockHandover(input),
    generatedAt: new Date().toISOString(),
    engine: "mock",
  };
};
