"use client";

/**
 * ページ内スクロールのユーティリティ。
 * prefers-reduced-motion が指定されている場合はアニメーションしない。
 * 停止位置は対象要素の scroll-margin-top（.section-anchor）で調整される。
 */

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export const scrollToElement = (element: HTMLElement | null): void => {
  if (!element) return;
  element.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
};

export const scrollToSection = (id: string): void => {
  if (typeof document === "undefined") return;
  scrollToElement(document.getElementById(id));
};
