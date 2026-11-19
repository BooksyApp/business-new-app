import { describe, expect, it } from "vitest";
import type { WaitlistEntry } from "@/services/waitlistService";
import { isBusy, phoneDigits, placeWaiting, suggestSlots } from "./waitlistCalendar";

const base = (over: Partial<WaitlistEntry>): WaitlistEntry => ({
  id: "w1", businessId: "b", staffId: "s1", serviceId: "svc", clientName: "Aysel", clientEmail: "a@x.test",
  clientPhone: "+994 50 123 45 67", preferredDate: "2026-11-20", status: "WAITING", serviceName: "Manicure",
  staffName: "Leyla", createdAt: null, ...over,
});

describe("placeWaiting", () => {
  it("draws a window at its start, capped at two hours", () => {
    const p = placeWaiting(base({ preferredStartTime: "10:00:00", preferredEndTime: "18:00:00" }), 45);
    expect(p).toMatchObject({ staffId: "s1", start: "10:00", end: "12:00", freed: false });
  });
  it("never draws a window shorter than the service", () => {
    const p = placeWaiting(base({ preferredStartTime: "10:00", preferredEndTime: "10:30" }), 60);
    expect(p.end).toBe("11:00");
  });
  it("puts a freed slot where it opened, even for any-master waiters", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const p = placeWaiting(
      base({ staffId: null, slotFreedAt: "2026-11-20T09:00:00Z", freedStaffId: "s2", freedStartTime: "14:00:00" }), 30, now);
    expect(p).toMatchObject({ staffId: "s2", start: "14:00", end: "14:30", freed: true });
  });
  it("forgets an old freed highlight", () => {
    const now = new Date("2026-11-21T10:00:00Z");
    const p = placeWaiting(base({ slotFreedAt: "2026-11-20T09:00:00Z", freedStaffId: "s1", freedStartTime: "14:00" }), 30, now);
    expect(p.freed).toBe(false);
    expect(p.start).toBeNull();
  });
  it("date-only has no block", () => {
    expect(placeWaiting(base({}), 30).start).toBeNull();
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
