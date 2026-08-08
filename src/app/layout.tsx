import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { themeInitScript } from "@/lib/theme-store";

export const metadata: Metadata = {
  title: "Handover AI — AI Nursing Handover Assistant",
  description:
    "看護申し送りを支援するAIプロトタイプ。SBAR生成・リスク抽出・次勤務への観察項目生成に対応します。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* ハイドレーション前にテーマを適用してちらつきを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <AppHeader />
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 lg:px-6">
            {children}
          </main>
          <footer className="border-t border-line px-4 py-4 text-center text-[11px] text-fg-muted lg:px-6">
            Handover AI — ポートフォリオ用プロトタイプ / 表示されている患者データはすべて架空です
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
