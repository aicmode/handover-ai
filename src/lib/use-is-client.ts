"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = (): (() => void) => () => {};
const clientSnapshot = (): boolean => true;
const serverSnapshot = (): boolean => false;

/**
 * ハイドレーション完了後（＝ブラウザAPIを参照してよい状態）かどうか。
 * SSRの出力と初回描画を一致させるために useSyncExternalStore を用いる。
 */
export const useIsClient = (): boolean =>
  useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);
