import { describe, expect, it } from "vitest";
import { packageTotals, visitAccent } from "./servicePackage";

describe("packageTotals", () => {
  it("adds sequential steps", () => {
    const r = packageTotals([{ parallel: false }, { parallel: false }], [
      { durationMinutes: 30, price: 10 }, { durationMinutes: 45, price: 20 },
    ]);
    expect(r).toEqual({ totalDurationMinutes: 75, totalPrice: 30 });
  });
  it("runs a parallel step alongside the previous one", () => {
    const r = packageTotals([{ parallel: false }, { parallel: true }, { parallel: false }], [
      { durationMinutes: 30, price: 10 }, { durationMinutes: 60, price: 20 }, { durationMinutes: 15, price: 5 },
    ]);
    expect(r).toEqual({ totalDurationMinutes: 75, totalPrice: 35 });
  });
  it("ignores parallel on the first step", () => {
    expect(packageTotals([{ parallel: true }], [{ durationMinutes: 20, price: 1 }]).totalDurationMinutes).toBe(20);
  });
});

describe("visitAccent", () => {
  it("is deterministic and empty-safe", () => {
    expect(visitAccent("abc")).toBe(visitAccent("abc"));
    expect(visitAccent(null)).toBeNull();
  });
});
