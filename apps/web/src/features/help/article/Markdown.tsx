import "./markdown.css";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// El Markdown de los artículos, como elementos de React (nunca HTML crudo):
// títulos `##`/`###` (con ancla), párrafos, listas, tablas, avisos
// (`> **Importante:** …`) y en línea **negrita**, `código` y [enlaces]
// (un enlace a otro artículo, `slug`, abre ese artículo).
// ---------------------------------------------------------------------------

export function anchorOf(title: string): string {
  return title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function inline(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const id = `${key}-${match.index}`;
    if (match[1]) parts.push(<strong key={id}>{match[1]}</strong>);
    else if (match[2]) parts.push(<code key={id}>{match[2]}</code>);
    else if (match[3] && match[4]) {
      const href = match[4];
      parts.push(/^https?:\/\//.test(href) ? <a key={id} href={href} target="_blank" rel="noreferrer">{match[3]}</a> : /^[a-z0-9-]+$/.test(href) ? <Link key={id} to={`/help?article=${href}`}>{match[3]}</Link> : match[3]);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const CALLOUT = /^\*\*([^*:]+):\*\*\s*/;

export function Markdown({ source }: { readonly source: string }) {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const key = `b${i}`;
    if (!line.trim()) { i += 1; continue; }
    const heading = /^(#{2,3}) +(.+)$/.exec(line);
    if (heading) {
      const title = heading[2]!.trim();
      blocks.push(heading[1] === "##" ? <h2 key={key} id={anchorOf(title)}>{title}</h2> : <h3 key={key}>{title}</h3>);
      i += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) quote.push(lines[i++]!.replace(/^>\s?/, ""));
      const text = quote.join(" ");
      const label = CALLOUT.exec(text);
      const tone = label ? (/importante|cuidado/i.test(label[1]!) ? "warn" : /consejo/i.test(label[1]!) ? "tip" : "note") : "note";
      blocks.push(<aside key={key} className={`help-callout help-callout--${tone}`}>{label ? <strong>{label[1]}</strong> : null}<span>{inline(label ? text.slice(label[0].length) : text, key)}</span></aside>);
      continue;
    }
    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i]!)) {
        const cells = lines[i++]!.split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key} className="help-table">
          <table>
            <thead><tr>{head?.map((c, n) => <th key={n}>{inline(c, `${key}h${n}`)}</th>)}</tr></thead>
            <tbody>{body.map((row, r) => <tr key={r}>{row.map((c, n) => <td key={n}>{inline(c, `${key}${r}${n}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^(\d+\.|-) /.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(\d+\.|-) /.test(lines[i]!)) items.push(lines[i++]!.replace(/^(\d+\.|-) /, ""));
      const children = items.map((item, n) => <li key={n}>{inline(item, `${key}l${n}`)}</li>);
      blocks.push(ordered ? <ol key={key} className="help-steps">{children}</ol> : <ul key={key}>{children}</ul>);
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i += 1;
      blocks.push(<pre key={key}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{2,3} |>|\||\d+\. |- |```)/.test(lines[i]!)) paragraph.push(lines[i++]!);
    blocks.push(<p key={key}>{inline(paragraph.join(" "), key)}</p>);
  }
  return <div className="help-markdown">{blocks}</div>;
}
