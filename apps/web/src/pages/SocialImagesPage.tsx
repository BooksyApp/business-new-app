import type { Id } from "@/types/id";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { assetUrl, publicSiteUrl } from "@/config/api";
import { useBusinessId } from "@/hooks/useBusinessId";
import { getLocale, t } from "@/i18n";
import { SOCIAL_LANGS, SOCIAL_TEMPLATES, type SocialLang, type SocialTemplate } from "@/lib/socialCopy";
import { defaultsFor, downloadSocialPng, renderSocial, socialLink, SOCIAL_SIZES, type SocialFormat } from "@/lib/socialImages";
import { businessService, type Business } from "@/services/businessService";
import { reviewService, type Review } from "@/services/reviewService";
import { serviceService, type Service } from "@/services/serviceService";
import { cn } from "@/lib/utils";
import { BooqiScope, PageHeader, pageBody } from "@/components/bz/p4-compat";

const TEMPLATE_KEY: Record<SocialTemplate, "social.tplOffer" | "social.tplSlots" | "social.tplService" | "social.tplReview"> = {
  offer: "social.tplOffer",
  slots: "social.tplSlots",
  service: "social.tplService",
  review: "social.tplReview",
};

/**
 * Ready-made social images: pick a template (new offer, free slots today, new service, review
 * highlight), edit the words, and download a 1080×1920 story or a 1080×1080 post as PNG. Drawn in
 * the browser (lib/socialImages): the salon's name, logo or photo, a QR code and link to its booking
 * page (?src=social) and the booqi watermark.
 */
