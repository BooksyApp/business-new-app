import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { Btn, Card, Field, FormGrid, RadioGroup, SectionCard, Skeleton, Toggle } from "@/components/bz";
import { BzSaveBar, SettingsFrame } from "@/components/bz/p3-Settings";
import { ClientPreview } from "@/components/page/kit";
import { ArrowDown, ArrowUp, CalendarCheck, CreditCard, Receipt, ShieldCheck, Users } from "lucide-react";
import { currencySymbol } from "@/lib/currency";
import { businessService, type Business, type StaffAssignmentMode } from "@/services/businessService";
import { staffService } from "@/services/staffService";
import { getCurrentBusinessId } from "@/config/api";
import { getPlatformSettings } from "@/services/platformService";
import { SlotOffersCard } from "@/components/bookings/SlotOffersCard";
import { t } from "@/i18n";
import type { Id } from "@/types/id";

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
  const [assignMode, setAssignMode] = useState<StaffAssignmentMode>("FAIR_EARNINGS");
  const [parallel, setParallel] = useState(false);
  /** Active staff in priority order; edited in place, saved with the rest. */
  const [order, setOrder] = useState<{ id: Id; name: string }[]>([]);
  const [savedOrder, setSavedOrder] = useState("");
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
        const loadedMode = b.staffAssignmentMode ?? "FAIR_EARNINGS";
        const loadedParallel = b.allowParallelServices === true;
        setMethods(loadedMethods);
        setAssignMode(loadedMode);
        setParallel(loadedParallel);
        setSavedJson(JSON.stringify({ form: loaded, onlineBooking: loadedOnline, methods: loadedMethods, assignMode: loadedMode, parallel: loadedParallel }));
      })
      .catch(() => toast.error(t("bookingRules.couldNotLoadYourBooking")))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    staffService
      .getAssignmentOrder(businessId)
      .then((list) => {
        const sorted = [...(list ?? [])].sort((a, b) => a.priority - b.priority).map((x) => ({ id: x.id, name: x.name }));
        setOrder(sorted);
        setSavedOrder(JSON.stringify(sorted.map((x) => x.id)));
      })
      .catch(() => setOrder([]));
  }, [businessId]);

  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

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
      const bad = (v: string, max?: number) => v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0 || (max !== undefined && Number(v) > max));
      if (bad(form.depositPercent, 100) || bad(form.taxRate, 100) || bad(form.cancellationWindowHours) || bad(form.lateCancellationFee) || bad(form.minBookingNoticeMinutes) || bad(form.maxBookingDaysAhead)) {
        toast.error(t("bookingRules.invalidRange"));
        setSaving(false);
        return;
      }
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
        staffAssignmentMode: assignMode,
        allowParallelServices: parallel,
      });
      if (assignMode === "PRIORITY" && JSON.stringify(order.map((x) => x.id)) !== savedOrder) {
        await staffService.setAssignmentOrder(businessId, order.map((x) => x.id));
        setSavedOrder(JSON.stringify(order.map((x) => x.id)));
      }
      setBusiness(updated);
      setSavedJson(JSON.stringify({ form, onlineBooking, methods, assignMode, parallel }));
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
    <Field label={label} hint={hint}>
      <input
        id={`br-${key}`}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </Field>
  );

  const orderDirty = assignMode === "PRIORITY" && savedOrder !== "" && JSON.stringify(order.map((x) => x.id)) !== savedOrder;
  const dirty = savedJson !== "" && (JSON.stringify({ form, onlineBooking, methods, assignMode, parallel }) !== savedJson || orderDirty);
  const discard = () => {
    if (!savedJson) return;
    const v = JSON.parse(savedJson) as { form: typeof form; onlineBooking: boolean; methods: string[]; assignMode: StaffAssignmentMode; parallel: boolean };
    setAssignMode(v.assignMode);
    setParallel(v.parallel);
    if (savedOrder) {
      const ids = JSON.parse(savedOrder) as Id[];
      setOrder((o) => [...o].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
    }
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
  const withPreview = !section || section === "online" || section === "cancellation";
  // A single section reads as its own page (no repeated card title); with all four it is a numbered card.
  let secN = 0;
  const section_ = (_icon: unknown, title: string, children: React.ReactNode, _tone?: string) =>
    section ? <div className="stk">{children}</div> : <SectionCard n={++secN} title={title}><div className="stk">{children}</div></SectionCard>;

  // What booqi-web's salon page says under "Before you book", from the values on screen.
  const hours = form.cancellationWindowHours.trim() === "" ? null : Number(form.cancellationWindowHours);
  const fee = form.lateCancellationFee.trim() === "" ? 0 : Number(form.lateCancellationFee);
  const deposit = form.depositPercent.trim() === "" ? 0 : Number(form.depositPercent);
  const sym = currencySymbol();
  const methodLabel: Record<string, string> = { get CASH() { return t("common.cash"); }, get CARD() { return t("bookingRules.cardInTheSalon"); }, get ONLINE() { return t("bookingRules.paidOnline"); }, get GIFT_CARD() { return t("bookingRules.giftCard"); } };

  return (
    <AppLayout>
      <SettingsFrame
        title={section ? HEAD[section].title : t("bookingRules.bookingRules")}
        sub={section ? HEAD[section].subtitle : t("bookingRules.theRulesTheAppAnd")}
        right={
          <Btn kind="v" disabled={saving || loading || !dirty} onClick={() => void save()}>
            {saving ? t("common.saving") : dirty ? t("common.saveChanges") : t("common.saved")}
          </Btn>
        }
      >
        {loading ? (
          <Skeleton />
        ) : (
          <>
            {show("online") && section_(CalendarCheck, t("bookingRules.onlineBooking"), (
              <>
                <Toggle title={t("bookingRules.acceptBookingsFromTheApp")} help={t("bookingRules.turnThisOffWhileYou")} checked={onlineBooking} onChange={setOnlineBooking} />
                <FormGrid cols={2}>
                  {field("minBookingNoticeMinutes", t("bookingRules.minimumNoticeMinutes"), t("bookingRules.howSoonFromNowSomeone"), { type: "number", min: 0, placeholder: "30" })}
                  {field("maxBookingDaysAhead", t("bookingRules.bookUpToDaysAhead"), t("bookingRules.howFarIntoTheFuture"), { type: "number", min: 1, max: 365, placeholder: "180" })}
                </FormGrid>
              </>
            ))}

            {show("cancellation") && section_(ShieldCheck, t("bookingRules.depositsAndCancellations"), (
              <>
                {/* Online payments off (v1: pay at the salon): the deposit and paid-online settings
                    are hidden, not deleted, so what was saved is kept for when they go live. */}
                <FormGrid cols={onlinePayments !== false ? 3 : 2}>
                  {onlinePayments !== false && field("depositPercent", t("bookingRules.depositPct"), t("bookingRules.takenUpFrontABooking"), { type: "number", min: 0, max: 100, placeholder: "0" })}
                  {field("cancellationWindowHours", t("bookingRules.freeCancellationHours"), t("bookingRules.howLongBeforeTheAppointment"), { type: "number", min: 0, placeholder: "24" })}
                  {field("lateCancellationFee", t("bookingRules.lateCancellationFee"), t("bookingRules.chargedWhenTheyCancelInside"), { type: "number", min: 0, step: "0.01", placeholder: "0.00" })}
                </FormGrid>
              </>
            ))}

            {show("payment-methods") && section_(CreditCard, t("bookingRules.paymentMethods"), (
              <>
                {!section && <span className="hint">{t("bookingRules.whatTheTillOffersWhen")}</span>}
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
                  <Toggle
                    key={m.key}
                    title={m.label}
                    checked={methods.includes(m.key)}
                    onChange={v => {
                      if (!v && methods.length <= 1 && methods.includes(m.key)) { toast.error(t("bookingRules.keepOneMethod")); return; }
                      setMethods(prev => (v ? [...prev, m.key] : prev.filter(x => x !== m.key)));
                    }}
                  />
                ))}
              </>
            ))}

            {show("online") && section_(Users, t("bookingRules.assignmentTitle"), (
              <>
                <RadioGroup
                  title={t("bookingRules.assignmentTitle")}
                  value={assignMode}
                  onChange={(v) => setAssignMode(v as StaffAssignmentMode)}
                  options={[
                    { value: "FAIR_EARNINGS", label: t("bookingRules.modeFair"), hint: t("bookingRules.modeFairHint") },
                    { value: "ROUND_ROBIN", label: t("bookingRules.modeRoundRobin"), hint: t("bookingRules.modeRoundRobinHint") },
                    { value: "PRIORITY", label: t("bookingRules.modePriority"), hint: t("bookingRules.modePriorityHint") },
                  ]}
                />
                {assignMode === "PRIORITY" && (
                  <>
                    <div className="lbl2">{t("bookingRules.priorityOrder")}</div>
                    {order.length === 0 ? (
                      <span className="hint">{t("bookingRules.priorityEmpty")}</span>
                    ) : (
                      <div className="stk">
                        {order.map((s, i) => (
                          <div key={String(s.id)} className="lr">
                            <span style={{ width: 20, color: "var(--bz-muted)" }}>{i + 1}</span>
                            <div className="tx"><b>{s.name}</b></div>
                            <span className="acts">
                              <Btn kind="ol" disabled={i === 0} aria-label={t("bookingRules.moveUp")} onClick={() => move(i, -1)} icon={<ArrowUp size={16} />} />
                              <Btn kind="ol" disabled={i === order.length - 1} aria-label={t("bookingRules.moveDown")} onClick={() => move(i, 1)} icon={<ArrowDown size={16} />} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <Toggle title={t("bookingRules.parallelTitle")} help={t("bookingRules.parallelHint")} checked={parallel} onChange={setParallel} />
              </>
            ))}

            {show("online") && <SlotOffersCard businessId={businessId} />}
            {show("currency-tax") && section_(Receipt, t("bookingRules.currencyAndTax"), (
              <FormGrid cols={2}>
                {/* Read-only: the currency follows the salon's country, which comes from its
                    location. A hand-typed code here used to override it per salon. */}
                <Field label={t("bookingRules.currency")} hint={t("bookingRules.setAutomaticallyFromYourSalon")} disabled>
                  <input id="br-currency" value={form.currency || "—"} readOnly disabled />
                </Field>
                {field("taxRate", t("bookingRules.taxRate"), t("bookingRules.appliedToSalesOnReceipts"), { type: "number", min: 0, max: 100, step: "0.01", placeholder: "0" })}
              </FormGrid>
            ))}

            {withPreview && (
              <>
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
                <span className="hint">
                  {t("bookingRules.theTillTakes")}{" "}{methods.length ? methods.map((m) => methodLabel[m] ?? m).join(", ") : t("bookingRules.nothingSelected")}
                  {business?.currency ? t("bookingRules.pricesIn", { currency: currencySymbol() }) : ""}
                </span>
              </>
            )}

            {/* Belongs with online booking only: it showed under every settings sub-page. */}
            {show("online") && (
              <Card>
                <Field label={t("bookingRules.googleReviewLink")} hint={t("bookingRules.googleReviewLinkHint")}>
                  <input id="br-google-review" type="url" placeholder="https://g.page/r/..." value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} />
                </Field>
                <div>
                  <Btn kind="ol" disabled={reviewUrlSaving || reviewUrl.trim() === (business?.googleReviewUrl ?? "")} onClick={() => void saveReviewUrl()}>
                    {t("common.save")}
                  </Btn>
                </div>
              </Card>
            )}
          </>
        )}
        <BzSaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={discard} />
      </SettingsFrame>
    </AppLayout>
  );
}
