import { Plus, Trash2 } from "lucide-react";
import { Btn, Field, FormGrid } from "@/components/bz";
import { t as tr } from "@/i18n";
import type { BookingDrawerProps } from "./types";

type GroupP = Pick<BookingDrawerProps, "form" | "bookingMode" | "groupMembers" | "setGroupMembers" | "staff" | "timeOptionsWith" | "serviceDuration" | "addMinutesToTime">;

/** Group members: each gets their own staff + start time (the primary client is member 1). */
export function GroupMembersSection({ form, bookingMode, groupMembers, setGroupMembers, staff, timeOptionsWith, serviceDuration, addMinutesToTime }: GroupP) {
  if (bookingMode !== "group") return null;
  const upd = (i: number, patch: Partial<(typeof groupMembers)[number]>) => setGroupMembers((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="bkd-box">
      <div className="hd">
        <span className="bkd-k">{tr("calendar.groupMembers")}</span>
        <span>{tr("calendar.primaryClientMember")}</span>
      </div>
      {groupMembers.map((m, i) => (
        <div key={i} className="stk" style={{ gap: 10, borderTop: i ? "1px solid var(--bz-line)" : 0, paddingTop: i ? 10 : 0 }}>
          <div className="row gap8">
            <div style={{ flex: 1 }}>
              <Field label={tr("calendar.member", { value: i + 2 })}>
                <input placeholder={tr("common.name")} value={m.clientName} onChange={(e) => upd(i, { clientName: e.target.value })} />
              </Field>
            </div>
            <button type="button" className="bkd-ico" aria-label={tr("calendar.removeMember")} onClick={() => setGroupMembers((prev) => prev.filter((_, j) => j !== i))}>
              <Trash2 className="ic" />
            </button>
          </div>
          <FormGrid cols={2}>
            <Field label={tr("common.staff")} kind="sel">
              <select value={m.staffId} onChange={(e) => upd(i, { staffId: e.target.value })}>
                {!m.staffId && <option value="" />}
                {staff.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </Field>
            <Field label={tr("calendar.start")} kind="sel">
              <select value={m.startTime} onChange={(e) => upd(i, { startTime: e.target.value })}>
                {!m.startTime && <option value="" />}
                {timeOptionsWith(m.startTime).map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </Field>
          </FormGrid>
          <Field label={tr("calendar.phoneOptional")}>
            <input value={m.clientPhone} onChange={(e) => upd(i, { clientPhone: e.target.value })} />
          </Field>
        </div>
      ))}
      <Btn
        kind="ol"
        icon={<Plus className="ic" />}
        onClick={() =>
          setGroupMembers((prev) => {
            // Default the new member to start right after the previous one on the same staff
            // (sequential, so no auto-conflict). Another staff lets them run at the same time.
            const last = prev[prev.length - 1];
            const prevStart = last?.startTime || form.startTime;
            const nextStart = prevStart ? addMinutesToTime(prevStart, serviceDuration(form.serviceId)) : form.endTime;
            return [...prev, { clientName: "", clientPhone: "", clientEmail: "", staffId: form.staffId, startTime: nextStart }];
          })
        }
      >
        {tr("calendar.addMember")}
      </Btn>
    </div>
  );
}

type ExtraP = Pick<
  BookingDrawerProps,
  "form" | "editing" | "editingVisit" | "bookingMode" | "selectedPackage" | "extraServices" | "setExtraServices" | "services" | "staff" | "timeOptionsWith" | "serviceDuration" | "addMinutesToTime"
>;

/** Extra services (multi-service): appended after the primary one. Not in group mode; add/remove hidden while editing. */
export function ExtraServicesSection({ form, editing, editingVisit, bookingMode, selectedPackage, extraServices, setExtraServices, services, staff, timeOptionsWith, serviceDuration, addMinutesToTime }: ExtraP) {
  if (bookingMode === "group" || (selectedPackage && !editing)) return null;
  const upd = (i: number, f: (x: (typeof extraServices)[number]) => (typeof extraServices)[number]) => setExtraServices((prev) => prev.map((x, j) => (j === i ? f(x) : x)));
  return (
    <div className="stk" style={{ gap: 10 }}>
      {extraServices.map((es, i) => (
        <div key={i} className="bkd-box">
          <div className="hd">
            <span>{editingVisit ? tr("calendar.service", { value: i + 2 }) : tr("calendar.extraService", { value: i + 1 })}</span>
            {!editing && (
              <button type="button" className="bkd-ico" aria-label={tr("calendar.removeService")} onClick={() => setExtraServices((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 className="ic" />
              </button>
            )}
          </div>
          <Field label={tr("common.service")} kind="sel">
            <select
              value={es.serviceId}
              onChange={(e) => {
                const v = e.target.value;
                upd(i, (x) => {
                  const start = x.startTime || form.endTime;
                  return { ...x, serviceId: v, endTime: start ? addMinutesToTime(start, serviceDuration(v)) : x.endTime };
                });
              }}
            >
              {!es.serviceId && <option value="" />}
              {services.map((s) => (<option key={s.id} value={s.id.toString()}>{s.name}</option>))}
            </select>
          </Field>
          <FormGrid cols={3}>
            <Field label={tr("common.staff")} kind="sel">
              <select value={es.staffId} onChange={(e) => upd(i, (x) => ({ ...x, staffId: e.target.value }))}>
                {!es.staffId && <option value="" />}
                {staff.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </Field>
            <Field label={tr("calendar.start")} kind="sel">
              <select value={es.startTime} onChange={(e) => upd(i, (x) => ({ ...x, startTime: e.target.value, endTime: addMinutesToTime(e.target.value, serviceDuration(x.serviceId)) }))}>
                {!es.startTime && <option value="" />}
                {timeOptionsWith(es.startTime).map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </Field>
            <Field label={tr("calendar.end")} kind="sel">
              <select value={es.endTime} onChange={(e) => upd(i, (x) => ({ ...x, endTime: e.target.value }))}>
                {!es.endTime && <option value="" />}
                {timeOptionsWith(es.endTime).map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </Field>
          </FormGrid>
        </div>
      ))}
      {editingVisit && <p className="sm t-m b7">{tr("calendar.thisBookingHasServicesYou", { count: editingVisit.ids.length })}</p>}
      {!editing && (
        <Btn
          kind="ol"
          icon={<Plus className="ic" />}
          onClick={() => {
            const start = form.endTime || form.startTime;
            setExtraServices((prev) => [...prev, { serviceId: "", staffId: form.staffId, startTime: start, endTime: start ? addMinutesToTime(start, 30) : "" }]);
          }}
        >
          {tr("calendar.addAnotherService")}
        </Btn>
      )}
    </div>
  );
}
