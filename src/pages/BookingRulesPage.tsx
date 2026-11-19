import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { ClientPreview, Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { CalendarCheck, CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { businessService, type Business } from "@/services/businessService";
import { getCurrentBusinessId } from "@/config/api";
import { getPlatformSettings } from "@/services/platformService";
import { BackToSettings, SaveBar } from "@/components/page/SettingsChrome";
import { SlotOffersCard } from "@/components/bookings/SlotOffersCard";
import { t } from "@/i18n";

/** One Setup row each; without a section the page shows all four (the old /booking-rules). */
export type BookingRulesSection = "online" | "cancellation" | "payment-methods" | "currency-tax";

/**
 * Setup listed "Booking Rules", "Cancellation Policy" and "Tax Settings" as three items —
 * two with no path at all and one that redirected to the staff page. They are the same
 * handful of numbers on the business record, so they are one screen rather than three
 * labels that go nowhere.
 *
 * Every field here changes what a customer is charged, so each says what it does in plain
 * words rather than leaving an owner to guess from a label.
 */
export default function BookingRulesPage({ section }: { section?: BookingRulesSection } = {}) {
  const businessId = getCurrentBusinessId();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    depositPercent: "",
    cancellationWindowHours: "",
    lateCancellationFee: "",
    currency: "",
    taxRate: "",
    minBookingNoticeMinutes: "",
    maxBookingDaysAhead: "",
  });
  const [onlineBooking, setOnlineBooking] = useState(true);
  const [methods, setMethods] = useState<string[]>(["CASH", "CARD"]);
  /** What was loaded or last saved, to know when the save bar is needed. */
  const [savedJson, setSavedJson] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [reviewUrlSaving, setReviewUrlSaving] = useState(false);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    businessService
      .getBusiness(businessId)
      .then(b => {
        setBusiness(b);
        const loaded = {
          depositPercent: b.depositPercent != null ? String(b.depositPercent) : "",
          cancellationWindowHours: b.cancellationWindowHours != null ? String(b.cancellationWindowHours) : "",
          lateCancellationFee: b.lateCancellationFee != null ? String(b.lateCancellationFee) : "",
          currency: b.currency ?? "",
          taxRate: b.taxRate != null ? String(b.taxRate) : "",
          minBookingNoticeMinutes: b.minBookingNoticeMinutes != null ? String(b.minBookingNoticeMinutes) : "",
          maxBookingDaysAhead: b.maxBookingDaysAhead != null ? String(b.maxBookingDaysAhead) : "",
        };
        const loadedOnline = b.onlineBookingEnabled !== false;
        const loadedMethods = (b.acceptedPaymentMethods ?? "CASH,CARD").split(",").map(m => m.trim()).filter(Boolean);
        setForm(loaded);
        setOnlineBooking(loadedOnline);
        setMethods(loadedMethods);
        setSavedJson(JSON.stringify({ form: loaded, onlineBooking: loadedOnline, methods: loadedMethods }));
      })
      .catch(() => toast.error(t("bookingRules.couldNotLoadYourBooking")))
      .finally(() => setLoading(false));
  }, [businessId]);

  // Whether a deposit can actually be collected. Unknown (null) until the platform answers.
  const [onlinePayments, setOnlinePayments] = useState<boolean | null>(null);
  useEffect(() => {
    getPlatformSettings()
      .then((p) => setOnlinePayments(p.onlinePayments === true))
      .catch(() => setOnlinePayments(null));
  }, []);

  useEffect(() => {
    setReviewUrl(business?.googleReviewUrl ?? "");
  }, [business]);

  const saveReviewUrl = async () => {
    if (!businessId) return;
    setReviewUrlSaving(true);
    try {
      const saved = await businessService.setGoogleReviewUrl(businessId, reviewUrl.trim());
      setBusiness((b) => (b ? { ...b, googleReviewUrl: saved.googleReviewUrl } : b));
      toast.success(t("bookingRules.reviewLinkSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("bookingRules.reviewLinkFailed"));
    } finally {
      setReviewUrlSaving(false);
    }
  };

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      // Blank means "leave as it was" — the backend COALESCEs nulls, so an empty field
      // must not be sent as 0 and quietly turn a 30% deposit into none.
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const updated = await businessService.updateBusiness(businessId, {
        depositPercent: num(form.depositPercent),
        cancellationWindowHours: num(form.cancellationWindowHours),
        lateCancellationFee: num(form.lateCancellationFee),
        taxRate: num(form.taxRate),
        onlineBookingEnabled: onlineBooking,
        minBookingNoticeMinutes: num(form.minBookingNoticeMinutes),
        maxBookingDaysAhead: num(form.maxBookingDaysAhead),
        // Always sent: an empty list is a real choice (a salon that takes no payment in
        // the app), so it must not be read as "unchanged".
        acceptedPaymentMethods: methods.join(","),
      });
      setBusiness(updated);
      setSavedJson(JSON.stringify({ form, onlineBooking, methods }));
      toast.success(t("bookingRules.bookingSettingsSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("bookingRules.couldNotSaveYourSettings"));
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    hint: string,
    props: Record<string, unknown> = {}
  ) => (
    <Field label={label} htmlFor={`br-${key}`} hint={hint}>
      <input
        id={`br-${key}`}
        className={fieldCls}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </Field>
  );

  const dirty = savedJson !== "" && JSON.stringify({ form, onlineBooking, methods }) !== savedJson;
  const discard = () => {
    if (!savedJson) return;
    const v = JSON.parse(savedJson) as { form: typeof form; onlineBooking: boolean; methods: string[] };
    setForm(v.form);
    setOnlineBooking(v.onlineBooking);
    setMethods(v.methods);
  };
  const show = (k: BookingRulesSection) => !section || section === k;
  const HEAD: Record<BookingRulesSection, { title: string; subtitle: string }> = {
    get online() { return { title: t("setup.onlineBooking"), subtitle: t("setup.onlineBookingSub") }; },
    get cancellation() { return { title: t("setup.cancellationPolicy"), subtitle: t("setup.cancellationSub") }; },
    get "payment-methods"() { return { title: t("bookingRules.paymentMethods"), subtitle: t("bookingRules.whatTheTillOffersWhen") }; },
    get "currency-tax"() { return { title: t("setup.currencyTax"), subtitle: t("setup.currencyTaxSub") }; },
  };
  // A single section reads as its own page: no repeated card title under the page title.
  const section_ = (icon: typeof CalendarCheck, title: string, children: React.ReactNode, tone?: string) =>
    section ? <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6"><div className="space-y-4">{children}</div></section> : sectionCard(icon, title, children, tone);
  const withPreview = !section || section === "online" || section === "cancellation";

  const sectionCard = (icon: typeof CalendarCheck, title: string, children: React.ReactNode, tone = "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]") => {
    const Icon = icon;
    return (
      <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}><Icon size={18} /></span>
          <h2 className="text-base font-extrabold">{title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
      </section>
    );
  };

  // What booqi-web's salon page says under "Before you book", from the values on screen.
  const hours = form.cancellationWindowHours.trim() === "" ? null : Number(form.cancellationWindowHours);
  const fee = form.lateCancellationFee.trim() === "" ? 0 : Number(form.lateCancellationFee);
  const deposit = form.depositPercent.trim() === "" ? 0 : Number(form.depositPercent);
  const sym = form.currency || "";
  const methodLabel: Record<string, string> = { get CASH() { return t("common.cash"); }, get CARD() { return t("bookingRules.cardInTheSalon"); }, get ONLINE() { return t("bookingRules.paidOnline"); }, get GIFT_CARD() { return t("bookingRules.giftCard"); } };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={section ? HEAD[section].title : t("bookingRules.bookingRules")}
          subtitle={section ? HEAD[section].subtitle : t("bookingRules.theRulesTheAppAnd")}
          actions={
            <Button className={cn(primaryBtn, "hidden md:inline-flex")} disabled={saving || loading || !dirty} onClick={() => void save()}>
              {saving ? t("common.saving") : dirty ? t("common.saveChanges") : t("common.saved")}
            </Button>
          }
        />

        <div className={pageBody}>
          {section && <BackToSettings />}
          {loading ? (
            <div className="h-72 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : (
            <div className={cn("grid gap-6", withPreview ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "max-w-3xl")}>
              <div className="min-w-0 space-y-6">
                {show("online") && section_(CalendarCheck, t("bookingRules.onlineBooking"), (
                  <>
                    <label htmlFor="br-online" className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-[rgb(var(--reg-canvas))] p-4">
                      <span>
                        <span className="block text-[15px] font-semibold">{t("bookingRules.acceptBookingsFromTheApp")}</span>
                        <span className="mt-0.5 block text-sm text-[rgb(var(--reg-muted))]">
                          {t("bookingRules.turnThisOffWhileYou")}
                        </span>
                      </span>
                      <Switch id="br-online" checked={onlineBooking} onCheckedChange={setOnlineBooking} className="data-[state=checked]:bg-[rgb(var(--reg-brand))]" />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field("minBookingNoticeMinutes", t("bookingRules.minimumNoticeMinutes"), t("bookingRules.howSoonFromNowSomeone"), { type: "number", min: 0, placeholder: "30" })}
                      {field("maxBookingDaysAhead", t("bookingRules.bookUpToDaysAhead"), t("bookingRules.howFarIntoTheFuture"), { type: "number", min: 1, max: 365, placeholder: "180" })}
                    </div>
                  </>
                ))}

                {show("cancellation") && section_(ShieldCheck, t("bookingRules.depositsAndCancellations"), (
                  <>
                    {/* Online payments off (v1: pay at the salon): the deposit and paid-online settings
                        are hidden, not deleted, so what was saved is kept for when they go live. */}
                    <div className={cn("grid gap-4", onlinePayments !== false ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                      {onlinePayments !== false && field("depositPercent", t("bookingRules.depositPct"), t("bookingRules.takenUpFrontABooking"), { type: "number", min: 0, max: 100, placeholder: "0" })}
                      {field("cancellationWindowHours", t("bookingRules.freeCancellationHours"), t("bookingRules.howLongBeforeTheAppointment"), { type: "number", min: 0, placeholder: "24" })}
                      {field("lateCancellationFee", t("bookingRules.lateCancellationFee"), t("bookingRules.chargedWhenTheyCancelInside"), { type: "number", min: 0, step: "0.01", placeholder: "0.00" })}
                    </div>
                  </>
                ), "bg-amber-50 text-amber-800")}

                {show("payment-methods") && section_(CreditCard, t("bookingRules.paymentMethods"), (
                  <>
                    {!section && <p className="text-sm text-[rgb(var(--reg-muted))]">{t("bookingRules.whatTheTillOffersWhen")}</p>}
                    <ul className="divide-y divide-[rgb(var(--reg-line)/0.6)] rounded-2xl ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      {[
                        { key: "CASH", label: t("common.cash") },
                        { key: "CARD", label: t("bookingRules.cardInTheSalon") },
                        { key: "ONLINE", label: t("bookingRules.paidOnline") },
                        { key: "GIFT_CARD", label: t("bookingRules.giftCard") },
                        // Packages and memberships are not being sold yet; offering them at the
                        // till would price a bill against something that cannot exist.
                        // { key: "PACKAGE", label: "Package" },
                        // { key: "MEMBERSHIP", label: "Membership" },
                      ].filter(m => m.key !== "ONLINE" || onlinePayments !== false).map(m => (
                        <li key={m.key}>
                          <label htmlFor={`br-m-${m.key}`} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                            <span className="text-[15px] font-semibold">{m.label}</span>
                            <Switch
                              id={`br-m-${m.key}`}
                              className="data-[state=checked]:bg-[rgb(var(--reg-brand))]"
                              checked={methods.includes(m.key)}
                              onCheckedChange={v =>
                                setMethods(prev => (v ? [...prev, m.key] : prev.filter(x => x !== m.key)))
                              }
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                ), "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]")}

                {show("online") && <SlotOffersCard businessId={businessId} />}
                {show("currency-tax") && section_(Receipt, t("bookingRules.currencyAndTax"), (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Read-only: the currency follows the salon's country, which comes from its
                        location. A hand-typed code here used to override it per salon. */}
                    <Field label={t("bookingRules.currency")} htmlFor="br-currency" hint={t("bookingRules.setAutomaticallyFromYourSalon")}>
                      <input id="br-currency" className={cn(fieldCls, "bg-[rgb(var(--reg-canvas))]")} value={form.currency || "—"} readOnly disabled />
                    </Field>
                    {field("taxRate", t("bookingRules.taxRate"), t("bookingRules.appliedToSalesOnReceipts"), { type: "number", min: 0, max: 100, step: "0.01", placeholder: "0" })}
                  </div>
                ), "bg-sky-50 text-sky-700")}
              </div>

              {withPreview && <aside className="min-w-0 lg:sticky lg:top-[132px] lg:self-start">
                <ClientPreview where={t("common.yourSalonPage")}>
                  <div className="rounded-2xl bg-white p-4">
                    <p className="mb-2 text-sm font-semibold">{t("bookingRules.beforeYouBook")}</p>
                    <ul className="space-y-1.5 text-sm text-[rgb(var(--reg-muted))]">
                      <li>
                        {hours == null || hours <= 0
                          ? t("bookingRules.cancelForFreeAnyTime")
                          : fee
                            ? t("bookingRules.freeUntilHBeforeThen", { hours, fee, sym })
                            : t("bookingRules.freeUntilHBefore", { hours })}
                      </li>
                      {deposit && onlinePayments !== false ? <li>{t("bookingRules.depositUpFrontTheRest", { deposit })}</li> : null}
                    </ul>
                    <div className="mt-4 border-t border-[rgb(var(--reg-line))] pt-3 text-sm">
                      {onlineBooking ? (
                        <p className="font-semibold text-[rgb(var(--reg-ink))]">
                          {t("bookingRules.bookableOnline")}
                          <span className="block text-xs font-normal text-[rgb(var(--reg-muted))]">
                            {form.minBookingNoticeMinutes ? t("bookingRules.atLeastMinAhead", { minBookingNoticeMinutes: form.minBookingNoticeMinutes }) : t("bookingRules.nextFreeSlot")}
                            {form.maxBookingDaysAhead ? t("bookingRules.upToDaysOut", { maxBookingDaysAhead: form.maxBookingDaysAhead }) : ""}
                          </span>
                        </p>
                      ) : (
                        <p className="font-semibold text-[rgb(var(--reg-ink))]">{t("bookingRules.bookingsByPhone")}</p>
                      )}
                    </div>
                  </div>
                </ClientPreview>
                <p className="mt-3 px-1 text-xs text-[rgb(var(--reg-muted))]">
                  {t("bookingRules.theTillTakes")}{" "}{methods.length ? methods.map((m) => methodLabel[m] ?? m).join(", ") : t("bookingRules.nothingSelected")}
                  {business?.currency ? t("bookingRules.pricesIn", { currency: business.currency }) : ""}
                </p>
              </aside>}
            </div>
          )}
        </div>

        <section className="mt-8 max-w-xl space-y-3 rounded-2xl p-4 ring-1 ring-[rgb(var(--reg-line))]">
          <Field label={t("bookingRules.googleReviewLink")} htmlFor="br-google-review" hint={t("bookingRules.googleReviewLinkHint")}>
            <div className="flex flex-wrap gap-2">
              <input
                id="br-google-review"
                type="url"
                className="h-10 w-full max-w-md rounded-xl border border-[rgb(var(--reg-line))] bg-transparent px-3 text-sm outline-none focus:border-[rgb(var(--reg-brand))]"
                placeholder="https://g.page/r/..."
                value={reviewUrl}
                onChange={(e) => setReviewUrl(e.target.value)}
              />
              <Button
                className={primaryBtn}
                disabled={reviewUrlSaving || reviewUrl.trim() === (business?.googleReviewUrl ?? "")}
                onClick={() => void saveReviewUrl()}
              >
                {t("common.save")}
              </Button>
            </div>
          </Field>
        </section>

        <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
      </BooqiScope>
    </AppLayout>
  );
}
