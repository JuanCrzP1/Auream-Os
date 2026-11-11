import type { ReactElement } from "react";

// Íconos de línea de la ayuda (24×24, heredan el color del texto).

const PATHS = {
  book: <><path d="M2.5 5h6A3.5 3.5 0 0 1 12 8.5V20a2.5 2.5 0 0 0-2.5-2.5h-7z" /><path d="M21.5 5h-6A3.5 3.5 0 0 0 12 8.5V20a2.5 2.5 0 0 1 2.5-2.5h7z" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  doc: <><path d="M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  thumbUp: <path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10zm0 0 4-7a2 2 0 0 1 2.5 2.4L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />,
  thumbDown: <path d="M17 14V4h2.5A1.5 1.5 0 0 1 21 5.5v7a1.5 1.5 0 0 1-1.5 1.5zm0 0-4 7a2 2 0 0 1-2.5-2.4l.7-3.6H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 4H17" />,
  video: <><rect x="3" y="5.5" width="13" height="13" rx="2.5" /><path d="m16 10 5-3v10l-5-3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />
} satisfies Record<string, ReactElement>;

export type HelpIconName = keyof typeof PATHS;

export function HelpIcon({ name, size = 16 }: { readonly name: HelpIconName; readonly size?: number }) {
  return (
    <svg className="help-icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
