import { describe, expect, it } from "vitest";
import type { WaitlistEntry } from "@/services/waitlistService";
import { isBusy, phoneDigits, placeWaiting, suggestSlots } from "./waitlistCalendar";

const base = (over: Partial<WaitlistEntry>): WaitlistEntry => ({
  id: "w1", businessId: "b", staffId: "s1", serviceId: "svc", clientName: "Aysel", clientEmail: "a@x.test",
  clientPhone: "+994 50 123 45 67", preferredDate: "2026-11-20", status: "WAITING", serviceName: "Manicure",
  staffName: "Leyla", createdAt: null, ...over,
});

const ctx = { masters: ["s1", "s2"], openMin: 600 };

describe("placeWaiting", () => {
  it("draws a window at its start, capped at two hours", () => {
    const p = placeWaiting(base({ preferredStartTime: "10:00:00", preferredEndTime: "18:00:00" }), 45, ctx);
    expect(p).toMatchObject({ staffId: "s1", start: "10:00", end: "12:00", freed: false, anyMaster: false });
  });
  it("never draws a window shorter than the service", () => {
    expect(placeWaiting(base({ preferredStartTime: "10:00", preferredEndTime: "10:30" }), 60, ctx).end).toBe("11:00");
  });
  it("puts a freed slot where it opened, even for any-master waiters", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const p = placeWaiting(
      base({ staffId: null, slotFreedAt: "2026-11-20T09:00:00Z", freedStaffId: "s2", freedStartTime: "14:00:00" }), 30, ctx, now);
    expect(p).toMatchObject({ staffId: "s2", start: "14:00", end: "14:30", freed: true, anyMaster: true });
  });
  it("forgets an old freed highlight and falls back", () => {
    const now = new Date("2026-11-21T10:00:00Z");
    const p = placeWaiting(base({ slotFreedAt: "2026-11-20T09:00:00Z", freedStaffId: "s1", freedStartTime: "14:00" }), 30, ctx, now);
    expect(p.freed).toBe(false);
    expect(p.start).toBe("10:00");
  });
  it("any master goes to the first suitable master, marked", () => {
    const p = placeWaiting(base({ staffId: null }), 30, ctx);
    expect(p).toMatchObject({ staffId: "s1", anyMaster: true });
  });
  it("uses the time the client tried to book when there is no window", () => {
    const p = placeWaiting(base({ preferredTime: "15:30:00" }), 45, ctx);
    expect(p).toMatchObject({ start: "15:30", end: "16:15" });
  });
  it("last resort: opening time, service-long", () => {
    expect(placeWaiting(base({}), 30, ctx)).toMatchObject({ start: "10:00", end: "10:30" });
  });
  it("no master available means no block", () => {
    expect(placeWaiting(base({ staffId: null }), 30, { masters: [], openMin: 600 }).staffId).toBeNull();
  });
});

describe("suggestSlots", () => {
  const masters = [{ id: "s1", name: "Leyla" }, { id: "s2", name: "Nigar" }];
  it("skips busy ranges and offers other masters separately", () => {
    const busy = [{ staffId: "s1", start: "10:00", end: "12:00" }];
    const r = suggestSlots({ masters, preferredStaffId: "s1", busy, dayStartMin: 600, dayEndMin: 720, durationMin: 30, anchorMin: 600 });
    expect(r.same.map((s) => s.time)).toEqual([]);
    expect(r.others[0]).toMatchObject({ staffId: "s2", time: "10:00" });
  });
  it("finds the nearest gap for the same master", () => {
    const busy = [{ staffId: "s1", start: "10:00", end: "11:00" }];
    const r = suggestSlots({ masters, preferredStaffId: "s1", busy, dayStartMin: 600, dayEndMin: 780, durationMin: 30, anchorMin: 630 });
    expect(r.same[0].time).toBe("11:00");
  });
  it("does not call a touching range busy", () => {
    expect(isBusy([{ staffId: "s1", start: "10:00", end: "11:00" }], "s1", "11:00", "11:30")).toBe(false);
  });
});

describe("phoneDigits", () => {
  it("strips formatting", () => expect(phoneDigits("+994 (50) 123-45-67")).toBe("994501234567"));
});
