import { describe, expect, it } from "vitest";

import { formatPrice } from "./currency";

describe("formatPrice", () => {
  it("uses the currency a row carries, with the right symbol (AZN is the manat sign)", () => {
    expect(formatPrice(12.5, "AZN")).toBe("12.50 ₼");
    expect(formatPrice(3, "eur")).toBe("3.00 €");
  });

  it("shows an unmapped code as the code itself", () => {
    expect(formatPrice(1, "TRY")).toBe("1.00 TRY");
  });

  it("treats junk amounts as zero", () => {
    expect(formatPrice(undefined, "AZN")).toBe("0.00 ₼");
    expect(formatPrice("abc", "AZN")).toBe("0.00 ₼");
  });
});
