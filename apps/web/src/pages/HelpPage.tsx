import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LifeBuoy, MessageCircle, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useBusinessId } from "@/hooks/useBusinessId";
import { HelpMarkdown } from "@/components/HelpMarkdown";
import { getLocale, t, tDynamic } from "@/i18n";
import { helpService, type HelpArticle } from "@/services/helpService";
import { platformSettings, getSalonSupport } from "@/services/platformService";

type Article = "a1" | "a2" | "a3" | "a4" | "a5" | "a6" | "a7" | "a8";

/** Each article points at the panel page it talks about. */
const ARTICLES: { id: Article; to: string }[] = [
  { id: "a1", to: "tasks" },
  { id: "a2", to: "services" },
  { id: "a3", to: "staff" },
  { id: "a4", to: "business" },
  { id: "a5", to: "setup/email" },
  { id: "a6", to: "calendar" },
  { id: "a7", to: "sales" },
  { id: "a8", to: "security" },
];

const q = (id: Article) => t(`help.${id}.q` as "help.a1.q");
const body = (id: Article) => t(`help.${id}.a` as "help.a1.a");
const linkLabel = (id: Article) => t(`help.${id}.link` as "help.a1.link");

/** Articles written in the back office: grouped by category, full text loaded when one is opened. */
function ServerArticles({ query, initialSlug }: { query: string; initialSlug?: string }) {
  const [rows, setRows] = useState<HelpArticle[] | null>(null);
  const [open, setOpen] = useState(initialSlug ?? "");
  const [bodies, setBodies] = useState<Record<string, string | null>>({});
  const asked = useRef(new Set<string>());
  const locale = getLocale();

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      helpService.list(locale, query).then((r) => live && setRows(r)).catch(() => live && setRows([]));
    }, query ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, locale]);

  useEffect(() => {
    if (!open || asked.current.has(open)) return;
    asked.current.add(open);
    helpService.article(locale, open).then((a) => setBodies((b) => ({ ...b, [open]: a?.body ?? null }))).catch(() => setBodies((b) => ({ ...b, [open]: null })));
  }, [open, locale]);

  if (!rows || rows.length === 0) return null;
  const groups = new Map<string, HelpArticle[]>();
  for (const a of rows) groups.set(a.category, [...(groups.get(a.category) ?? []), a]);
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">{t("helpCenter.articlesTitle")}</h2>
      {[...groups].map(([cat, list]) => (
        <div key={cat} className="overflow-hidden rounded-[20px] bg-white px-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:px-6">
          <p className="pt-4 text-xs font-bold uppercase tracking-wide opacity-60">{tDynamic(`helpCenter.cat.${cat}`, cat)}</p>
          <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
            {list.map((a) => (
              <AccordionItem key={a.slug} value={a.slug} id={`help-${a.slug}`}>
                <AccordionTrigger className="text-left">{a.title}</AccordionTrigger>
                <AccordionContent>
                  {bodies[a.slug] === undefined ? (
                    <p className="text-sm opacity-70">{a.body}</p>
                  ) : bodies[a.slug] === null ? (
                    <p className="text-sm opacity-70">{t("helpCenter.loadFailed")}</p>
                  ) : (
                    <HelpMarkdown source={bodies[a.slug] ?? ""} className="text-sm" />
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </section>
  );
}

/** Kömək: articles from the back office and short static answers, and the way to Support when they are not enough. */
export default function HelpPage() {
  const { salonKey: businessKey, articleSlug } = useParams<{ salonKey?: string; articleSlug?: string }>();
  // The URL carries the salon KEY (/<slug>_<uuid>); the API takes the UUID — the raw key was a 403 on /support.
  const businessId = useBusinessId() || undefined;
  const [query, setQuery] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [priority, setPriority] = useState(false);

  useEffect(() => {
    let live = true;
    platformSettings().then((s) => {
      if (live) setWhatsapp(String(s.supportWhatsapp ?? "").replace(/\D/g, ""));
    });
    return () => { live = false; };
  }, []);

  // FG-W1-03: İlk 100 salons get priority support; the salon's own number wins over the global one.
  useEffect(() => {
    if (!businessId) return;
    let live = true;
    getSalonSupport(businessId).then((s) => {
      if (!live || !s) return;
      setPriority(!!s.priority);
      if (s.whatsapp) setWhatsapp(s.whatsapp);
    });
    return () => { live = false; };
  }, [businessId]);

  const needle = query.trim().toLocaleLowerCase();
  const shown = useMemo(
    () => ARTICLES.filter((a) => !needle || q(a.id).toLocaleLowerCase().includes(needle)),
    [needle],
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />
        <div className={cn(pageBody, "mx-auto max-w-3xl")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("help.search")}
              aria-label={t("help.search")}
              className={cn(fieldCls, "pl-9")}
            />
          </div>

          <ServerArticles query={query.trim()} initialSlug={articleSlug} />

          <h2 className="text-base font-semibold">{t("helpCenter.quickTitle")}</h2>
          <section className="overflow-hidden rounded-[20px] bg-white px-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:px-6">
            {shown.length === 0 ? (
              <p className="py-6 text-sm opacity-70">{t("help.noResults")}</p>
            ) : (
              <Accordion type="single" collapsible>
                {shown.map((a) => (
                  <AccordionItem key={a.id} value={a.id}>
                    <AccordionTrigger className="text-left">{q(a.id)}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm leading-relaxed">{body(a.id)}</p>
                      <Link to={`/${businessKey}/${a.to}`} className="mt-3 inline-block text-sm font-semibold underline underline-offset-2">
                        {linkLabel(a.id)}
                      </Link>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </section>

          <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
            <div className="flex items-start gap-3">
              <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{t("help.notFoundTitle")}</h2>
                <p className="mt-1 text-sm opacity-70">{t("help.notFoundText")}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {priority && (
                <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {t("help.priority")}
                </span>
              )}
              <Link to={`/${businessKey}/support`} className={cn(primaryBtn, "inline-flex items-center justify-center")}>{t("help.writeSupport")}</Link>
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className={cn(secondaryBtn, "inline-flex items-center justify-center gap-2")}>
                  <MessageCircle className="h-4 w-4" aria-hidden />{t("help.whatsapp")}
                </a>
              )}
            </div>
          </section>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
