import { describe, expect, it } from "vitest";
import { pinOutsideMarket } from "./marketBounds";

describe("pinOutsideMarket (LR-15)", () => {
  it("trusts the geocoder's country code", () => {
    expect(pinOutsideMarket("AZ", 41.72, 44.79, "ge")).toBe(true); // Tbilisi
    expect(pinOutsideMarket("AZ", 40.41, 49.87, "az")).toBe(false); // Baku
  });
  it("falls back to the AZ box when the geocoder gave nothing", () => {
    expect(pinOutsideMarket("AZ", 40.41, 49.87)).toBe(false); // Baku
    expect(pinOutsideMarket("AZ", 39.21, 45.41)).toBe(false); // Nakhchivan
    expect(pinOutsideMarket("AZ", 52.23, 21.01)).toBe(true); // Warsaw
    expect(pinOutsideMarket("AZ", 35.69, 51.39)).toBe(true); // Tehran
  });
  it("never blocks when the market or its box is unknown", () => {
    expect(pinOutsideMarket(null, 52.23, 21.01)).toBe(false);
    expect(pinOutsideMarket("PL", 40.41, 49.87)).toBe(false);
  });
});
