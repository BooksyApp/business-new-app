import { useEffect, useState } from "react";
import { CheckCircle, Clock, Copy, Gift, RefreshCw, Share2, Sparkles, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, PageHeader, StatCard } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { ClientPreview, SectionTitle, StatusChip } from "@/components/page/kit";
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
  const [myCode, setMyCode] = useState<PlatformReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null);
  const [usages, setUsages] = useState<ReferralUsage[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    // Independent of the salon's programme: the account's own code exists either way, so
    // a business with no scheme still sees something to share.
    referralService.getMyPlatformCode().then(setMyCode).catch(() => setMyCode(null));
    // Usages carry client ids only; the names make the list readable.
    clientService
      .getClientsByBusiness(businessId)
      .then((cs) => setNames(Object.fromEntries((cs || []).map((c) => [c.id, `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()]))))
      .catch(() => setNames({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData reads only businessId, which is listed
  }, [businessId]);

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

  const inviteText = (code: string) =>
    t("referralProgram.bookAtOnBooqiWith", { value: salonName(), code });

  const share = (code: string) => {
    const text = inviteText(code);
    if (navigator.share) {
      navigator.share({ text }).catch(() => undefined);
    } else {
      copy(text, t("referralProgram.invite"));
    }
  };

  const friendGets = referralCode ? rewardText(referralCode.newUserReward, referralCode.newUserPoints) : null;
  const sharerGets = referralCode ? rewardText(referralCode.rewardAmount, referralCode.rewardPoints) : null;
  const pending = usages.filter((u) => u.status === "PENDING").length;
  const sorted = [...usages].sort((a, b) => b.usedAt.localeCompare(a.usedAt));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("common.referrals")}
          subtitle={t("referralProgram.yourClientsBringTheirFriends")}
          actions={
            referralCode ? (
              <Button className={primaryBtn} onClick={() => share(referralCode.code)}>
                <Share2 size={16} />{" "}{t("referralProgram.shareCode")}
              </Button>
            ) : myCode ? (
              <Button className={primaryBtn} onClick={() => copy(myCode.code)}>
                <Copy size={16} />{" "}{t("referralProgram.copyMyCode")}
              </Button>
            ) : undefined
          }
        />

        <div className={pageBody}>
          {loading ? (
            <div className="h-56 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : (
            <>
              {serviceUnavailable && !referralCode && (
                <div className="flex items-start gap-3 rounded-[20px] bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
                  <Gift size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
                  <div>
                    <p className="text-sm font-bold text-amber-900">{t("referralProgram.referralProgrammeComingSoon")}</p>
                    <p className="mt-0.5 text-sm text-amber-900/80">{t("referralProgram.theReferralServiceIsNot")}</p>
                  </div>
                </div>
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
                <section className="grid gap-4 rounded-[24px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6 lg:grid-cols-[1.1fr_1fr]">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{t("referralProgram.yourSalonSCode")}</p>
                      <StatusChip status={referralCode.status === "ACTIVE" ? "active" : "ended"} label={referralCode.status === "ACTIVE" ? undefined : referralCode.status.charAt(0) + referralCode.status.slice(1).toLowerCase()} />
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(referralCode.code)}
                      className="group mt-2 inline-flex max-w-full items-center gap-3 self-start rounded-2xl border-2 border-dashed border-[rgb(var(--reg-brand)/0.4)] bg-[rgb(var(--reg-brand-soft))] px-4 py-2.5 font-mono text-[26px] font-extrabold tracking-[0.14em] text-[rgb(var(--reg-brand-strong))] transition hover:bg-[rgb(236_231_255)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] md:text-[32px]"
                    >
                      <span className="truncate">{referralCode.code}</span>
                      {copied === referralCode.code ? <CheckCircle size={20} className="shrink-0" /> : <Copy size={20} className="shrink-0 opacity-60 group-hover:opacity-100" />}
                      <span className="sr-only">{t("referralProgram.copyCode")}</span>
                    </button>

                    <dl className="mt-5 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-[rgb(var(--reg-canvas))] p-3">
                        <dt className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("referralProgram.theFriendGets")}</dt>
                        <dd className="mt-0.5 text-[15px] font-bold">{friendGets ?? t("referralProgram.nothingYet")}</dd>
                      </div>
                      <div className="rounded-2xl bg-[rgb(var(--reg-canvas))] p-3">
                        <dt className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("referralProgram.yourClientGets")}</dt>
                        <dd className="mt-0.5 text-[15px] font-bold">{sharerGets ?? t("referralProgram.nothingYet")}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-[rgb(var(--reg-muted))]">
                      {t("referralProgram.worksForClientsAndFor", { value: referralCode.maxUses ? t("referralProgram.usesOf", { count: referralCode.currentUses, max: referralCode.maxUses }) : t("referralProgram.usesNoLimit", { count: referralCode.currentUses }) })}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 lg:mt-auto lg:pt-5">
                      <Button className={primaryBtn} onClick={() => share(referralCode.code)}><Share2 size={16} />{" "}{t("referralProgram.share")}</Button>
                      <Button variant="outline" className={secondaryBtn} onClick={() => copy(referralCode.code)}><Copy size={16} />{" "}{t("referralProgram.copyCode")}</Button>
                    </div>
                  </div>

                  <ClientPreview where={t("referralProgram.theInvite")}>
                    <div className="rounded-2xl bg-white p-4">
                      <div className="ml-auto max-w-[88%] rounded-[18px] rounded-br-md bg-[rgb(var(--reg-brand))] px-3.5 py-2.5 text-sm leading-snug text-white">
                        {inviteText(referralCode.code)}
                      </div>
                      <ol className="mt-4 space-y-2 text-sm">
                        {[
                          [UserPlus, t("referralProgram.stepSignUp")],
                          [CheckCircle, t("referralProgram.stepFirstVisit")],
                          [Sparkles, t("referralProgram.stepReward")],
                        ].map(([Icon, text], i) => {
                          const I = Icon as typeof UserPlus;
                          return (
                            <li key={i} className="flex items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]">
                                <I size={14} />
                              </span>
                              <span className="text-[rgb(var(--reg-ink)/0.85)]">{text as string}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </ClientPreview>
                </section>
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
                  <SectionTitle>{t("referralProgram.whoCameThroughYourCode")}</SectionTitle>
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

              {/* The account's own code: every registered person has one, including an
                  owner who runs no scheme of their own. */}
              {myCode && (
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{t("referralProgram.yourPersonalBooqiCode")}</p>
                    <p className="font-mono text-xl font-bold tracking-[0.12em]">{myCode.code}</p>
                    <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">
                      {t("referralProgram.bookedInvited", { qualified: myCode.qualified, pending: myCode.pending, value: myCode.pointsEarned > 0 ? t("referralProgram.pointsEarned", { pointsEarned: myCode.pointsEarned }) : "" })}
                    </p>
                  </div>
                  <Button variant="outline" className={secondaryBtn} onClick={() => copy(myCode.code)}>
                    <Copy size={16} />{" "}{t("common.copy")}
                  </Button>
                </section>
              )}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
