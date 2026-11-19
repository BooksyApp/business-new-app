import { AppLayout } from "@/components/layout/AppLayout";
import { SalonQrCard } from "@/components/SalonQrCard";
import { ShareKitCard } from "@/components/ShareKitCard";
import { subscriptionService, type SubscriptionStatus } from "@/services/subscriptionService";
import { Check, Copy, ExternalLink, Eye, MapPin, Pencil, Share2 } from "lucide-react";
import { BooqiScope, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ClientPreview, Field, Meter, SectionTitle } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { categoryService, type BusinessCategory } from "@/services/categoryService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { businessService, type Business } from "@/services/businessService";
import { serviceService, type Service } from "@/services/serviceService";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PaymentReturnBanner } from "@/components/page/PaymentReturnBanner";
import { useNavigation } from "@/utils/navigationUtils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPrice } from "@/lib/currency";
import { reviewService, type Review, type RatingSummary } from "@/services/reviewService";
import { ImageUploadField } from "@/components/media/ImageUploadField";
import { assetUrl, getCurrentBusinessId, publicSiteUrl, salonShareUrl } from "@/config/api";
import { t, fmtDate as formatLocaleDate, formatMinutes } from "@/i18n";

function formatMoney(value?: number) {
  if (typeof value !== "number") return t("business.priceNotSet");
  // With the salon's currency: a bare "120.00" said nothing about which money.
  return formatPrice(value);
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return "";
  return formatMinutes(minutes);
}