export default function SocialImagesPage() {
  const businessId = useBusinessId();
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const initialLang = (SOCIAL_LANGS as string[]).includes(getLocale()) ? (getLocale() as SocialLang) : "az";
  const [lang, setLang] = useState<SocialLang>(initialLang);
  const [template, setTemplate] = useState<SocialTemplate>("offer");
  const [format, setFormat] = useState<SocialFormat>("story");
  const [useCover, setUseCover] = useState(true);
  const [text, setText] = useState(() => defaultsFor("offer", initialLang));
  const [stars, setStars] = useState(5);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!businessId) return;
    businessService.getBusiness(businessId).then(setBusiness).catch(() => setBusiness(null));
    serviceService.getServicesByBusiness(businessId).then(setServices).catch(() => setServices([]));
    reviewService.getByBusiness(businessId).then(setReviews).catch(() => setReviews([]));
  }, [businessId]);

  const salonUrl = useMemo(() => (business?.id ? `${publicSiteUrl()}/salon/${business.slug ?? business.id}` : ""), [business?.id, business?.slug]);
  const shortUrl = salonUrl.replace(/^https?:\/\//, "");
  const goodReviews = useMemo(() => reviews.filter((r) => r.rating >= 4 && (r.comment ?? "").trim().length > 0).slice(0, 12), [reviews]);

  const pickTemplate = (next: SocialTemplate) => {
    setTemplate(next);
    setText(defaultsFor(next, lang));
    setStars(5);
  };
  const pickLang = (next: SocialLang) => {
    setLang(next);
    setText(defaultsFor(template, next));
  };

  // Redraw (debounced) whenever something on the image changes. Latest call wins.
  useEffect(() => {
    if (!salonUrl || !business) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      renderSocial({
        template, format, lang, name: business.name, logoUrl: business.logoUrl ? assetUrl(business.logoUrl) : undefined,
        photoUrl: useCover && business.coverImageUrl ? assetUrl(business.coverImageUrl) : undefined,
        shortUrl, qrUrl: socialLink(salonUrl), headline: text.headline, body: text.body, extra: text.extra, stars,
      })
        .then((c) => {
          if (mine !== seq.current) return;
          try {
            setPreview(c.toDataURL("image/png"));
          } catch {
            // A photo from another origin without CORS taints the canvas: draw without it.
            setUseCover(false);
          }
        })
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [business, salonUrl, shortUrl, template, format, lang, useCover, text, stars]);

  const download = async () => {
    if (!business || busy) return;
    setBusy(true);
    try {
      const c = await renderSocial({
        template, format, lang, name: business.name, logoUrl: business.logoUrl ? assetUrl(business.logoUrl) : undefined,
        photoUrl: useCover && business.coverImageUrl ? assetUrl(business.coverImageUrl) : undefined,
        shortUrl, qrUrl: socialLink(salonUrl), headline: text.headline, body: text.body, extra: text.extra, stars,
      });
      await downloadSocialPng(c, `booqi-${template}-${format}.png`);
    } catch {
      toast.error(t("social.downloadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const fillFromService = (id: Id) => {
    const s = services.find((x) => String(x.id) === String(id));
    if (!s) return;
    const from = s.priceType === "FROM" ? t("social.priceFrom") : "";
    setText({
      headline: s.name,
      body: (s.description ?? "").slice(0, 140),
      extra: s.price != null ? `${from}${from ? " " : ""}${s.price} ${business?.currency ?? ""}`.trim() : "",
    });
  };
  const fillFromReview = (id: Id) => {
    const r = goodReviews.find((x) => String(x.id) === String(id));
    if (!r) return;
    setStars(r.rating);
    setText({ headline: (r.comment ?? "").trim().slice(0, 180), body: "", extra: r.authorName ?? "" });
  };

  const size = SOCIAL_SIZES[format];
  const label = "text-[13px] font-semibold text-[rgb(var(--reg-muted))]";
  const chip = (on: boolean) =>
    cn("rounded-full px-4 py-2 text-sm font-semibold ring-1 transition", on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]");

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("social.title")} subtitle={t("social.subtitle")} />
        <div className={cn(pageBody, "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]")}>
          <section className="space-y-5 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
            <div className="space-y-2">
              <p className={label}>{t("social.template")}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("social.template")}>
                {SOCIAL_TEMPLATES.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={template === k} className={chip(template === k)} onClick={() => pickTemplate(k)}>
                    {t(TEMPLATE_KEY[k])}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <p className={label}>{t("social.format")}</p>
                <div className="flex gap-2" role="radiogroup" aria-label={t("social.format")}>
                  <button type="button" role="radio" aria-checked={format === "story"} className={chip(format === "story")} onClick={() => setFormat("story")}>{t("social.formatStory")}</button>
                  <button type="button" role="radio" aria-checked={format === "post"} className={chip(format === "post")} onClick={() => setFormat("post")}>{t("social.formatPost")}</button>
                </div>
              </div>
              <div className="space-y-2">
                <p className={label}>{t("social.language")}</p>
                <div className="flex gap-2" role="radiogroup" aria-label={t("social.language")}>
                  {SOCIAL_LANGS.map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={lang === l} className={chip(lang === l)} onClick={() => pickLang(l)}>{l.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            {template === "service" && services.length > 0 && (
              <Field label={t("social.fromService")} htmlFor="soc-service">
                <select id="soc-service" className={fieldCls} defaultValue="" onChange={(e) => e.target.value && fillFromService(e.target.value)}>
                  <option value="">—</option>
                  {services.filter((s) => s.isActive).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </Field>
            )}
            {template === "review" && goodReviews.length > 0 && (
              <Field label={t("social.fromReview")} htmlFor="soc-review">
                <select id="soc-review" className={fieldCls} defaultValue="" onChange={(e) => e.target.value && fillFromReview(e.target.value)}>
                  <option value="">—</option>
                  {goodReviews.map((r) => <option key={r.id} value={String(r.id)}>{`${"★".repeat(r.rating)} ${(r.comment ?? "").slice(0, 50)}`}</option>)}
                </select>
              </Field>
            )}

            <Field label={template === "review" ? t("social.quote") : t("social.headline")} htmlFor="soc-headline">
              <Textarea id="soc-headline" rows={2} maxLength={180} value={text.headline} onChange={(e) => setText({ ...text, headline: e.target.value })} />
            </Field>
            {template !== "review" && (
              <Field label={t("social.body")} htmlFor="soc-body">
                <Textarea id="soc-body" rows={2} maxLength={160} value={text.body} onChange={(e) => setText({ ...text, body: e.target.value })} />
              </Field>
            )}
            <Field
              label={template === "slots" ? t("social.slots") : template === "service" ? t("social.price") : template === "review" ? t("social.author") : t("social.offerNote")}
              htmlFor="soc-extra"
              hint={template === "slots" ? t("social.slotsHint") : undefined}
            >
              <input id="soc-extra" className={fieldCls} maxLength={60} value={text.extra} onChange={(e) => setText({ ...text, extra: e.target.value })} />
            </Field>
            {template === "review" && (
              <Field label={t("social.stars")} htmlFor="soc-stars">
                <select id="soc-stars" className={fieldCls} value={stars} onChange={(e) => setStars(Number(e.target.value))}>
                  {[5, 4, 3].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
              </Field>
            )}
            {business?.coverImageUrl && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useCover} onChange={(e) => setUseCover(e.target.checked)} />
                {t("social.useCover")}
              </label>
            )}
          </section>

          <section className="space-y-3">
            <div className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              {preview ? (
                <img src={preview} alt={t("social.previewAlt")} className="mx-auto max-h-[70vh] w-auto max-w-full rounded-2xl" style={{ aspectRatio: `${size.w} / ${size.h}` }} />
              ) : (
                <div className="mx-auto max-h-[70vh] animate-pulse rounded-2xl bg-[rgb(var(--reg-canvas))] motion-reduce:animate-none" style={{ aspectRatio: `${size.w} / ${size.h}`, maxWidth: "100%" }} aria-busy="true" />
              )}
            </div>
            <Button className={cn(primaryBtn, "w-full")} disabled={!salonUrl || busy} onClick={() => void download()}>
              <Download size={16} aria-hidden /> {busy ? t("social.preparing") : t("social.download", { size: `${size.w}×${size.h}` })}
            </Button>
            <p className="text-xs text-[rgb(var(--reg-muted))]">{t("social.linkNote", { url: `${shortUrl}?src=social` })}</p>
          </section>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
