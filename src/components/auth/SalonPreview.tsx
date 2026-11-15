import { Clock, MapPin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassChip, MeshPanel } from "./AuthShell";
import { t, formatMinutes } from "@/i18n";

export interface SalonPreviewData {
  businessName: string;
  category: string;
  address: string;
  ownerName: string;
  businessHours: Record<string, { enabled: boolean; hours: string }>;
  services: { id: string; name: string; duration: string; price: string; priceType: string }[];
  staff: { id: string; name: string; position: string }[];
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "B";

/** "0:30" → "30 min", "1:15" → "1 h 15 min". */
const duration = (d: string) => {
  const [h, m] = d.split(":").map(Number);
  return h || m ? formatMinutes(h * 60 + m) : "—";
};

/**
 * Sign-up's right-hand panel: the salon as a client will meet it on booqi, filling in as the
 * owner answers. Empty answers show as soft placeholders, never as fake data.
 */
export function SalonPreview({ data, done = false }: { data: SalonPreviewData; done?: boolean }) {
  const today = data.businessHours[DAY_KEYS[new Date().getDay()]];
  const shortAddress = data.address.split(",").slice(0, 2).join(",").trim();
  const people = [{ id: "owner", name: data.ownerName || "You" }, ...data.staff];

  return (
    <MeshPanel className="gap-8 lg:sticky lg:top-8 lg:self-start">
      <div>
        <GlassChip>{done ? t("auth.yourSalonIsReady") : t("auth.livePreview")}</GlassChip>
        <h2 className="mt-6 max-w-md text-[36px] font-extrabold !leading-[1.02] tracking-[-0.03em] text-[rgb(var(--reg-ink))] [text-wrap:balance]">
          {t("auth.thisIsHowClientsWill")}
        </h2>
      </div>

      <article
        aria-label={t("auth.salonPreview")}
        className="overflow-hidden rounded-[28px] bg-white shadow-[0_2px_6px_rgb(var(--reg-ink)/0.05),0_18px_40px_-12px_rgb(var(--reg-ink)/0.16)] ring-1 ring-[rgb(var(--reg-ink)/0.05)]"
      >
        <div
          className="relative h-28"
          style={{
            background:
              "radial-gradient(70% 90% at 0% 0%, rgb(var(--reg-brand) / 0.75) 0%, transparent 65%)," +
              "radial-gradient(60% 90% at 100% 20%, rgb(var(--reg-mesh-2)) 0%, transparent 70%)," +
              "radial-gradient(70% 80% at 50% 100%, rgb(var(--reg-mesh-3)) 0%, transparent 70%)," +
              "rgb(var(--reg-mesh-1))",
          }}
        >
          <span className="absolute -bottom-7 left-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-[rgb(var(--reg-brand-strong))] shadow-[0_8px_24px_-8px_rgb(var(--reg-ink)/0.25)] ring-4 ring-white">
            {initials(data.businessName)}
          </span>
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-[rgb(var(--reg-ink))] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[rgb(var(--reg-brand))]" aria-hidden />
            {t("auth.newOnBooqi")}
          </span>
        </div>

        <div className="px-6 pb-6 pt-10">
          <h3 className={cn("text-xl font-extrabold tracking-[-0.02em]", !data.businessName && "text-[rgb(var(--reg-muted)/0.6)]")}>
            {data.businessName || t("common.yourSalon")}
          </h3>
          <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{data.category || t("common.category")}</p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <dt className="sr-only">{t("common.address")}</dt>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--reg-muted))]" aria-hidden />
              <dd className={cn("line-clamp-1", !shortAddress && "text-[rgb(var(--reg-muted)/0.7)]")}>{shortAddress || t("common.address")}</dd>
            </div>
            <div className="flex items-start gap-2">
              <dt className="sr-only">{t("common.today")}</dt>
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--reg-muted))]" aria-hidden />
              <dd>
                {today?.enabled ? (
                  <>
                    <span className="font-semibold text-[rgb(22_128_61)]">{t("auth.openToday")}</span> · {today.hours}
                  </>
                ) : (
                  <span className="text-[rgb(var(--reg-muted))]">{t("auth.closedToday")}</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-[rgb(var(--reg-line)/0.7)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--reg-muted))]">{t("common.services")}</p>
            {data.services.length ? (
              <ul className="mt-2 space-y-2">
                {data.services.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">{s.name}</span>
                    <span className="shrink-0 text-[rgb(var(--reg-muted))]">
                      {duration(s.duration)} · {s.priceType === "From" ? t("common.from") : ""}
                      {s.price}
                    </span>
                  </li>
                ))}
                {data.services.length > 3 && (
                  <li className="text-xs text-[rgb(var(--reg-muted))]">{t("auth.more", { value: data.services.length - 3 })}</li>
                )}
              </ul>
            ) : (
              <div className="mt-2 space-y-2" aria-label={t("common.noServicesYet")}>
                <span className="block h-3 w-3/4 rounded-full bg-[rgb(var(--reg-ink)/0.06)]" />
                <span className="block h-3 w-1/2 rounded-full bg-[rgb(var(--reg-ink)/0.06)]" />
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div className="flex -space-x-2" aria-label={t("auth.teamMemberCount", { count: people.length })}>
              {people.slice(0, 5).map((p) => (
                <span
                  key={p.id}
                  title={p.name}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[11px] font-bold text-[rgb(var(--reg-brand-strong))] ring-2 ring-white"
                >
                  {initials(p.name)}
                </span>
              ))}
            </div>
            <span className="rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand)),rgb(var(--reg-brand-strong)))] px-4 py-2 text-xs font-semibold text-white">
              {t("common.book")}
            </span>
          </div>
        </div>
      </article>
    </MeshPanel>
  );
}
