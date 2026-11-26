import { X } from "lucide-react";
import { format } from "@/i18n/dateFns";
import { Btn, Drawer } from "@/components/bz";
import { t as tr } from "@/i18n";
import { ClientSection } from "./ClientSection";
import { DateSection, RepeatSection, TimeSection } from "./WhenSection";
import { PackageSection, ServiceSection, StaffSection } from "./ServiceStaffSection";
import { ExtraServicesSection, GroupMembersSection } from "./ExtrasSection";
import { SummarySection } from "./SummarySection";
import type { BookingDrawerProps } from "./types";

export type { BookingDrawerProps, BookingForm } from "./types";

/**
 * Təqvim → new / edit booking drawer ("rezerv çəkməcəsi"), on the bz kit (`Drawer`, `.fld`, `.slot`, `.rd`, `.chip`).
 * Presentational: CalendarPage owns the state, queries, validation and mutations.
 */
export function BookingDrawer(p: BookingDrawerProps) {
  const hasPackage = !!p.selectedPackage && !p.editing;
  return (
    <Drawer
      narrow
      title={p.editing ? tr("calendar.editBooking") : tr("common.newBooking")}
      sub={p.subtitle}
      onClose={p.onClose}
      closeIcon={<X className="ic" />}
      footer={
        <>
          <Btn kind="ol" small={false} onClick={p.onClose}>
            {tr("common.cancel")}
          </Btn>
          <Btn kind="v" small={false} disabled={!p.canSubmit || p.submitting} onClick={p.onSubmit}>
            {p.submitting ? tr("common.saving") : p.submitLabel}
          </Btn>
        </>
      }
    >
      <div className="bkd">
        <ClientSection {...p} />
        <DateSection {...p} />
        <RepeatSection {...p} />
        <ServiceSection {...p} />
        <PackageSection {...p} formatDate={format(p.currentDate, "yyyy-MM-dd")} />
        {!hasPackage && <TimeSection {...p} />}
        {!hasPackage && <StaffSection {...p} />}
        <GroupMembersSection {...p} />
        <ExtraServicesSection {...p} />
        <SummarySection {...p} />
      </div>
    </Drawer>
  );
}
