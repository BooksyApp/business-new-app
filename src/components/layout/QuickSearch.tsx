import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useBusinessId } from "@/hooks/useBusinessId";
import { keyForId } from "@/lib/salonKey";
import { loadHubLocale, t, tDynamic, translate, type TKey } from "@/i18n";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import {
  QUICK_SEARCH_EVENT,
  SEARCH_EXTRAS,
  SettingsIcon,
  myAccess,
  pageAllowed,
  useVisibleNav,
  useVisibleSettings,
} from "./navigation";

const LOCALES = ["az", "en", "ru"] as const;

/** Lower case, no accents, Azerbaijani letters folded: "teqvim" finds "Təqvim". */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ё/g, "е")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Kind = "page" | "setting" | "inside";
interface Entry {
  id: string;
  kind: Kind;
  label: string;
  hint?: string;
  icon: React.ElementType;
  href: string;
  /** Every language's label, folded. */
  names: string[];
  hay: string;
}

const allNames = (key: TKey | string) => LOCALES.map((l) => norm(translate(l, key)));

/**
 * ⌘K / Ctrl+K: jump to any page, setting, or a feature that lives inside a page, by name,
 * in Azerbaijani, English or Russian at once — a salon team often mixes all three.
 * Mounted once by AppLayout. Uses the same visible-menu rules as the rail, so it never
 * offers a page the person's role cannot open.
 */
export function QuickSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loadedTick, setLoadedTick] = useState(0);
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const navSections = useVisibleNav();
  const settings = useVisibleSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(QUICK_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(QUICK_SEARCH_EVENT, onOpen);
    };
  }, []);

  // The other two languages are only fetched when someone actually searches.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all(LOCALES.map((l) => loadHubLocale(l))).then(() => alive && setLoadedTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    if (!open) return [];
    const salonKey = keyForId(businessId);
    const href = (path: string) => (salonKey ? `/${salonKey}${path}` : path);
    const out: Entry[] = [];
    const pageLabel = new Map<string, string>();

    for (const sec of navSections) {
      for (const e of sec.entries) {
        const famNames = e.labelKey ? allNames(e.labelKey) : [norm(e.label)];
        // A category: each page is its own result, hinted with the category ("Team").
        for (const i of e.pages ?? [e]) {
          if (pageLabel.has(i.path)) continue;
          const names = i.labelKey ? allNames(i.labelKey) : [norm(i.label)];
          out.push({
            id: `p:${i.path}`,
            kind: "page",
            label: i.label,
            hint: e.pages ? e.label : sec.key ? t(sec.key) : undefined,
            icon: i.icon,
            href: href(i.path),
            names,
            hay: [...names, ...famNames, norm(i.description ?? "")].join(" "),
          });
          pageLabel.set(i.path, i.label);
        }
      }
    }
    for (const s of settings) {
      for (const r of s.rows) {
        if (pageLabel.has(r.path)) continue;
        const names = allNames(r.labelKey);
        out.push({
          id: `s:${r.path}`,
          kind: "setting",
          label: r.label,
          hint: s.title,
          icon: r.icon,
          href: href(r.path),
          names,
          hay: [...names, norm(s.title), norm(r.hint)].join(" "),
        });
        pageLabel.set(r.path, r.label);
      }
    }
    if (settings.length) {
      const names = allNames("nav.settings");
      out.push({ id: "s:/setup", kind: "setting", label: t("nav.settings"), icon: SettingsIcon, href: href("/setup"), names, hay: names.join(" ") });
    }
    const access = myAccess();
    for (const x of SEARCH_EXTRAS) {
      const base = x.path.split("?")[0];
      if (x.absolute ? !access.isOwner : !pageLabel.has(base) || !pageAllowed(access, base)) continue;
      const names = allNames(`nav.find.${x.key}`);
      const where = pageLabel.get(base);
      out.push({
        id: `x:${x.key}`,
        kind: "inside",
        label: tDynamic(`nav.find.${x.key}`),
        hint: where ? t("nav.search.inPage", { page: where }) : undefined,
        icon: x.icon,
        href: x.absolute ? x.path : href(x.path),
        names,
        hay: names.join(" "),
      });
    }
    return out;
    // loadedTick: rebuild once the other languages arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, navSections.length, settings.length, businessId, loadedTick]);

  const q = norm(query.trim());
  const results = useMemo(() => {
    if (!q) return entries.filter((e) => e.kind !== "inside");
    const words = q.split(/\s+/).filter(Boolean);
    const score = (e: Entry) =>
      e.names.some((n) => n.startsWith(q)) ? 0 : e.names.some((n) => n.split(/[\s&,/-]+/).some((w) => w.startsWith(words[0]))) ? 1 : 2;
    return entries
      .filter((e) => words.every((w) => e.hay.includes(w)))
      .map((e) => ({ e, s: score(e) }))
      .sort((a, b) => a.s - b.s)
      .map((x) => x.e);
  }, [entries, q]);

  const go = (e: Entry) => {
    setOpen(false);
    navigate(e.href);
  };

  const sections: { kind: Kind; heading: string }[] = [
    { kind: "page", heading: t("nav.search.pages") },
    { kind: "setting", heading: t("nav.search.settings") },
    { kind: "inside", heading: t("nav.search.inside") },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        style={{ fontFamily: BRAND_FONT }}
        className="top-[12%] max-w-[560px] translate-y-0 gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-[0_24px_64px_-24px_rgb(var(--reg-ink)/0.45)] ring-1 ring-[rgb(var(--reg-line))] data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{t("nav.search.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("nav.search.anyLanguage")}</DialogDescription>
        <Command shouldFilter={false} loop className="rounded-2xl bg-white text-[rgb(var(--reg-ink))]">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("nav.search.placeholder")}
            className="h-14 text-[15px]"
          />
          <CommandList className="max-h-[min(420px,60vh)] p-1.5">
            <CommandEmpty className="px-4 py-10 text-center text-sm text-[rgb(var(--reg-muted))]">
              {t("nav.search.empty", { query: query.trim() })}
            </CommandEmpty>
            {sections.map(({ kind, heading }) => {
              const list = results.filter((r) => r.kind === kind);
              if (!list.length) return null;
              return (
                <CommandGroup
                  key={kind}
                  heading={heading}
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-[rgb(var(--reg-muted))]"
                >
                  {list.map((e) => {
                    const Icon = e.icon;
                    return (
                      <CommandItem
                        key={e.id}
                        value={e.id}
                        onSelect={() => go(e)}
                        className="group gap-3 rounded-xl px-2.5 py-2.5 data-[selected=true]:bg-[rgb(var(--reg-brand)/0.08)] data-[selected=true]:text-[rgb(var(--reg-ink))]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.7)] group-data-[selected=true]:bg-[rgb(var(--reg-brand)/0.12)] group-data-[selected=true]:text-[rgb(var(--reg-brand-strong))]">
                          <Icon size={16} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{e.label}</span>
                          {e.hint && <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{e.hint}</span>}
                        </span>
                        <CornerDownLeft size={14} className="hidden shrink-0 text-[rgb(var(--reg-muted))] group-data-[selected=true]:block" aria-hidden />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
          <p className="border-t border-[rgb(var(--reg-line)/0.8)] px-4 py-2.5 text-xs text-[rgb(var(--reg-muted))]">{t("nav.search.anyLanguage")}</p>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

