import { useState } from "react";
import { ChevronDown, Package, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Sec } from "./AF";
import { currencySymbol } from "@/lib/currency";
import { PackageBookingPanel } from "@/components/calendar/PackageBookingPanel";
import { t as tr } from "@/i18n";
import type { BookingDrawerProps } from "./types";

type SvcP = Pick<BookingDrawerProps, "form" | "setForm" | "services" | "serviceQuery" | "setServiceQuery" | "bookingMode">;

/** 4 Xidmət: combobox field (frame `.af`) that opens the searchable radio-card list (`.rd`) with name, duration, price. */
export function ServiceSection({ form, setForm, services, serviceQuery, setServiceQuery, bookingMode }: SvcP) {
  const [open, setOpen] = useState(false);
  const chosen = services.find((sv) => sv.id.toString() === form.serviceId);
  return (
    <>
      <Sec n={4}>{bookingMode === "group" ? tr("calendar.serviceAllMembers") : tr("common.service")}</Sec>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" role="combobox" aria-expanded={open} className="af af-btn">
            <div className="fld">
              <div>
                <small>
                  {tr("common.service")}
                  <i>*</i>
                </small>
                <b className={chosen ? undefined : "ph"}>
                  {chosen
                    ? `${chosen.name}${chosen.durationMinutes ? ` · ${tr("calendar.min3", { durationMinutes: chosen.durationMinutes })}` : ""}`
                    : tr("calendar.selectService")}
                </b>
              </div>
              <ChevronDown className="ic" aria-hidden />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-2xl p-2" align="start">
          {services.length > 6 && (
            <div className="srch" style={{ marginBottom: 8 }}>
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
                  <button key={service.id} type="button" role="radio" aria-checked={on} onClick={() => { setForm((prev) => ({ ...prev, serviceId: service.id.toString() })); setOpen(false); }} className={`rd${on ? " on" : ""}`}>
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
        </PopoverContent>
      </Popover>
    </>
  );
}

type PkgP = Pick<BookingDrawerProps, "form" | "setForm" | "selectedPackage" | "businessId" | "editing" | "packageParty" | "setPackageParty"> & { formatDate: string };

/** FG-W3-01: a package is booked from its own slot finder (party size + start time). */
export function PackageSection({ form, setForm, selectedPackage, businessId, editing, packageParty, setPackageParty, formatDate }: PkgP) {
  if (!(selectedPackage && businessId && !editing)) return null;
  return (
    <>
    <Sec n={5}>{tr("calendar.time2")}</Sec>
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
    </>
  );
}

type StaffP = Pick<BookingDrawerProps, "form" | "setForm" | "staff" | "bookingMode" | "initialsOf">;

/** 6 Mütəxəssis: name chips (`.a-chips`; `.vo` = chosen). In group mode this is member 1's staff. */
export function StaffSection({ form, setForm, staff, bookingMode }: StaffP) {
  return (
    <>
      <Sec n={6}>{bookingMode === "group" ? tr("calendar.withMember") : tr("calendar.with2")}</Sec>
      <div className="a-chips" role="radiogroup" aria-label={tr("common.staff")}>
        {staff.map((s) => {
          const on = form.staffId === s.id;
          return (
            <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setForm((prev) => ({ ...prev, staffId: s.id }))} className={cn("chip", on && "vo")}>
              {s.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
