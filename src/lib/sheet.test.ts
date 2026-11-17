import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./sheet";

describe("parseCsv", () => {
  it("detects the delimiter and keeps quoted fields", () => {
    expect(parseCsv('﻿Ad;Telefon\n"Aytən; M";050 111 22 33\r\n\nLeyla;0551234567\n')).toEqual([
      ["Ad", "Telefon"],
      ["Aytən; M", "050 111 22 33"],
      ["Leyla", "0551234567"],
    ]);
    expect(parseCsv('name,note\nA,"say ""hi""\nthere"')).toEqual([["name", "note"], ["A", 'say "hi"\nthere']]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["a,b", 'q"q'], ["x", "y"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
