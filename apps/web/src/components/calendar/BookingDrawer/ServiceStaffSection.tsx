import { Package, Search } from "lucide-react";
import { currencySymbol } from "@/lib/currency";
import { PackageBookingPanel } from "@/components/calendar/PackageBookingPanel";
import { t as tr } from "@/i18n";
import type { BookingDrawerProps } from "./types";

type SvcP = Pick<BookingDrawerProps, "form" | "setForm" | "services" | "serviceQuery" | "setServiceQuery" | "bookingMode">;

/** Service: radio cards (`.rd`) with name, duration, price; searchable when the list is long. */
export function ServiceSection({ form, setForm, services, serviceQuery, setServiceQuery, bookingMode }: SvcP) {
  return (
    <section className="bkd-sec">
      <div className="bkd-k">{bookingMode === "group" ? tr("calendar.serviceAllMembers") : tr("common.service")}</div>
      {services.length > 6 && (
        <div className="srch">
          <Search className="ic" aria-hidden />
          <input value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} placeholder={tr("common.searchServices")} aria-label={tr("calendar.searchServices")} style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: 0, font: "inherit", color: "inherit" }} />
        </div>
      )}
      <div className="bkd-list" role="radiogroup" aria-label={tr("common.service")}>
        {services
          .filter((sv) => !serviceQuery || sv.name.toLowerCase().includes(serviceQuery.toLowerCase()))
          .map((service) => {
            const on = form.serviceId === service.id.toString();
            return (
              <button key={service.id} type="button" role="radio" aria-checked={on} onClick={() => setForm((prev) => ({ ...prev, serviceId: service.id.toString() }))} className={`rd${on ? " on" : ""}`}>
                <i />
                <span className="tx">
                  <b>
                    {service.name}
                    {service.serviceType === "COMBO" && (
                      <>
                        {" "}
                        <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Package className="ic" style={{ width: 12, height: 12 }} /> {tr("common.combo")}
                        </span>
                      </>
                    )}
                  </b>
                  {service.durationMinutes ? <span>{tr("calendar.min3", { durationMinutes: service.durationMinutes })}</span> : null}
                </span>
                <span className="pr">{service.price ? `${service.price.toFixed(2)} ${currencySymbol()}` : tr("calendar.free")}</span>
              </button>
            );
          })}
        {services.length === 0 && <p className="sm t-m b7" style={{ padding: "8px 4px" }}>{tr("calendar.noServicesYetAddThem")}</p>}
      </div>
    </section>
  );
}

type PkgP = Pick<BookingDrawerProps, "form" | "setForm" | "selectedPackage" | "businessId" | "editing" | "packageParty" | "setPackageParty"> & { formatDate: string };

/** FG-W3-01: a package is booked from its own slot finder (party size + start time). */
export function PackageSection({ form, setForm, selectedPackage, businessId, editing, packageParty, setPackageParty, formatDate }: PkgP) {
  if (!(selectedPackage && businessId && !editing)) return null;
  return (
    <PackageBookingPanel
      businessId={businessId}
      serviceId={form.serviceId}
      date={form.date || formatDate}
      maxParty={selectedPackage.maxPartySize}
      partySize={packageParty}
      onPartySize={setPackageParty}
      startTime={form.startTime}
      onStartTime={(hhmm) => setForm((prev) => ({ ...prev, startTime: hhmm }))}
    />
  );
}

type StaffP = Pick<BookingDrawerProps, "form" | "setForm" | "staff" | "bookingMode" | "initialsOf">;

/** Staff: avatar chips (`.chip.on` = chosen). In group mode this is member 1's staff. */
export function StaffSection({ form, setForm, staff, bookingMode, initialsOf }: StaffP) {
  return (
    <section className="bkd-sec">
      <div className="bkd-k">{bookingMode === "group" ? tr("calendar.withMember") : tr("calendar.with2")}</div>
      <div className="bkd-staff" role="radiogroup" aria-label={tr("common.staff")}>
        {staff.map((s) => {
          const on = form.staffId === s.id;
          return (
            <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setForm((prev) => ({ ...prev, staffId: s.id }))} className={`chip${on ? " on" : ""}`} style={{ border: 0, font: "inherit", cursor: "pointer" }}>
              <span className="ini">{initialsOf(s.name)}</span>
              {s.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
