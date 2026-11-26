import { AppLayout } from "@/components/layout/AppLayout";
import { SalonQrCard } from "@/components/SalonQrCard";
import { ShareKitCard } from "@/components/ShareKitCard";
import { subscriptionService, type SubscriptionStatus } from "@/services/subscriptionService";
import { Check, Copy, ExternalLink, Eye, MapPin, Pencil, Share2, X } from "lucide-react";
import { Btn, Card, CheckRow, Drawer, Field, FormGrid, FormSection, Note, PageHead, RowItem, SelectField, Skeleton, StatusPill } from "@/components/bz";
import { BzPage } from "@/components/bz/p3-Settings";
import { ClientPreview, Meter } from "@/components/page/kit";
import { useEffect, useMemo, useState } from "react";
import { categoryService, type BusinessCategory } from "@/services/categoryService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { businessService, type Business } from "@/services/businessService";
import { serviceService, type Service } from "@/services/serviceService";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PaymentReturnBanner } from "@/components/page/PaymentReturnBanner";
import { useNavigation } from "@/utils/navigationUtils";
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

  // The drawer has no Radix shell: Escape closes it, as the sheet did.
  useEffect(() => {
    if (!editOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editOpen]);

  return (
    <AppLayout>
      <BzPage>
        <PageHead
          title={t("common.businessProfile")}
          sub={t("business.whatClientsSeeWhenThey")}
          right={
            <>
              <Btn kind="ol" icon={<Eye size={16} />} onClick={handlePreview} disabled={!publicUrl}>{t("business.preview")}</Btn>
              <Btn kind="ol" icon={<Share2 size={16} />} onClick={handleShare} disabled={!publicUrl} aria-label={t("business.sharePublicProfile")}>{t("business.share")}</Btn>
              <Btn kind="v" icon={<Pencil size={16} />} onClick={handleEditProfile} disabled={!business}>{t("business.editProfile")}</Btn>
            </>
          }
        />

        <div className="stk">
          <PaymentReturnBanner kind="subscription" flag={subscribedFlag} confirmed={subscriptionActive} />
          {error ? <Note kind="er">{error}</Note> : null}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", alignItems: "start" }}>
            <div className="stk" style={{ minWidth: 0 }}>
              <ClientPreview where={t("common.yourSalonPage")}>
                {isLoading ? <Skeleton height={160} /> : webCard}
              </ClientPreview>

              <RowItem
                title={shareUrl || t("business.publicUrlUnavailable")}
                sub={t("business.yourBookingLink")}
                onClick={publicUrl ? handleCopyUrl : undefined}
                right={
                  <span className="row gap8" style={{ fontWeight: 700, color: "var(--bz-vtext)" }}>
                    {copied ? <><Check size={15} />{t("business.copied")}</> : <><Copy size={15} />{t("common.copy")}</>}
                  </span>
                }
              />

              <SalonQrCard salonUrl={publicUrl} salonName={business?.slug ?? business?.name} />
              <ShareKitCard salonUrl={publicUrl} salonName={business?.name ?? ""} businessId={String(business?.id ?? "")} />

              <Card title={t("business.about")}>
                <p style={{ whiteSpace: "pre-line", margin: 0 }}>
                  {business?.description || <span style={{ color: "var(--bz-muted)" }}>{t("business.noDescriptionYetTwoLines")}</span>}
                </p>
                <FormGrid cols={3}>
                  {[
                    [t("common.phone"), business?.phone],
                    [t("common.email"), business?.email],
                    [t("business.website"), business?.website],
                  ].map(([k, v]) => (
                    <Field key={k} label={k} disabled>
                      <b style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{v || "—"}</b>
                    </Field>
                  ))}
                </FormGrid>
              </Card>

              <Card title={t("business.location")}>
                <p className="row gap8" style={{ margin: 0 }}><MapPin size={16} /> {formatAddress(business)}</p>
                <span className="hint">{locationLabel}</span>
                {hasCoords && mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-ol s" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
                    {t("business.openInMaps")}{" "}<ExternalLink size={13} />
                  </a>
                ) : null}
                {mapsEmbedUrl ? (
                  <iframe title={t("business.businessLocationMap")} src={mapsEmbedUrl} style={{ width: "100%", height: 192, border: 0, borderRadius: 14 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                ) : (
                  <Note kind="in" icon={<MapPin size={16} />}>{t("business.locationCoordinatesAreNotSet")}</Note>
                )}
              </Card>

              <Card title={t("common.services")}>
                <div style={{ textAlign: "right" }}>
                  <Btn kind="ol" onClick={() => navigate(getPath("items-category"))}>{t("business.editMenu")}</Btn>
                </div>
                {services.length ? (
                  services.slice(0, 6).map((service) => (
                    <RowItem
                      key={service.id}
                      title={service.name}
                      sub={[formatDuration(service.durationMinutes), service.categoryName].filter(Boolean).join(" · ") || t("business.noDuration")}
                      right={<b>{formatMoney(service.price)}</b>}
                    />
                  ))
                ) : (
                  <span className="hint">{t("business.noServicesAddedYet")}</span>
                )}
                {services.length > 6 && <span className="hint">{t("business.moreOnYourMenu", { value: services.length - 6 })}</span>}
              </Card>
            </div>

            <div className="stk" style={{ minWidth: 0 }}>
              <Card title={t("business.profileCompleteness")}>
                <div className="row sp">
                  <b style={{ fontSize: 28 }}>{completionPercent}%</b>
                  <StatusPill kind={completionPercent >= 80 ? "c" : completionPercent >= 50 ? "w" : "d"}>{completionTier}</StatusPill>
                </div>
                <Meter value={completedCount} max={completenessChecks.length} label={t("business.ofCompleted", { completedCount, count: completenessChecks.length })} />
                {completenessChecks.map((c) => (
                  <CheckRow key={c.label} label={c.label} checked={c.ok} icon={<Check className="ic" />} />
                ))}
              </Card>

              <Card title={t("common.reviews")}>
                {reviews.length > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <Btn kind="ol" onClick={() => navigate(getPath("reviews"))}>{t("business.seeAllAndReply")}</Btn>
                  </div>
                )}
                {reviews.length === 0 ? (
                  <span className="hint">{t("business.noReviewsYetClientsCan")}</span>
                ) : (
                  <>
                    <p style={{ margin: 0 }}>
                      <b style={{ fontSize: 24 }}>{ratingSummary?.average != null ? ratingSummary.average.toFixed(1) : "–"}</b>{" "}{t("business.from")}{" "}
                      {t("business.reviewCount", { count: ratingSummary?.count ?? reviews.length })}
                    </p>
                    {reviews.slice(0, 3).map((r) => (
                      <RowItem
                        key={r.id}
                        title={<><span style={{ color: "var(--bz-star)" }}>{"★".repeat(r.rating)}</span>{" "}{r.authorName ?? t("business.aClient")}</>}
                        sub={r.comment ? <span className="line-clamp-3">{r.comment}</span> : undefined}
                      />
                    ))}
                  </>
                )}
              </Card>

              {/* #42: subscription state and upgrade path (the salon's booqi plan). */}
              <Card title={t("business.yourBooqiPlan")}>
                <p style={{ margin: 0 }}>
                  {subscription && subscription.status !== "NONE" ? (
                    <>
                      {t("business.plan")}{" "}<b>{subscription.planKey || "—"}</b> · {subscription.status}
                      {subscription.currentPeriodEnd ? t("business.renews", { value: formatLocaleDate(new Date(subscription.currentPeriodEnd), { year: "numeric", month: "numeric", day: "numeric" }) }) : ""}
                    </>
                  ) : (
                    t("business.noActiveSubscription")
                  )}
                </p>
                <div><Btn kind="ol" onClick={() => navigate(getPath("billing"))}>{t("billing.manage")}</Btn></div>
              </Card>
            </div>
          </div>
        </div>

        {editOpen && (
          <Drawer
            title={t("business.editBusinessProfile")}
            sub={t("business.changesShowOnBooqiAs")}
            onClose={() => setEditOpen(false)}
            closeIcon={<X className="ic" />}
            footer={
              <>
                <Btn kind="ol" onClick={() => setEditOpen(false)}>{t("common.cancel")}</Btn>
                <Btn kind="v" onClick={handleSaveProfile} disabled={saving || !editForm.name.trim()}>
                  {saving ? t("common.saving") : t("common.saveChanges")}
                </Btn>
              </>
            }
          >
            <FormSection>{t("business.basics")}</FormSection>
            <Field label={t("common.businessName")}>
              <input id="bz-name" value={editForm.name} onChange={setF("name")} />
            </Field>
            <SelectField label={t("common.category")} required>
              <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
                  <SelectValue placeholder={t("business.chooseACategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.name}>{c.label ?? c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>
            <Field label={t("business.description")} kind="ta" hint={t("business.charactersCount", { n: editForm.description.length })}>
              <textarea id="bz-desc" rows={4} value={editForm.description} onChange={setF("description")} placeholder={t("business.whatYouDoBestIn")} />
            </Field>

            <FormSection>{t("business.coverPhoto")}</FormSection>
            {/* customer-app #4: without this the salon shows a stock photo, same as every other salon. */}
            <ImageUploadField
              label={t("business.coverPhoto")}
              purpose="BUSINESS_COVER"
              shape="wide"
              value={editForm.coverImageUrl}
              onChange={(url) => setEditForm((f) => ({ ...f, coverImageUrl: url }))}
              hint={t("business.shownToCustomersOnThe")}
            />

            <FormSection>{t("business.contact")}</FormSection>
            <FormGrid cols={2}>
              <Field label={t("common.phone")}>
                <input id="bz-phone" type="tel" value={editForm.phone} onChange={setF("phone")} />
              </Field>
              <Field label={t("common.email")}>
                <input id="bz-email" type="email" value={editForm.email} onChange={setF("email")} />
              </Field>
            </FormGrid>
            <Field label={t("business.website")}>
              <input id="bz-web" value={editForm.website} onChange={setF("website")} placeholder="https://example.com" />
            </Field>

            <FormSection>{t("business.location")}</FormSection>
            <Field label={t("common.address")}>
              <input id="bz-address" value={editForm.address} onChange={setF("address")} placeholder={t("business.streetNumber")} />
            </Field>

            {/* #37: cancellation policy. Empty keeps the current value. Deposits and late
                fees need online payment, which v1 does not take (clients pay at the salon),
                so those two stay off this form; their values are left untouched. */}
            <FormSection>{t("common.cancellations")}</FormSection>
            <Field label={t("business.freeCancellationUpToHours")} hint={t("business.emptyKeepsTheCurrentSetting")}>
              <input id="bz-cancel" type="number" min={0} step={1} value={editForm.cancellationWindowHours} onChange={setF("cancellationWindowHours")} placeholder="24" />
            </Field>
          </Drawer>
        )}
      </BzPage>
    </AppLayout>
  );
}