function formatAddress(business: Business | null) {
  if (!business) return t("business.addressNotSet");
  const parts = [
    business.address,
    business.buildingNumber,
    business.city,
    business.state,
    business.zipCode,
    business.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t("business.addressNotSet");
}

function getCompletenessChecks(business: Business | null, services: Service[]) {
  return [
    { label: t("common.businessName"), ok: Boolean(business?.name?.trim()) },
    { label: t("common.address"), ok: Boolean(formatAddress(business) !== t("business.addressNotSet")) },
    { label: t("business.locationCoordinates"), ok: typeof business?.latitude === "number" && typeof business?.longitude === "number" },
    { label: t("business.contactPhoneEmail"), ok: Boolean(business?.phone || business?.email) },
    { label: t("business.atLeastOneService"), ok: services.length > 0 },
  ];
}

export default function BusinessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subscribedFlag = searchParams.get("subscribed");
  const { getPath } = useNavigation();
  const [copied, setCopied] = useState(false);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", description: "", address: "", category: "", website: "", email: "", coverImageUrl: "",
    // #37: empty means "leave unchanged" — the backend COALESCEs each column, so a blank
    // field must not be sent as 0 and silently wipe a configured policy.
    depositPercent: "", cancellationWindowHours: "", lateCancellationFee: ""
  });
  const [saving, setSaving] = useState(false);

  // #42: the Stripe subscription module shipped complete — status, checkout, webhook —
  // with zero UI, so a business could not subscribe or upgrade from the manager app at
  // all. Plan keys come from the server (stripe.billing.plans); hardcoding a list here
  // would drift from the configuration silently.
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<string[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);

  // The card said "Reviews are coming soon" whatever the salon had: reviews have been
  // live (web, app, reply from the manager) for a while.
  useEffect(() => {
    const id = getCurrentBusinessId();
    if (!id) return;
    reviewService.getByBusiness(id).then((r) => setReviews(r || [])).catch(() => setReviews([]));
    reviewService.getSummary(id).then(setRatingSummary).catch(() => setRatingSummary(null));
  }, []);

  useEffect(() => {
    // An empty list leaves the picker empty rather than falling back to a private copy
    // of the options: two lists that can disagree is the problem this replaces.
    categoryService.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const id = getCurrentBusinessId();
    if (!id) return;
    subscriptionService.getStatus(id).then(setSubscription).catch(() => setSubscription(null));
    subscriptionService.getPlans().then((p) => setPlans(p || [])).catch(() => setPlans([]));
  }, []);

  // Back from Stripe: the billing webhook activates the plan, which can trail the redirect by
  // a few seconds. Re-read the status a handful of times; never trust the redirect itself.
  const subscriptionActive = ["ACTIVE", "TRIALING"].includes((subscription?.status ?? "").toUpperCase());
  useEffect(() => {
    if (subscribedFlag !== "1" || subscriptionActive) return;
    const id = getCurrentBusinessId();
    if (!id) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 12) clearInterval(timer);
      else subscriptionService.getStatus(id).then(setSubscription).catch(() => undefined);
    }, 2500);
    return () => clearInterval(timer);
  }, [subscribedFlag, subscriptionActive]);

  const startCheckout = async (planKey: string) => {
    const id = getCurrentBusinessId();
    if (!id) return;
    setCheckoutBusy(true);
    try {
      // Stripe hosts the payment page; leaving the app is the intended flow.
      window.location.href = await subscriptionService.createCheckout(id, planKey);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("business.couldNotStartCheckout"));
      setCheckoutBusy(false);
    }
  };

  // The salon's page on the public site — same host, /salon/{id} (booqi-web). It used to
  // be a made-up "<name>.booksy.com" that Share and Preview sent customers to.
  const publicUrl = useMemo(() => {
    if (!business?.id) return "";
    return `${publicSiteUrl()}/salon/${business.slug ?? business.id}`;
  }, [business?.id, business?.slug]);
  // What the salon copies and shares (Instagram bio, website): tagged so its bookings count as its own.
  const shareUrl = useMemo(() => salonShareUrl(publicUrl, "link"), [publicUrl]);

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    const businessId = getCurrentBusinessId();

    if (!accessToken || !businessId) {
      setError(t("business.missingBusinessContextPleaseLog"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    Promise.all([
      businessService.getBusiness(businessId, accessToken),
      serviceService.getServicesByBusiness(businessId),
    ])
      .then(([businessPayload, servicePayload]) => {
        setBusiness(businessPayload);
        setServices(Array.isArray(servicePayload) ? servicePayload : []);
        // Pre-populate edit form
        setEditForm({
          name: businessPayload.name ?? "",
          phone: businessPayload.phone ?? "",
          description: businessPayload.description ?? "",
          address: businessPayload.address ?? "",
          category: businessPayload.category ?? "",
          website: businessPayload.website ?? "",
          coverImageUrl: businessPayload.coverImageUrl ?? "",
          email: businessPayload.email ?? "",
          depositPercent: businessPayload.depositPercent != null ? String(businessPayload.depositPercent) : "",
          cancellationWindowHours: businessPayload.cancellationWindowHours != null ? String(businessPayload.cancellationWindowHours) : "",
          lateCancellationFee: businessPayload.lateCancellationFee != null ? String(businessPayload.lateCancellationFee) : "",
        });
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : t("business.couldNotLoadBusinessData"));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleCopyUrl = () => {
    if (!publicUrl) return;
    const normalized = shareUrl.startsWith("http") ? shareUrl : `https://${shareUrl}`;
    navigator.clipboard.writeText(normalized);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditProfile = () => {
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    const businessId = getCurrentBusinessId();
    if (!businessId) return;
    // Founder decision: a salon always has a category.
    if (!editForm.category) {
      toast.error(t("business.categoryRequired"));
      return;
    }
    setSaving(true);
    try {
      const updated = await businessService.updateBusiness(businessId, {
        name: editForm.name,
        phone: editForm.phone || undefined,
        description: editForm.description || undefined,
        address: editForm.address || undefined,
        category: editForm.category || undefined,
        website: editForm.website || undefined,
        // customer-app #4: sent even when blank, so clearing the field actually removes
        // the photo. The backend maps '' to null; undefined would leave it as it was.
        coverImageUrl: editForm.coverImageUrl,
        email: editForm.email || undefined,
        // #37: only send what was actually filled in. undefined leaves the column alone.
        // Deposits and late fees need online payment (not in v1): left untouched.
        cancellationWindowHours: editForm.cancellationWindowHours.trim() !== "" ? Number(editForm.cancellationWindowHours) : undefined,
      });
      setBusiness(updated);
      setEditOpen(false);
      toast.success(t("business.businessProfileUpdated"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("business.failedToSaveChanges"));
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (!publicUrl) return;
    const normalized = publicUrl.startsWith("http") ? publicUrl : `https://${publicUrl}`;
    window.open(normalized, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (!publicUrl) return;
    const normalized = shareUrl.startsWith("http") ? shareUrl : `https://${shareUrl}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: business?.name || t("common.businessProfile"),
          text: t("business.checkOutOurBookingProfile"),
          url: normalized,
        });
        return;
      }
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore share errors (cancelled dialog, permission, etc.)
    }
  };

  const completenessChecks = useMemo(() => getCompletenessChecks(business, services), [business, services]);
  const completedCount = completenessChecks.filter((check) => check.ok).length;
  // LR-02: a salon without a single service cannot be booked, so it is never "Advanced"
  // (it said "80% Advanced" next to the "add a service" banner): at most 60%, "Growing".
  const completionPercent = Math.min(services.length === 0 ? 60 : 100, Math.round((completedCount / completenessChecks.length) * 100));
  const completionTier = t(completionPercent >= 80 ? "business.tierAdvanced" : completionPercent >= 50 ? "business.tierGrowing" : "business.tierNovice");
  const hasCoords = typeof business?.latitude === "number" && typeof business?.longitude === "number";
  const locationLabel =
    hasCoords
      ? `${business.latitude!.toFixed(5)}, ${business.longitude!.toFixed(5)}`
      : t("business.locationNotSet");
  const mapsUrl =
    hasCoords
      ? `https://www.google.com/maps?q=${business?.latitude},${business?.longitude}`
      : "";
  const mapsEmbedUrl =
    hasCoords
      ? `https://www.google.com/maps?q=${business?.latitude},${business?.longitude}&z=14&output=embed`
      : "";

  const cover = editOpen ? editForm.coverImageUrl : business?.coverImageUrl;
  const previewName = (editOpen ? editForm.name : business?.name) || t("common.yourSalon");
  const previewCategory = (editOpen ? editForm.category : business?.category) || "";
  const categoryLabel = categories.find((c) => c.name === previewCategory)?.label ?? previewCategory;
  const previewAddress = editOpen ? editForm.address || formatAddress(business) : formatAddress(business);
  const setF = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm((f) => ({ ...f, [k]: e.target.value }));

  /** The salon's header on booqi-web, drawn from whatever is in hand (saved or being edited). */
  const webCard = (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-[rgb(var(--reg-line))]">
      <div className="relative aspect-[16/7] bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))]">
        {cover ? <img src={assetUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
      </div>
      <div className="p-4">
        <p className="truncate text-xl font-extrabold tracking-[-0.02em]">{previewName}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[rgb(var(--reg-muted))]">
          <MapPin size={14} aria-hidden /> <span className="truncate">{previewAddress}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ratingSummary?.average != null && (ratingSummary.count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-3 py-1 text-xs font-bold">
              ★ {ratingSummary.average.toFixed(1)} <span className="font-normal text-[rgb(var(--reg-muted))]">({ratingSummary.count})</span>
            </span>
          )}
          {categoryLabel && (
            <span className="rounded-full bg-[rgb(var(--reg-brand-soft))] px-3 py-1 text-xs font-semibold capitalize text-[rgb(var(--reg-brand-strong))]">{categoryLabel}</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("common.businessProfile")}
          subtitle={t("business.whatClientsSeeWhenThey")}
          actions={
            <>
              <Button variant="outline" className={cn(secondaryBtn, "hidden sm:inline-flex")} onClick={handlePreview} disabled={!publicUrl}>
                <Eye size={16} />{" "}{t("business.preview")}
              </Button>
              <Button variant="outline" className={secondaryBtn} onClick={handleShare} disabled={!publicUrl} aria-label={t("business.sharePublicProfile")}>
                <Share2 size={16} /> <span className="hidden sm:inline">{t("business.share")}</span>
              </Button>
              <Button className={primaryBtn} onClick={handleEditProfile} disabled={!business}>
                <Pencil size={16} />{" "}{t("business.editProfile")}
              </Button>
            </>
          }
        />

        <div className={pageBody}>
          <PaymentReturnBanner kind="subscription" flag={subscribedFlag} confirmed={subscriptionActive} />
          {error ? (
            <div className="rounded-[20px] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">{error}</div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <ClientPreview where={t("common.yourSalonPage")}>
                {isLoading ? <div className="aspect-[16/9] animate-pulse rounded-2xl bg-white" /> : webCard}
              </ClientPreview>

              <button
                type="button"
                onClick={handleCopyUrl}
                disabled={!publicUrl}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-[rgb(var(--reg-line)/0.8)] transition hover:ring-[rgb(var(--reg-brand)/0.4)] disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("business.yourBookingLink")}</span>
                  <span className="block truncate text-sm font-semibold">{shareUrl || t("business.publicUrlUnavailable")}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[rgb(var(--reg-brand-strong))]">
                  {copied ? <><Check size={15} />{" "}{t("business.copied")}</> : <><Copy size={15} />{" "}{t("common.copy")}</>}
                </span>
              </button>

              <SalonQrCard salonUrl={publicUrl} salonName={business?.slug ?? business?.name} />
              <ShareKitCard salonUrl={publicUrl} salonName={business?.name ?? ""} businessId={String(business?.id ?? "")} />

              <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
                <SectionTitle>{t("business.about")}</SectionTitle>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[rgb(var(--reg-ink)/0.85)]">
                  {business?.description || <span className="text-[rgb(var(--reg-muted))]">{t("business.noDescriptionYetTwoLines")}</span>}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  {[
                    [t("common.phone"), business?.phone],
                    [t("common.email"), business?.email],
                    [t("business.website"), business?.website],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0 rounded-xl bg-[rgb(var(--reg-canvas))] px-3 py-2">
                      <dt className="text-[11px] font-semibold text-[rgb(var(--reg-muted))]">{k}</dt>
                      <dd className="truncate font-semibold">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <div className="grid md:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="p-5 md:p-6">
                    <SectionTitle>{t("business.location")}</SectionTitle>
                    <p className="flex items-start gap-2 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-[rgb(var(--reg-muted))]" /> {formatAddress(business)}</p>
                    <p className="mt-2 text-xs text-[rgb(var(--reg-muted))]">{locationLabel}</p>
                    {hasCoords && mapsUrl ? (
                      <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline">
                        {t("business.openInMaps")}{" "}<ExternalLink size={13} />
                      </a>
                    ) : null}
                  </div>
                  {mapsEmbedUrl ? (
                    <iframe title={t("business.businessLocationMap")} src={mapsEmbedUrl} className="h-48 w-full border-0 md:h-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-[rgb(var(--reg-canvas))] px-4 text-center text-xs text-[rgb(var(--reg-muted))] md:h-full">
                      <span><MapPin size={20} className="mx-auto mb-1.5" />{" "}{t("business.locationCoordinatesAreNotSet")}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
                <SectionTitle aside={<button type="button" className="text-sm font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline" onClick={() => navigate(getPath("items-category"))}>{t("business.editMenu")}</button>}>
                  {t("common.services")}
                </SectionTitle>
                {services.length ? (
                  <ul className="divide-y divide-[rgb(var(--reg-line)/0.6)]">
                    {services.slice(0, 6).map((service) => (
                      <li key={service.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{service.name}</span>
                          <span className="block text-xs text-[rgb(var(--reg-muted))]">
                            {[formatDuration(service.durationMinutes), service.categoryName].filter(Boolean).join(" · ") || t("business.noDuration")}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(service.price)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[rgb(var(--reg-muted))]">{t("business.noServicesAddedYet")}</p>
                )}
                {services.length > 6 && <p className="mt-2 text-xs text-[rgb(var(--reg-muted))]">{t("business.moreOnYourMenu", { value: services.length - 6 })}</p>}
              </section>
            </div>

            <aside className="min-w-0 space-y-4">
              <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{t("business.profileCompleteness")}</p>
                  <span className="text-sm font-bold">{completionTier}</span>
                </div>
                <p className="mt-1 text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{completionPercent}%</p>
                <Meter className="mt-3" value={completedCount} max={completenessChecks.length} label={t("business.ofCompleted", { completedCount, count: completenessChecks.length })} />
                <ul className="mt-4 space-y-2">
                  {completenessChecks.map((c) => (
                    <li key={c.label} className="flex items-center gap-2 text-sm">
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-[rgb(var(--reg-success))] text-white" : "ring-2 ring-inset ring-[rgb(var(--reg-line))]")}>
                        {c.ok && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className={c.ok ? "" : "font-semibold"}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <SectionTitle aside={reviews.length > 0 ? <button type="button" onClick={() => navigate(getPath("reviews"))} className="text-sm font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline">{t("business.seeAllAndReply")}</button> : undefined}>
                  {t("common.reviews")}
                </SectionTitle>
                {reviews.length === 0 ? (
                  <p className="text-sm text-[rgb(var(--reg-muted))]">{t("business.noReviewsYetClientsCan")}</p>
                ) : (
                  <>
                    <p className="text-sm">
                      <span className="text-2xl font-extrabold">{ratingSummary?.average != null ? ratingSummary.average.toFixed(1) : "–"}</span>{" "}{t("business.from")}{" "}
                      {t("business.reviewCount", { count: ratingSummary?.count ?? reviews.length })}
                    </p>
                    <ul className="mt-3 space-y-3">
                      {reviews.slice(0, 3).map((r) => (
                        <li key={r.id} className="border-t border-[rgb(var(--reg-line)/0.6)] pt-3 text-sm">
                          <span className="font-semibold text-amber-600">{"★".repeat(r.rating)}</span>{" "}
                          <span className="text-[rgb(var(--reg-muted))]">{r.authorName ?? t("business.aClient")}</span>
                          {r.comment && <p className="mt-1 line-clamp-3">{r.comment}</p>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              {/* #42: subscription state and upgrade path (the salon's booqi plan). */}
              <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <SectionTitle>{t("business.yourBooqiPlan")}</SectionTitle>
                <p className="text-sm text-[rgb(var(--reg-ink)/0.85)]">
                  {subscription && subscription.status !== "NONE" ? (
                    <>
                      {t("business.plan")}{" "}<span className="font-semibold">{subscription.planKey || "—"}</span> · {subscription.status}
                      {subscription.currentPeriodEnd ? t("business.renews", { value: formatLocaleDate(new Date(subscription.currentPeriodEnd), { year: "numeric", month: "numeric", day: "numeric" }) }) : ""}
                    </>
                  ) : (
                    t("business.noActiveSubscription")
                  )}
                </p>
                {plans.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plans.map((planKey) => (
                      <Button
                        key={planKey}
                        variant="outline"
                        className={secondaryBtn}
                        disabled={checkoutBusy || subscription?.planKey === planKey}
                        onClick={() => startCheckout(planKey)}
                      >
                        {subscription?.planKey === planKey ? t("business.planCurrent", { planKey }) : t("business.choose", { planKey })}
                      </Button>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>

        <FormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          title={t("business.editBusinessProfile")}
          description={t("business.changesShowOnBooqiAs")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setEditOpen(false)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} onClick={handleSaveProfile} disabled={saving || !editForm.name.trim()}>
                {saving ? t("common.saving") : t("common.saveChanges")}
              </Button>
            </>
          }
        >
          <ClientPreview where={t("common.yourSalonPage")}>{webCard}</ClientPreview>

          <FormSection title={t("business.basics")}>
            <Field label={t("common.businessName")} htmlFor="bz-name">
              <input id="bz-name" className={fieldCls} value={editForm.name} onChange={setF("name")} />
            </Field>
            <Field label={`${t("common.category")} *`}>
              <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-12 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base">
                  <SelectValue placeholder={t("business.chooseACategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.name}>{c.label ?? c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("business.description")} htmlFor="bz-desc" hint={`${editForm.description.length} characters`}>
              <Textarea id="bz-desc" rows={4} className="rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base" value={editForm.description} onChange={setF("description")} placeholder={t("business.whatYouDoBestIn")} />
            </Field>
          </FormSection>

          <FormSection title={t("business.coverPhoto")}>
            {/* customer-app #4: without this the salon shows a stock photo, same as every other salon. */}
            <ImageUploadField
              label={t("business.coverPhoto")}
              purpose="BUSINESS_COVER"
              shape="wide"
              value={editForm.coverImageUrl}
              onChange={(url) => setEditForm((f) => ({ ...f, coverImageUrl: url }))}
              hint={t("business.shownToCustomersOnThe")}
            />
          </FormSection>

          <FormSection title={t("business.contact")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("common.phone")} htmlFor="bz-phone">
                <input id="bz-phone" type="tel" className={fieldCls} value={editForm.phone} onChange={setF("phone")} />
              </Field>
              <Field label={t("common.email")} htmlFor="bz-email">
                <input id="bz-email" type="email" className={fieldCls} value={editForm.email} onChange={setF("email")} />
              </Field>
            </div>
            <Field label={t("business.website")} htmlFor="bz-web">
              <input id="bz-web" className={fieldCls} value={editForm.website} onChange={setF("website")} placeholder="https://example.com" />
            </Field>
          </FormSection>

          <FormSection title={t("business.location")}>
            <Field label={t("common.address")} htmlFor="bz-address">
              <input id="bz-address" className={fieldCls} value={editForm.address} onChange={setF("address")} placeholder={t("business.streetNumber")} />
            </Field>
          </FormSection>

          {/* #37: cancellation policy. Empty keeps the current value. Deposits and late
              fees need online payment, which v1 does not take (clients pay at the salon),
              so those two stay off this form; their values are left untouched. */}
          <FormSection title={t("common.cancellations")}>
            <Field label={t("business.freeCancellationUpToHours")} htmlFor="bz-cancel" hint={t("business.emptyKeepsTheCurrentSetting")}>
              <input id="bz-cancel" type="number" min={0} step={1} className={fieldCls} value={editForm.cancellationWindowHours} onChange={setF("cancellationWindowHours")} placeholder="24" />
            </Field>
          </FormSection>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{title}</h3>
      {children}
    </section>
  );
}
