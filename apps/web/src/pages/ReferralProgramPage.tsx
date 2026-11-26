import { Note, StatusPill } from "@/components/bz";
import { P4Loading } from "@/components/bz/p4-kit";
import { useEffect, useState } from "react";
import { CheckCircle, Clock, Copy, Gift, RefreshCw, Share2, Store, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { BooqiScope, EmptyState, PageHeader, StatCard, StatusChip, pageBody } from "@/components/bz/p4-compat";

import { AppLayout } from "@/components/layout/AppLayout";
import { primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { ClientPreview, SectionTitle } from "@/components/page/kit";
import { money, salonName, type Lifecycle } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { clientService } from "@/services/clientService";
import { referralService, type PlatformReferral, type ReferralAnalytics, type ReferralCode, type ReferralUsage } from "@/services/referralService";
import { t, fmtDate as formatLocaleDate } from "@/i18n";

const USAGE_STATUS: Record<ReferralUsage["status"], { status: Lifecycle; label: string }> = {
  REWARDED: { status: "active", get label() { return t("referralProgram.rewarded"); } },
  PENDING: { status: "scheduled", get label() { return t("referralProgram.waitingForFirstVisit"); } },
  FAILED: { status: "failed", get label() { return t("referralProgram.failed"); } },
  CANCELLED: { status: "ended", get label() { return t("common.cancelled"); } },
};

/** "200 points", "5 ₼ + 200 points", or null when the side gets nothing. */
function rewardText(amount?: number | null, points?: number | null): string | null {
  const parts = [amount ? money(amount, currencySymbol()) : null, points ? `${points} points` : null].filter(Boolean);
  return parts.length ? parts.join(" + ") : null;
}

/**
 * Referrals: the salon's code, what each side gets, and who came in through it.
 * Plus the owner's own booqi code, which exists whether or not the salon runs a scheme.
 */
export default function ReferralProgramPage() {
  const businessId = useBusinessId();
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [me, setMe] = useState<PlatformReferral | null>(null);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null);
  const [usages, setUsages] = useState<ReferralUsage[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    // The one code (owner or customer alike), its link and the split stats.
    referralService.getMyPlatformCode().then(setMe).catch(() => setMe(null));
    // Usages carry client ids only; the names make the list readable.
    clientService
      .getClientsByBusiness(businessId)
      .then((cs) => setNames(Object.fromEntries((cs || []).map((c) => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()]))))
      .catch(() => setNames({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData reads only businessId, which is listed
  }, [businessId]);

  // The QR carries the share link; the library loads only when it is needed.
  const shareUrl = me?.link ?? "";
  useEffect(() => {
    if (!shareUrl) return;
    let live = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(shareUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" }))
      .then((data) => live && setQr(data))
      .catch(() => live && setQr(""));
    return () => {
      live = false;
    };
  }, [shareUrl]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [codeData, analyticsData] = await Promise.all([
        referralService.getBusinessUniversalCode(businessId),
        referralService.getAnalytics(businessId).catch(() => null),
      ]);
      setReferralCode(codeData);
      setAnalytics(analyticsData);
      setServiceUnavailable(false);
      setUsages(await referralService.getReferralUsages(businessId).catch(() => []));
    } catch (error) {
      // The referral service may not be deployed — show an inline notice, not a toast.
      console.warn("Referral service unavailable:", (error instanceof Error && error.message) || error);
      setServiceUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, what = "Code") => {
    void navigator.clipboard?.writeText(text);
    setCopied(text);
    toast.success(`${what} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareLink = (m: PlatformReferral) => {
    const text = t("referralProgram.oneLinkShareText", { link: m.link });
    if (navigator.share) {
      void navigator.share({ text }).catch(() => undefined);
    } else {
      copy(text, t("referralProgram.invite"));
    }
  };

  const pending = usages.filter((u) => u.status === "PENDING").length;
  const sorted = [...usages].sort((a, b) => b.usedAt.localeCompare(a.usedAt));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("common.referrals")}
          subtitle={t("referralProgram.yourClientsBringTheirFriends")}
          actions={
            me ? (
              <Button className={primaryBtn} onClick={() => shareLink(me)}>
                <Share2 size={16} />{" "}{t("referralProgram.shareCode")}
              </Button>
            ) : undefined
          }
        />

        <div className={pageBody}>
          {loading ? (
            <P4Loading />
          ) : (
            <>
              {serviceUnavailable && !referralCode && (
                <Note kind="wa" icon={<Gift className="ic" aria-hidden />}>
                  <b>{t("referralProgram.referralProgrammeComingSoon")}</b>
                  <br />
                  {t("referralProgram.theReferralServiceIsNot")}
                </Note>
              )}

              {!serviceUnavailable && !referralCode && (
                <EmptyState
                  icon={Gift}
                  title={t("referralProgram.noReferralCodeYet")}
                  body={t("referralProgram.yourSalonSCodeIs")}
                  action={<Button variant="outline" className={secondaryBtn} onClick={() => void loadData()}><RefreshCw size={16} />{" "}{t("referralProgram.refresh")}</Button>}
                />
              )}

              {referralCode && (
                <div>
                  <SectionTitle>{t("referralProgram.clientProgrammeTitle")}</SectionTitle>
                  <p className="-mt-2 mb-3 text-sm text-[rgb(var(--reg-muted))]">{t("referralProgram.clientProgrammeBody")}</p>
                </div>
              )}

              {analytics && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard icon={Users} label={t("referralProgram.friendsReferred")} value={analytics.totalReferredClients} hint={analytics.totalReferredBusinesses ? t("referralProgram.businesses", { totalReferredBusinesses: analytics.totalReferredBusinesses }) : t("referralProgram.usedYourCode")} tone="violet" />
                  <StatCard icon={CheckCircle} label={t("referralProgram.cameIn")} value={analytics.successfulUsages} hint={analytics.totalUsages ? t("referralProgram.ofReferrals", { value: Math.round((analytics.successfulUsages / analytics.totalUsages) * 100) }) : t("referralProgram.firstVisitDone")} tone="emerald" />
                  <StatCard icon={Clock} label={t("referralProgram.waiting")} value={pending} hint={t("referralProgram.notVisitedYet")} tone="sky" />
                  <StatCard icon={Gift} label={t("referralProgram.pointsGiven")} value={analytics.totalPointsGiven} hint={analytics.totalRewardsGiven ? `+ ${money(analytics.totalRewardsGiven, currencySymbol())}` : t("referralProgram.toClientsWhoShared")} tone="amber" />
                </div>
              )}

              {referralCode && (
                <section>
                  <SectionTitle>{t("referralProgram.clientProgrammeTitle")}</SectionTitle>
                  {sorted.length === 0 ? (
                    <EmptyState icon={Users} title={t("referralProgram.noReferralsYet")} body={t("referralProgram.shareTheCodeAtThe")} />
                  ) : (
                    <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      {sorted.map((u, i) => {
                        const s = USAGE_STATUS[u.status] ?? { status: "ended" as Lifecycle, label: u.status };
                        const who = (u.referredClientId && names[u.referredClientId]) || (u.referredBusinessId ? `Business #${u.referredBusinessId}` : u.referredClientId ? `Client #${u.referredClientId}` : "Someone");
                        const reward = rewardText(u.rewardAmount, u.rewardPoints);
                        return (
                          <li key={u.id} className={cn("flex items-center gap-3 px-4 py-3.5 md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-sm font-bold text-[rgb(var(--reg-brand-strong))]">
                              {who.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold">{who}</p>
                              <p className="truncate text-sm text-[rgb(var(--reg-muted))]">
                                {t("referralProgram.joined", { value: formatLocaleDate(new Date(u.usedAt), { day: "numeric", month: "short" }), value2: u.rewardedAt ? t("referralProgram.rewarded2", { value: formatLocaleDate(new Date(u.rewardedAt), { day: "numeric", month: "short" }) }) : "", value3: reward ? ` · ${reward}` : "" })}
                              </p>
                            </div>
                            <StatusChip status={s.status} label={s.label} className="hidden sm:inline-flex" />
                            <StatusChip status={s.status} label={s.label.split(" ")[0]} className="sm:hidden" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {/* One code, one link, one QR: the invited person picks customer or salon on the landing page. */}
              {me && (
                <>
                  <section className="grid gap-4 rounded-[24px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6 lg:grid-cols-[1.4fr_auto]">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{t("referralProgram.oneCodeTitle")}</p>
                      <button
                        type="button"
                        onClick={() => copy(me.code)}
                        className="group mt-2 inline-flex max-w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[rgb(var(--reg-brand)/0.4)] bg-[rgb(var(--reg-brand-soft))] px-4 py-2.5 font-mono text-[26px] font-extrabold tracking-[0.14em] text-[rgb(var(--reg-brand-strong))] transition hover:bg-[rgb(236_231_255)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] md:text-[32px]"
                      >
                        <span className="truncate">{me.code}</span>
                        {copied === me.code ? <CheckCircle size={20} className="shrink-0" /> : <Copy size={20} className="shrink-0 opacity-60 group-hover:opacity-100" />}
                        <span className="sr-only">{t("referralProgram.copyCode")}</span>
                      </button>
                      <p className="mt-3 text-sm text-[rgb(var(--reg-muted))]">{t("referralProgram.oneCodeBody")}</p>
                      <p className="mt-2 break-all font-mono text-sm">{me.link}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button className={primaryBtn} onClick={() => shareLink(me)}><Share2 size={16} />{" "}{t("referralProgram.share")}</Button>
                        <Button variant="outline" className={secondaryBtn} onClick={() => copy(me.link, t("referralProgram.copyLink"))}><Copy size={16} />{" "}{t("referralProgram.copyLink")}</Button>
                      </div>
                    </div>
                    {qr && <img src={qr} alt={t("referralProgram.qrAlt")} width={160} height={160} className="h-40 w-40 self-center rounded-2xl ring-1 ring-[rgb(var(--reg-line)/0.8)]" />}
                  </section>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="crd2">
                      <SectionTitle>{t("referralProgram.invitedSalons")}</SectionTitle>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <StatCard icon={Store} label={t("referralProgram.signedUp")} value={me.salons.signedUp} tone="violet" />
                        <StatCard icon={CheckCircle} label={t("referralProgram.becamePaying")} value={me.salons.paying} tone="emerald" />
                        <StatCard icon={Gift} label={t("referralProgram.freeMonthsEarned")} value={me.salons.freeMonths} tone="amber" />
                      </div>
                    </div>
                    <div className="crd2">
                      <SectionTitle>{t("referralProgram.invitedCustomers")}</SectionTitle>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <StatCard icon={UserPlus} label={t("referralProgram.signedUp")} value={me.customers.signedUp} tone="violet" />
                        <StatCard icon={CheckCircle} label={t("referralProgram.booked")} value={me.customers.booked} tone="emerald" />
                      </div>
                    </div>
                  </div>

                  <section>
                    <SectionTitle>{t("referralProgram.whoCameThroughYourCode")}</SectionTitle>
                    {me.invites.length === 0 ? (
                      <EmptyState icon={Users} title={t("referralProgram.noReferralsYet")} body={t("referralProgram.shareTheCodeAtThe")} />
                    ) : (
                      <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                        {me.invites.map((inv, i) => (
                          <li key={`${inv.created_at}-${i}`} className={cn("flex items-center gap-3 px-4 py-3.5 md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-sm font-bold text-[rgb(var(--reg-brand-strong))]">
                              {inv.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold">{inv.name}</p>
                              <p className="truncate text-sm text-[rgb(var(--reg-muted))]">{formatLocaleDate(new Date(inv.created_at), { day: "numeric", month: "short" })}</p>
                            </div>
                            <StatusPill kind={inv.type === "SALON" ? "w" : "d"}>{inv.type === "SALON" ? t("referralProgram.typeSalon") : t("referralProgram.typeCustomer")}</StatusPill>
                            <StatusChip status={inv.status === "QUALIFIED" ? "active" : "scheduled"} label={inv.status === "QUALIFIED" ? t("referralProgram.rewarded") : t("referralProgram.waitingForFirstVisit")} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
