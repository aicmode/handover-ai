"use client";

import { scrollToSection } from "@/lib/scroll";

export interface SectionLink {
  id: string;
  label: string;
}

/**
 * 患者詳細画面のページ内ナビゲーション。
 * ヘッダーのすぐ下に sticky で配置する（高さは --subnav-h と一致させる）。
 * 移動先の停止位置は .section-anchor の scroll-margin-top で調整している。
 */
export function SectionNav({ links }: { links: SectionLink[] }) {
  return (
    <nav
      aria-label="ページ内ナビゲーション"
      className="sticky top-[var(--header-h)] z-30 -mx-4 border-b border-line bg-canvas/95 px-4 backdrop-blur lg:-mx-6 lg:px-6"
    >
      <ul className="flex h-[var(--subnav-h)] items-center gap-1 overflow-x-auto">
        {links.map((link) => (
          <li key={link.id} className="shrink-0">
            <a
              href={`#${link.id}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToSection(link.id);
              }}
              className="block rounded px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface hover:text-brand"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
