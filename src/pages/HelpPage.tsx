import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LifeBuoy, MessageCircle, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { platformSettings } from "@/services/platformService";

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

/** Kömək: short static answers, and the way to Support when they are not enough. */
export default function HelpPage() {
  const { salonKey: businessId } = useParams<{ salonKey?: string }>();
  const [query, setQuery] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    let live = true;
    platformSettings().then((s) => {
      if (live) setWhatsapp(String(s.supportWhatsapp ?? "").replace(/\D/g, ""));
    });
    return () => { live = false; };
  }, []);

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
                      <Link to={`/${businessId}/${a.to}`} className="mt-3 inline-block text-sm font-semibold underline underline-offset-2">
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
              <Link to={`/${businessId}/support`} className={cn(primaryBtn, "inline-flex items-center justify-center")}>{t("help.writeSupport")}</Link>
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
