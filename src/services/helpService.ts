import { API_BASE_URL } from "@/config/api";

/** Help center articles written in the back office (audience "salon"); az is the fallback language. */
export interface HelpArticle {
  audience: string;
  category: string;
  slug: string;
  locale: string;
  title: string;
  body: string;
  sort_order: number;
}

let listCache: { locale: string; at: number; rows: HelpArticle[] } | null = null;

async function get(qs: URLSearchParams): Promise<HelpArticle[]> {
  const res = await fetch(`${API_BASE_URL}/public/help?${qs}`);
  if (!res.ok) throw new Error(String(res.status));
  const rows = (await res.json()) as HelpArticle[];
  return Array.isArray(rows) ? rows : [];
}

export const helpService = {
  /** The article list (short leads, no full text); `q` searches titles and text on the server. */
  async list(locale: string, q?: string): Promise<HelpArticle[]> {
    const qs = new URLSearchParams({ audience: "salon", locale });
    if (q?.trim()) return get(new URLSearchParams([...qs, ["q", q.trim().slice(0, 100)]]));
    if (listCache && listCache.locale === locale && Date.now() - listCache.at < 60_000) return listCache.rows;
    const rows = await get(qs);
    listCache = { locale, at: Date.now(), rows };
    return rows;
  },
  async article(locale: string, slug: string): Promise<HelpArticle | null> {
    const rows = await get(new URLSearchParams({ audience: "salon", locale, slug }));
    return rows[0] ?? null;
  },
};
