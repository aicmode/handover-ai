import type { HandoverInput, HandoverResult } from "../types";
import { generateMockHandover } from "./mock-engine";

/**
 * クライアント側からAI処理を呼び出すためのラッパー。
 * 通常はサーバーのRoute Handler（/api/handover）を経由するが、
 * 通信に失敗した場合はブラウザ内のモックエンジンで生成を続行する。
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const localFallback = (input: HandoverInput): HandoverResult => ({
  ...generateMockHandover(input),
  generatedAt: new Date().toISOString(),
  engine: "mock",
});

export const requestHandover = async (
  input: HandoverInput,
): Promise<HandoverResult> => {
  try {
    const response = await fetch("/api/handover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) return localFallback(input);

    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.result)) {
      return body.result as unknown as HandoverResult;
    }
    return localFallback(input);
  } catch {
    return localFallback(input);
  }
};
