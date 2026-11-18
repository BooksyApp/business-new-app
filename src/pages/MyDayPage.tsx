import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { myStaffRecord } from "@/components/layout/navigation";
import { BooqiScope, EmptyState, PageHeader, StatCard } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { appointmentService, type Appointment } from "@/services/appointmentService";
import { salonDayService } from "@/services/salonDayService";
import { t } from "@/i18n";

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function shiftDay(iso: string, n: number): string {
  const x = new Date(`${iso}T00:00:00`);
  x.setDate(x.getDate() + n);
  return isoDay(x);
}

/**
 * FG-W2-10: the signed-in team member's own day. Their bookings for one day and the
 * commission they earned on it. Both calls are scoped by the server to their own staff record.
 */
export default function MyDayPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const staffId = myStaffRecord();
  const todayIso = isoDay(new Date());

  const [day, setDay] = useState(todayIso);
  const [bookings, setBookings] = useState<Appointment[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, count: 0 });

  const load = useCallback(async () => {
    if (!businessId || !staffId) return;
    try {
      const [list, sum] = await Promise.all([
        appointmentService.getAppointmentsByStaff(staffId, new Date(`${day}T00:00:00`)),
        salonDayService.getMyEarnings(businessId, day),
      ]);
      setBookings(
        list.filter((a) => a.status !== "CANCELLED").sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
      setEarnings(sum);
    } catch {
      toast.error(t("myDay.loadFailed"));
    }
  }, [businessId, staffId, day]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!staffId) {
    return (
      <AppLayout>
        <BooqiScope>
          <PageHeader title={t("myDay.title")} subtitle={t("myDay.subtitle")} />
          <div className={pageBody}>
            <EmptyState icon={Clock} title={t("myDay.title")} body={t("timesheet.noStaffProfile")} />
          </div>
        </BooqiScope>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("myDay.title")} subtitle={t("myDay.subtitle")} />
        <div className={pageBody}>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              className="h-12 w-12"
              aria-label={t("myDay.prevDay")}
              onClick={() => setDay(shiftDay(day, -1))}
            >
              <ChevronLeft size={20} />
            </Button>
            <span className="text-base font-semibold">{day === todayIso ? t("myDay.today") : day}</span>
            <Button
              variant="outline"
              className="h-12 w-12"
              aria-label={t("myDay.nextDay")}
              onClick={() => setDay(shiftDay(day, 1))}
            >
              <ChevronRight size={20} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Wallet} label={t("myDay.earnings")} value={money(earnings.total, sym)} tone="emerald" />
            <StatCard icon={Clock} label={t("myDay.bookings")} value={bookings.length} tone="sky" />
          </div>
          <p className="text-sm text-[rgb(var(--reg-muted))]">{t("myDay.salesCount", { value: earnings.count })}</p>

          {bookings.length === 0 ? (
            <EmptyState icon={Clock} title={t("myDay.nobodyBooked")} body={t("myDay.emptyBody")} />
          ) : (
            <ul className="space-y-3">
              {bookings.map((a) => (
                <li
                  key={a.id}
                  className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]"
                >
                  <div className="text-2xl font-bold">{a.startTime.slice(0, 5)}</div>
                  <div className="mt-1 font-semibold">{a.clientName ?? "—"}</div>
                  <div className="text-sm text-[rgb(var(--reg-muted))]">{a.serviceName ?? ""}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
