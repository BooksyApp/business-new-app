import { describe, expect, it } from "vitest";
import { change, monthRange, prevMonth } from "./ExpensesPage";
import { payrollCsv } from "./PayrollPage";
import { addDays, weekStart } from "./TimesheetPage";

describe("FG-W1 money helpers", () => {
  it("month ranges and the month before", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it("change against last month", () => {
    expect(change(120, 100)).toBe("+20%");
    expect(change(80, 100)).toBe("-20%");
    expect(change(50, 0)).toBeNull();
  });

  it("weeks start on Monday", () => {
    expect(weekStart(new Date(2026, 10, 19))).toBe("2026-11-16");
    expect(addDays("2026-11-16", 6)).toBe("2026-11-22");
  });

  it("payroll CSV quotes names and keeps every line", () => {
    const csv = payrollCsv({
      id: "r", period_start: "2026-11-01", period_end: "2026-11-15", status: "DRAFT", total_amount: 10, approved_at: null,
      lines: [{ id: "l", staff_id: "s", staff_name: 'Aysel "A"', hours: 8, base_pay: 5, commission: 3, tips: 2, adjustment: 0, total: 10, note: null }],
    });
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain('"Aysel ""A"""');
  });
});
