import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { Check, Copy } from "lucide-react";
import { Btn, Card, CheckRow, Field, Skeleton } from "@/components/bz";
import { SettingsFrame } from "@/components/bz/p3-Settings";
import { ClientPreview } from "@/components/page/kit";
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
      <SettingsFrame
        title={t("branding.branding")}
        sub={t("branding.howYourSalonLooksTo")}
        right={
          <Btn kind="v" disabled={saving || loading} onClick={() => void save()}>
            {saving ? t("common.saving") : t("branding.saveBranding")}
          </Btn>
        }
      >
        {loading ? (
          <Skeleton />
        ) : (
          <>
            <Card title={t("branding.brandColour")} help={t("branding.usedOnYourSalonProfile")}>
              <div className="colr">
                <span className="sw3" aria-hidden style={{ background: validColor ? form.brandColor : "var(--bz-violet)" }} />
                <Field label={t("branding.brandColourHex")} hint={form.brandColor && !validColor ? "#rrggbb" : undefined} error={form.brandColor && !validColor ? "#rrggbb" : undefined}>
                  <input aria-label={t("branding.brandColourHex")} value={form.brandColor} onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))} placeholder="#6d4df2" maxLength={9} />
                </Field>
                <input
                  type="color"
                  aria-label={t("branding.pickAnyColour")}
                  title={t("branding.pickAnyColour")}
                  style={{ width: 48, height: 44, borderRadius: 12, border: "1px solid var(--bz-line)", background: "var(--bz-surface)", padding: 4, cursor: "pointer" }}
                  value={validColor ? form.brandColor : "#6d4df2"}
                  onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                />
              </div>
              <div className="row gap8" role="radiogroup" aria-label={t("branding.suggestedColours")}>
                {swatches.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={form.brandColor.toLowerCase() === c}
                    aria-label={c}
                    onClick={() => setForm(f => ({ ...f, brandColor: c }))}
                    style={{ width: 40, height: 40, borderRadius: 12, border: 0, backgroundColor: c, cursor: "pointer", boxShadow: form.brandColor.toLowerCase() === c ? "0 0 0 2px var(--bz-surface), 0 0 0 4px var(--bz-ink)" : "none" }}
                  />
                ))}
                {form.brandColor && (
                  <Btn kind="ol" onClick={() => setForm(f => ({ ...f, brandColor: "" }))}>{t("branding.useDefault")}</Btn>
                )}
              </div>
            </Card>

            <Card title={t("branding.receiptFooter")}>
              <Field label={t("branding.receiptFooter")} kind="ta" hint={t("branding.printedAtTheBottomOf")}>
                <textarea aria-label={t("branding.receiptFooter")} rows={3} value={form.receiptFooter} onChange={e => setForm(f => ({ ...f, receiptFooter: e.target.value }))} placeholder={t("branding.thankYouForVisitingReturns")} />
              </Field>
            </Card>

            <Card title={t("branding.coverLogoAndGallery")}>
              <span className="hint">{t("branding.photosHaveTheirOwnPage")}</span>
              <div>
                <Link to={getPath("photos")} className="btn btn-ol s" style={{ textDecoration: "none" }}>{t("branding.managePhotos")}</Link>
              </div>
            </Card>

            <Card title={t("branding.healthTitle")} help={t("branding.healthHint")}>
              {healthLabels.map(([code, label]) => (
                <CheckRow key={code} label={label} checked={healthCodes.includes(code)} icon={<Check className="ic" />} onChange={() => toggleHealth(code)} />
              ))}
              <Field label={t("branding.healthNote")} kind="ta">
                <textarea rows={2} maxLength={2000} placeholder={t("branding.healthNote")} value={form.healthSafetyNote} onChange={(e) => setForm({ ...form, healthSafetyNote: e.target.value })} />
              </Field>
            </Card>

            <Card title={t("branding.widgetTitle")} help={t("branding.widgetHint")}>
              {([
                ["script", t("branding.widgetScript"), widgetCode],
                ["iframe", t("branding.widgetIframe"), iframeCode],
                ["link", t("branding.widgetLink"), linkCode],
              ] as const).map(([k, label, code]) => (
                <div key={k} className="stk">
                  <div className="cd"><b>{label}</b><br /><textarea readOnly rows={k === "link" ? 4 : 3} aria-label={label} style={{ width: "100%", background: "transparent", color: "inherit", border: 0, font: "inherit", resize: "none", outline: 0 }} value={code} /></div>
                  <div>
                    <Btn
                      kind="soft"
                      icon={<Copy className="ic" />}
                      onClick={() => {
                        navigator.clipboard?.writeText(code);
                        toast.success(t("branding.widgetCopied"));
                      }}
                    >
                      {t("branding.widgetCopy")}
                    </Btn>
                  </div>
                </div>
              ))}
            </Card>

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
          </>
        )}
      </SettingsFrame>
    </AppLayout>
  );
}
