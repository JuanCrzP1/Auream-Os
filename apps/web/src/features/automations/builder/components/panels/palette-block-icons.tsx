import type { NodeType } from "@contracts/FlowSnapshot";

/** Iconografía de cada tipo de bloque de la paleta. Sin lógica de panel. */
export const BlockIcons: Record<NodeType, JSX.Element> = {
  message: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 12.5a1.67 1.67 0 0 1-1.67 1.67H5.83L2.5 17.5V4.17A1.67 1.67 0 0 1 4.17 2.5h11.66A1.67 1.67 0 0 1 17.5 4.17z"/>
      <line x1="6" y1="7.5" x2="14" y2="7.5"/>
      <line x1="6" y1="11" x2="11" y2="11"/>
    </svg>
  ),
  question: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 12.5a1.67 1.67 0 0 1-1.67 1.67H5.83L2.5 17.5V4.17A1.67 1.67 0 0 1 4.17 2.5h11.66A1.67 1.67 0 0 1 17.5 4.17z"/>
      <circle cx="7.5" cy="10" r="1" fill="white" stroke="none"/>
      <circle cx="10" cy="10" r="1" fill="white" stroke="none"/>
      <circle cx="12.5" cy="10" r="1" fill="white" stroke="none"/>
    </svg>
  ),
  capture: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="2.5" width="13" height="15" rx="1.5"/>
      <line x1="6.5" y1="7" x2="13.5" y2="7"/>
      <line x1="6.5" y1="10" x2="13.5" y2="10"/>
      <line x1="6.5" y1="13" x2="10" y2="13"/>
    </svg>
  ),
  action: (
    <svg viewBox="0 0 20 20" fill="white" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 2 3.5 11.5 10 11.5 9 18 16.5 8.5 10 8.5"/>
    </svg>
  ),
  condition: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="2.5" x2="10" y2="7"/>
      <circle cx="10" cy="9" r="2"/>
      <line x1="8.4" y1="10.8" x2="5.5" y2="14"/>
      <line x1="11.6" y1="10.8" x2="14.5" y2="14"/>
      <circle cx="5.5" cy="15.5" r="1.5"/>
      <circle cx="14.5" cy="15.5" r="1.5"/>
    </svg>
  ),
  delay: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <polyline points="10 5.5 10 10 13 12.5"/>
    </svg>
  ),
  fallback: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1.5 4 1.5 8.5 6 8.5"/>
      <path d="M3.3 12.5a7.5 7.5 0 1 0 .9-5.2L1.5 8.5"/>
    </svg>
  ),
  end: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7.5"/>
      <polyline points="6.5 10.5 9 13 13.5 7.5"/>
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5 L11.5 8 L17.5 10 L11.5 12 L10 17.5 L8.5 12 L2.5 10 L8.5 8 Z" strokeLinejoin="round"/>
      <circle cx="15.5" cy="4.5" r="1.2" fill="white" stroke="none"/>
    </svg>
  ),
};
