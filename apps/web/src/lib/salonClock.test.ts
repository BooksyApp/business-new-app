import { describe, expect, it } from "vitest";
import { isSalonToday, salonNow, salonToday, setCurrentSalonZone } from "./salonClock";

describe("salonNow", () => {
  it("07:00 in Baku is 03:00 UTC", () => {
    const d = salonNow("Asia/Baku", new Date("2026-11-16T03:00:00Z"));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 16, 7, 0]);
  });
  it("rolls to the next day in Baku before UTC does", () => {
    const d = salonNow("Asia/Baku", new Date("2026-11-15T21:30:00Z"));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([16, 1, 30]);
  });
  it("falls back to Asia/Baku for a missing or bad zone", () => {
    const at = new Date("2026-11-16T03:00:00Z");
    expect(salonNow(null, at).getHours()).toBe(7);
    expect(salonNow("Not/AZone", at).getHours()).toBe(7);
    expect(salonNow("Europe/Warsaw", at).getHours()).toBe(4);
  });
  it("isSalonToday compares with the salon's date", () => {
    expect(isSalonToday(salonNow("Asia/Baku"), "Asia/Baku")).toBe(true);
  });
});

describe("salonToday", () => {
  it("is YYYY-MM-DD on the open salon's clock when no zone is passed", () => {
    setCurrentSalonZone("Asia/Baku");
    expect(salonToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(salonToday()).toBe(salonToday("Asia/Baku"));
    setCurrentSalonZone(null);
  });
  it("uses the open salon's zone as the default for salonNow", () => {
    const at = new Date("2026-11-16T03:00:00Z");
    setCurrentSalonZone("Europe/Warsaw");
    expect(salonNow(undefined, at).getHours()).toBe(4);
    setCurrentSalonZone(null);
    expect(salonNow(undefined, at).getHours()).toBe(7);
  });
});
