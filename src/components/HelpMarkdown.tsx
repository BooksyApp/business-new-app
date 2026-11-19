import type { ReactNode } from "react";

/**
 * A small Markdown renderer for help articles: headings, paragraphs, bullet and numbered lists, **bold**,
 * *italic*, `code` and links. It builds React elements only (no raw HTML is ever interpreted) and a link is
 * rendered only for https:// or a site path, so nothing an editor types can inject markup or a script.
 */
const LINK = /^(https:\/\/\S+|\/[^/\s]\S*)$/;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-black/5 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const url = tok.slice(tok.indexOf("](") + 2, -1);
      out.push(
        LINK.test(url) ? (
          <a key={k} href={url} className="font-medium underline underline-offset-2" {...(url.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function HelpMarkdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`} className="my-3 leading-relaxed">{inline(para.join(" "), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    const k = `l${blocks.length}`;
    blocks.push(
      <Tag key={k} className={`my-3 space-y-1.5 pl-6 ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((it, n) => <li key={n} className="leading-relaxed">{inline(it, `${k}-${n}`)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const k = `h${blocks.length}`;
      blocks.push(
        level <= 2 ? (
          <h2 key={k} className="mb-1 mt-6 text-lg font-bold">{inline(h[2], k)}</h2>
        ) : (
          <h3 key={k} className="mb-1 mt-4 text-base font-semibold">{inline(h[2], k)}</h3>
        ),
      );
    } else if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className={className}>{blocks}</div>;
}
