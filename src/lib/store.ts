"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createDemoState } from "./demo-data";
import { loadState, saveState } from "./storage";
import type { AppState, HandoverRecord, Patient, RiskLevel } from "./types";

/**
 * アプリ全体の状態ストア。
 * localStorageを永続化先とする外部ストアとして実装し、
 * Reactからは useSyncExternalStore で購読する。
 */

const listeners = new Set<() => void>();

/** サーバー描画時・ハイドレーション時の初期スナップショット。 */
let current: AppState = createDemoState();
let loaded = false;

const emit = (): void => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): AppState => current;
const getLoadedSnapshot = (): boolean => loaded;
const getLoadedServerSnapshot = (): boolean => false;

/** 初回マウント時に localStorage から読み込む。 */
const ensureLoaded = (): void => {
  if (loaded) return;
  loaded = true;
  current = loadState();
  emit();
};

const setState = (updater: (prev: AppState) => AppState): void => {
  current = updater(current);
  saveState(current);
  emit();
};

const LEVEL_ORDER: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** 患者ごとの表示用リスクレベル（背景リスクと生成されたリスクの高い方） */
export const patientRiskLevel = (
  patient: Patient,
  record: HandoverRecord | undefined,
): RiskLevel => {
  let level: RiskLevel = patient.fallRisk;
  for (const risk of record?.result?.risks ?? []) {
    if (LEVEL_ORDER[risk.level] > LEVEL_ORDER[level]) level = risk.level;
  }
  return level;
};

interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  attention: number;
}

interface StoreValue {
  /** localStorageからの読み込みが完了したか */
  hydrated: boolean;
  patients: Patient[];
  records: Record<string, HandoverRecord>;
  stats: DashboardStats;
  getPatient: (id: string) => Patient | undefined;
  getRecord: (id: string) => HandoverRecord | undefined;
  updatePatient: (id: string, patch: Partial<Patient>) => void;
  updateRecord: (id: string, patch: Partial<HandoverRecord>) => void;
  resetDemo: () => void;
}

export function useStore(): StoreValue {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    getLoadedSnapshot,
    getLoadedServerSnapshot,
  );

  useEffect(() => {
    ensureLoaded();
  }, []);

  const updatePatient = useCallback((id: string, patch: Partial<Patient>) => {
    setState((prev) => ({
      ...prev,
      patients: prev.patients.map((patient) =>
        patient.id === id ? { ...patient, ...patch } : patient,
      ),
    }));
  }, []);

  const updateRecord = useCallback(
    (id: string, patch: Partial<HandoverRecord>) => {
      setState((prev) => {
        const record = prev.records[id];
        if (!record) return prev;
        return {
          ...prev,
          records: {
            ...prev.records,
            [id]: { ...record, ...patch, updatedAt: new Date().toISOString() },
          },
        };
      });
    },
    [],
  );

  const resetDemo = useCallback(() => {
    setState(() => createDemoState());
  }, []);

  return useMemo(() => {
    const completed = state.patients.filter(
      (patient) => state.records[patient.id]?.status === "completed",
    ).length;
    const attention = state.patients.filter(
      (patient) => patientRiskLevel(patient, state.records[patient.id]) === "HIGH",
    ).length;

    return {
      hydrated,
      patients: state.patients,
      records: state.records,
      stats: {
        total: state.patients.length,
        completed,
        pending: state.patients.length - completed,
        attention,
      },
      getPatient: (id: string) =>
        state.patients.find((patient) => patient.id === id),
      getRecord: (id: string) => state.records[id],
      updatePatient,
      updateRecord,
      resetDemo,
    };
  }, [state, hydrated, updatePatient, updateRecord, resetDemo]);
}
