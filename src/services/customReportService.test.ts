import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./customReportService";

describe("report CSV export", () => {
  it("neutralises spreadsheet formulas and quotes awkward cells", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+994501234567")).toBe("'+994501234567");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe("");
    // numbers are never prefixed, even negative ones
    expect(csvCell(-5)).toBe("-5");
  });

  it("writes a header row and a BOM", () => {
    const csv = toCsv({
      columns: [
        { key: "day", label: "Day", type: "date" },
        { key: "bookings", label: "Bookings", type: "number" },
      ],
      rows: [["2026-11-01", 3]],
      truncated: false,
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Day,Bookings\r\n2026-11-01,3\r\n");
  });
});
