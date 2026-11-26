import { X } from "lucide-react";
import { format } from "@/i18n/dateFns";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
    <DialogPrimitive.Root open onOpenChange={(o) => !o && p.onClose()}>
      <DialogPrimitive.Overlay className="veil bz-fixed" />
      <DialogPrimitive.Content className="a-dr bz-fixed" aria-describedby={undefined}>
        <div className="a-dh">
          <div>
            <DialogPrimitive.Title asChild>
              <h6>{p.editing ? tr("calendar.editBooking") : tr("common.newBooking")}</h6>
            </DialogPrimitive.Title>
            {p.subtitle ? <small>{p.subtitle}</small> : null}
          </div>
          <DialogPrimitive.Close asChild>
            <span className="circ" role="button" tabIndex={0} aria-label={tr("common.cancel")}>
              <X className="ic" />
            </span>
          </DialogPrimitive.Close>
        </div>
        <div className="a-db">
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
        <div className="a-df">
          <button type="button" className="btn btn-ol s" style={{ height: 46 }} onClick={p.onClose}>
            {tr("common.cancel")}
          </button>
          <button type="button" className="btn btn-v s" style={{ height: 46 }} disabled={!p.canSubmit || p.submitting} onClick={p.onSubmit}>
            {p.submitting ? tr("common.saving") : p.submitLabel}
          </button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
