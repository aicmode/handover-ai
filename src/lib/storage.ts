import { createDemoState, createRecord, STATE_VERSION } from "./demo-data";
import type { AppState, HandoverRecord } from "./types";

export const STORAGE_KEY = "handover-ai:state:v1";
export const THEME_KEY = "handover-ai:theme";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * localStorageから状態を読み込む。
 * 保存形式が壊れている／バージョンが異なる場合はデモデータを返す。
 */
export const loadState = (): AppState => {
  if (typeof window === "undefined") return createDemoState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoState();

    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== STATE_VERSION ||
      !Array.isArray(parsed.patients) ||
      !isRecord(parsed.records)
    ) {
      return createDemoState();
    }

    const state = parsed as unknown as AppState;
    // 保存後に追加された患者があってもレコードが欠けないよう補完する。
    const records: Record<string, HandoverRecord> = { ...state.records };
    for (const patient of state.patients) {
      if (!records[patient.id]) records[patient.id] = createRecord(patient.id);
    }
    return { ...state, records };
  } catch {
    return createDemoState();
  }
};

export const saveState = (state: AppState): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存領域が使えない環境（プライベートモード等）ではメモリ上の状態のみで動作する。
  }
};

export const clearState = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 何もしない
  }
};
