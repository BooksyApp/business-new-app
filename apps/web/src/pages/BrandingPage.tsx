import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { ClientPreview } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { businessService, type Business } from "@/services/businessService";
import { getCurrentBusinessId } from "@/config/api";
import { useNavigation } from "@/utils/navigationUtils";
import { t, fmtDate as formatLocaleDate } from "@/i18n";

/**
 * Setup listed "Logo & Colors", "Email Templates" and "Receipt Design" with nothing behind
 * any of them. These are the parts a salon can genuinely control: its logo, its colour and
 * the footer printed on receipts. Logos are URLs rather than uploads for the same reason
 * the cover photo is — this system has no file storage.
 */
export default function BrandingPage() {
  const businessId = getCurrentBusinessId();
  // The widget is one script tag on the salon's own site; it draws the booking button in an iframe.
  const widgetCode = `<script src="https://getbooqi.tech/embed.js" data-salon="${businessId ?? ""}" async></script>`;
  const iframeCode = `<iframe src="https://getbooqi.tech/widget/${businessId ?? ""}" title="booqi" style="width:100%;max-width:380px;height:420px;border:0" loading="lazy"></iframe>`;
  const linkCode = `<a href="https://getbooqi.tech/salon/${businessId ?? ""}?src=widget" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111827;color:#fff;font:600 14px sans-serif;text-decoration:none">${t("branding.widgetButtonText")}</a>`;
  const { getPath } = useNavigation();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Cover and logo moved to the Photos page, which saves them as they change. They are not
  // in this form, so saving the colour here can never put back an older photo.
  const [form, setForm] = useState({ brandColor: "", receiptFooter: "", healthSafety: "", healthSafetyNote: "" });

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    businessService
      .getBusiness(businessId)
      .then(b => {
        setBusiness(b);
        setForm({
          brandColor: b.brandColor ?? "",
          receiptFooter: b.receiptFooter ?? "",
          healthSafety: (b.healthSafety ?? []).join(","),
          healthSafetyNote: b.healthSafetyNote ?? "",
        });
      })
      .catch(() => toast.error(t("branding.couldNotLoadYourBranding")))
      .finally(() => setLoading(false));
  }, [businessId]);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      // Sent even when blank so clearing a field removes it; the backend maps '' to null.
      setBusiness(await businessService.updateBusiness(businessId, form));
      toast.success(t("branding.brandingSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("branding.couldNotSaveYourBranding"));
    } finally {
      setSaving(false);
    }
  };

  const healthCodes = form.healthSafety ? form.healthSafety.split(",") : [];
  const healthLabels: [string, string][] = [
    ["STERILIZATION", t("branding.healthSterilization")],
    ["DISPOSABLE_TOOLS", t("branding.healthDisposable")],
    ["SINGLE_USE_LINEN", t("branding.healthLinen")],
    ["HAND_HYGIENE", t("branding.healthHands")],
  ];
  const toggleHealth = (code: string) => {
    const next = healthCodes.includes(code) ? healthCodes.filter(c => c !== code) : [...healthCodes, code];
    setForm({ ...form, healthSafety: next.join(",") });
  };

  const validColor = /^#[0-9a-fA-F]{6}$/.test(form.brandColor);
  const accent = validColor ? form.brandColor : null;
  const swatches = ["#6d4df2", "#e83e63", "#0f766e", "#b45309", "#1d4ed8", "#1f2937"];
  const name = business?.name || t("common.yourSalon");
  const today = formatLocaleDate(new Date(), { day: "numeric", month: "short", year: "numeric" });

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("branding.branding")}
          subtitle={t("branding.howYourSalonLooksTo")}
          actions={
            <Button className={primaryBtn} disabled={saving || loading} onClick={() => void save()}>
              {saving ? t("common.saving") : t("branding.saveBranding")}
            </Button>
          }
        />

        <div className={pageBody}>
          {loading ? (
            <div className="h-64 animate-pulse rounded-[20px] bg-white ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)]" aria-busy />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-6">
                <section className="rounded-[20px] bg-white p-4 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)] md:p-6">
                  <h2 className="text-base font-extrabold">{t("branding.brandColour")}</h2>
                  <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{t("branding.usedOnYourSalonProfile")}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("branding.suggestedColours")}>
                    {swatches.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={form.brandColor.toLowerCase() === c}
                        aria-label={c}
                        onClick={() => setForm(f => ({ ...f, brandColor: c }))}
                        className={cn("h-10 w-10 rounded-full ring-offset-2 transition hover:scale-105", form.brandColor.toLowerCase() === c && "ring-2 ring-[rgb(var(--reg-ink))]")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <span className="mx-1 h-6 w-px bg-[rgb(var(--reg-line))]" aria-hidden />
                    <label className="flex items-center gap-2">
                      <span className="sr-only">{t("branding.pickAnyColour")}</span>
                      <input
                        type="color"
                        className="h-10 w-12 cursor-pointer rounded-xl border border-[rgb(var(--reg-line))] bg-white p-1"
                        value={validColor ? form.brandColor : "#6d4df2"}
                        onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                      />
                    </label>
                    <input
                      aria-label={t("branding.brandColourHex")}
                      className={cn(fieldCls, "h-10 w-[130px] font-mono text-sm", form.brandColor && !validColor && "ring-2 ring-rose-400")}
                      value={form.brandColor}
                      onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                      placeholder="#6d4df2"
                      maxLength={9}
                    />
                    {form.brandColor && (
                      <button type="button" className="text-sm font-semibold text-[rgb(var(--reg-muted))] hover:underline" onClick={() => setForm(f => ({ ...f, brandColor: "" }))}>
                        {t("branding.useDefault")}
                      </button>
                    )}
                  </div>
                </section>

                <section className="rounded-[20px] bg-white p-4 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)] md:p-6">
                  <h2 className="text-base font-extrabold">{t("branding.receiptFooter")}</h2>
                  <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{t("branding.printedAtTheBottomOf")}</p>
                  <Textarea
                    aria-label={t("branding.receiptFooter")}
                    rows={3}
                    className="mt-4 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
                    value={form.receiptFooter}
                    onChange={e => setForm(f => ({ ...f, receiptFooter: e.target.value }))}
                    placeholder={t("branding.thankYouForVisitingReturns")}
                  />
                </section>

                <section className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-white p-4 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)] md:px-6">
                  <div>
                    <p className="font-semibold">{t("branding.coverLogoAndGallery")}</p>
                    <p className="text-sm text-[rgb(var(--reg-muted))]">{t("branding.photosHaveTheirOwnPage")}</p>
                  </div>
                  <Button variant="outline" className={secondaryBtn} asChild>
                    <Link to={getPath("photos")}>{t("branding.managePhotos")}</Link>
                  </Button>
                </section>
                <section className="rounded-2xl bg-white p-5 space-y-3">
                  <div>
                    <p className="text-sm font-bold">{t("branding.healthTitle")}</p>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">{t("branding.healthHint")}</p>
                  </div>
                  {healthLabels.map(([code, label]) => (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={healthCodes.includes(code)} onChange={() => toggleHealth(code)} />
                      {label}
                    </label>
                  ))}
                  <Textarea
                    rows={2}
                    maxLength={2000}
                    placeholder={t("branding.healthNote")}
                    value={form.healthSafetyNote}
                    onChange={(e) => setForm({ ...form, healthSafetyNote: e.target.value })}
                  />
                </section>
                <section className="rounded-2xl bg-white p-5 space-y-3">
                  <div>
                    <p className="text-sm font-bold">{t("branding.widgetTitle")}</p>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">{t("branding.widgetHint")}</p>
                  </div>
                  {([
                    ["script", t("branding.widgetScript"), widgetCode],
                    ["iframe", t("branding.widgetIframe"), iframeCode],
                    ["link", t("branding.widgetLink"), linkCode],
                  ] as const).map(([k, label, code]) => (
                    <div key={k} className="space-y-1.5">
                      <p className="text-xs font-semibold">{label}</p>
                      <textarea readOnly rows={k === "link" ? 4 : 3} aria-label={label} className={cn(fieldCls, "font-mono text-xs")} value={code} />
                      <Button
                        type="button"
                        variant="outline"
                        className={secondaryBtn}
                        onClick={() => {
                          navigator.clipboard?.writeText(code);
                          toast.success(t("branding.widgetCopied"));
                        }}
                      >
                        {t("branding.widgetCopy")}
                      </Button>
                    </div>
                  ))}
                </section>
              </div>

              <aside className="min-w-0 space-y-4 lg:sticky lg:top-[132px] lg:self-start">
                <ClientPreview where={t("common.yourSalonPage")}>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="truncate text-xl font-extrabold tracking-[-0.02em]">{name}</p>
                    {accent ? (
                      <span aria-hidden className="mt-3 block h-1 w-14 rounded-full" style={{ backgroundColor: accent }} />
                    ) : (
                      <p className="mt-2 text-xs text-[rgb(var(--reg-muted))]">{t("branding.noAccentBarWithoutA")}</p>
                    )}
                  </div>
                </ClientPreview>
                <ClientPreview where={t("branding.theirReceipt")}>
                  <div className="mx-auto max-w-[280px] rounded-xl bg-white px-5 py-4 font-mono text-[12px] leading-relaxed text-[rgb(var(--reg-ink))] shadow-[0_8px_20px_-14px_rgb(var(--reg-ink)/0.4)]">
                    <div className="h-1.5 -mx-5 -mt-4 mb-3 rounded-t-xl" style={{ backgroundColor: accent ?? "rgb(var(--reg-brand))" }} aria-hidden />
                    <p className="text-center text-[13px] font-bold">{name}</p>
                    <p className="text-center text-[rgb(var(--reg-muted))]">{today}</p>
                    <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                    <p className="flex justify-between"><span>{t("branding.womenSCut")}</span><span>45.00</span></p>
                    <p className="flex justify-between"><span>{t("branding.maskAddOn")}</span><span>12.00</span></p>
                    <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                    <p className="flex justify-between font-bold"><span>{t("common.total")}</span><span>57.00</span></p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-center text-[rgb(var(--reg-muted))]">
                      {form.receiptFooter.trim() || t("branding.yourFooterPrintsHere")}
                    </p>
                  </div>
                </ClientPreview>
              </aside>
            </div>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
