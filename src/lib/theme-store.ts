"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_KEY } from "./storage";

export type Theme = "light" | "dark";

/**
 * テーマは `<html>` の `dark` クラスを唯一の情報源（外部ストア）として扱う。
 * Reactは useSyncExternalStore でその状態を購読する。
 */

const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

/** SSR時は初期テーマ適用スクリプトが動く前なのでライト固定。 */
const getServerSnapshot = (): Theme => "light";

const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // 保存できない環境でもセッション中の切替は有効。
  }
  for (const listener of listeners) listener();
};

/**
 * 初期テーマ適用スクリプト。
 * Reactのハイドレーション前に実行し、ダークモードのちらつきを防ぐ。
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggleTheme = useCallback(() => {
    applyTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);
  return { theme, toggleTheme };
}
