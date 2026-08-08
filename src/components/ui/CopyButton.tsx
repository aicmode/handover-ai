"use client";

import { Copy } from "lucide-react";
import { Button } from "./Button";
import { useToast } from "./ToastProvider";

/** クリップボードAPIが使えない環境向けのフォールバック。 */
const legacyCopy = (text: string): boolean => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  return succeeded;
};

export function CopyButton({
  text,
  label = "コピー",
  successMessage = "クリップボードにコピーしました",
  variant = "secondary",
  size = "sm",
  disabled,
}: {
  text: string | (() => string);
  label?: string;
  successMessage?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const { showToast } = useToast();

  const handleCopy = async () => {
    const value = typeof text === "function" ? text() : text;
    if (!value.trim()) {
      showToast("コピーする内容がありません", "error");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!legacyCopy(value)) {
        throw new Error("copy command failed");
      }
      showToast(successMessage, "success");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={disabled}
    >
      <Copy size={14} aria-hidden />
      {label}
    </Button>
  );
}
