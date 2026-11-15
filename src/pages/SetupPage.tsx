import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarClock,
  ChevronRight,
  Clock,
  CreditCard,
  Image,
  LifeBuoy,
  MapPin,
  Palette,
  Receipt,
  Search,
  Shield,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/utils/navigationUtils";
import { t } from "@/i18n";

interface SettingRow {
  label: string;
  hint: string;
  path: string;
  icon: LucideIcon;
}

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  rows: SettingRow[];
}

/**
 * Every setting, once. It used to be eight cards whose chips repeated the same few pages
 * (opening hours appeared three times). Each row is a real screen that changes how the
 * salon behaves; the work itself (calendar, till, catalogue) lives in the main nav.
 */
const SECTIONS: SettingsSection[] = [
  {
    id: "business",
    get title() { return t("common.business"); },
    get description() { return t("setup.whoYouAreAndWhere"); },
    icon: Building2,
    tone: "bg-sky-50 text-sky-700",
    rows: [
      { get label() { return t("common.businessProfile"); }, get hint() { return t("setup.nameCategoryDescriptionContact"); }, path: "business", icon: Store },
      { get label() { return t("common.photos"); }, get hint() { return t("setup.coverLogoAndGallery"); }, path: "photos", icon: Image },
      { get label() { return t("common.openingHours"); }, get hint() { return t("setup.weeklyHoursClosedDays"); }, path: "business-hours", icon: Clock },
      { get label() { return t("setup.locations"); }, get hint() { return t("setup.addressAndMapPin"); }, path: "locations", icon: MapPin },
      { get label() { return t("setup.brandColourReceiptFooter"); }, get hint() { return t("setup.yourColourTheLineUnder"); }, path: "branding", icon: Palette },
    ],
  },
  {
    id: "booking",
    get title() { return t("setup.booking"); },
    get description() { return t("setup.howAndWhenClientsCan"); },
    icon: CalendarClock,
    tone: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]",
    rows: [
      { get label() { return t("setup.onlineBooking"); }, get hint() { return t("setup.onOrOffNoticeHow"); }, path: "setup/online-booking", icon: CalendarClock },
      { get label() { return t("setup.cancellationPolicy"); }, get hint() { return t("setup.howLateAClientCan"); }, path: "setup/cancellation", icon: Shield },
    ],
  },
  {
    id: "money",
    get title() { return t("setup.money"); },
    get description() { return t("setup.clientsPayWhenTheyVisit"); },
    icon: CreditCard,
    tone: "bg-emerald-50 text-emerald-700",
    rows: [
      { get label() { return t("bookingRules.paymentMethods"); }, get hint() { return t("setup.paymentMethodsHint"); }, path: "setup/payment-methods", icon: CreditCard },
      { get label() { return t("setup.currencyTax"); }, get hint() { return t("setup.whatYourPricesAreIn"); }, path: "setup/currency-tax", icon: Receipt },
    ],
  },
  {
    id: "notifications",
    get title() { return t("setup.notifications"); },
    get description() { return t("setup.whatClientsHearFromYou"); },
    icon: Bell,
    tone: "bg-amber-50 text-amber-700",
    rows: [
      { get label() { return t("setup.emailReminders"); }, get hint() { return t("setup.confirmationsAndReminderTiming"); }, path: "setup/email", icon: Bell },
      { get label() { return t("setup.smsPush"); }, get hint() { return t("setup.textsAndAppNotifications"); }, path: "setup/sms-push", icon: Bell },
    ],
  },
  {
    id: "team",
    get title() { return t("common.team"); },
    get description() { return t("setup.whoWorksHereAndWhat"); },
    icon: Users,
    tone: "bg-rose-50 text-rose-700",
    rows: [
      { get label() { return t("setup.teamMembers"); }, get hint() { return t("setup.profilesServicesWorkingHours"); }, path: "staff", icon: Users },
      { get label() { return t("setup.rolesPermissions"); }, get hint() { return t("setup.whatEachRoleCanDo"); }, path: "roles", icon: ShieldCheck },
    ],
  },
  {
    id: "account",
    get title() { return t("setup.account"); },
    get description() { return t("setup.yourOwnSignIn"); },
    icon: Shield,
    tone: "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.7)]",
    rows: [
      { get label() { return t("setup.passwordSecurity"); }, get hint() { return t("setup.changeYourPassword"); }, path: "security", icon: Shield },
      { get label() { return t("setup.support"); }, get hint() { return t("setup.supportHint"); }, path: "support", icon: LifeBuoy },
    ],
  },
];

export default function SetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(SECTIONS[0].id);

  const focusedCategory = useMemo(() => new URLSearchParams(location.search).get("focus"), [location.search]);

  // ?focus=business (from onboarding) scrolls that section into view and marks it.
  useEffect(() => {
    if (!focusedCategory) return;
    document.getElementById(`setup-${focusedCategory}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setActive(focusedCategory);
  }, [focusedCategory]);

  const q = query.trim().toLowerCase();
  const sections = SECTIONS.map((s) => ({
    ...s,
    rows: q ? s.rows.filter((r) => `${s.title} ${r.label} ${r.hint}`.toLowerCase().includes(q)) : s.rows,
  })).filter((s) => s.rows.length);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(`setup-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("setup.settings")} subtitle={t("setup.everythingThatChangesHowBooking")} />

        <div className={pageBody}>
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav aria-label={t("setup.settingsSections")} className="hidden lg:block">
              <ul className="sticky top-[132px] space-y-0.5 rounded-[20px] bg-white p-2 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const on = active === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => jump(s.id)}
                        aria-current={on ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                          on ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]" : "text-[rgb(var(--reg-ink)/0.8)] hover:bg-[rgb(var(--reg-canvas))]",
                        )}
                      >
                        <Icon size={16} /> {s.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="min-w-0 space-y-6">
              <div className="relative max-w-md">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                <input aria-label={t("setup.searchSettings")} className={cn(fieldCls, "h-11 pl-10")} placeholder={t("setup.searchSettings")} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>

              {sections.length === 0 && (
                <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">{t("setup.noSettingMatches", { query })}</p>
              )}

              {sections.map((s) => {
                const Icon = s.icon;
                return (
                  <section
                    key={s.id}
                    id={`setup-${s.id}`}
                    className={cn("scroll-mt-[140px] overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]", focusedCategory === s.id && "ring-2 ring-[rgb(var(--reg-brand)/0.6)]")}
                  >
                    <header className="flex items-center gap-3 px-4 pb-2 pt-4 md:px-5">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", s.tone)}>
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-extrabold tracking-[-0.01em]">{s.title}</h2>
                        <p className="truncate text-sm text-[rgb(var(--reg-muted))]">{s.description}</p>
                      </div>
                    </header>
                    <ul>
                      {s.rows.map((r) => (
                        <li key={r.label} className="border-t border-[rgb(var(--reg-line)/0.6)] first:border-t-0">
                          <button
                            type="button"
                            onClick={() => navigate(getPath(r.path))}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[rgb(var(--reg-canvas)/0.7)] focus-visible:bg-[rgb(var(--reg-canvas))] focus-visible:outline-none md:px-5"
                          >
                            <span className="min-w-0 flex-1 pl-[52px]">
                              <span className="block text-[15px] font-semibold">{r.label}</span>
                              <span className="block truncate text-sm text-[rgb(var(--reg-muted))]">{r.hint}</span>
                            </span>
                            <ChevronRight size={18} className="shrink-0 text-[rgb(var(--reg-ink)/0.35)]" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
