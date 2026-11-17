import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/config/api";
import { clientService } from "./clientService";

// Founder 2026-11-17: the calendar would not open — a customer with no client row (R02 G4)
// came back without `id`, and the client picker called id.toString() on it.
describe("clientService.getClientsByBusiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops rows without an id, keeps the rest", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue([
      { id: "e811ab70-2f57-4254-91e5-e96cd3dca655", firstName: "A" },
      { clientKey: "u:12", firstName: "Booked-only" },
      { id: 7, firstName: "B" },
    ]);
    const rows = await clientService.getClientsByBusiness("b");
    expect(rows.map((r) => String(r.id))).toEqual(["e811ab70-2f57-4254-91e5-e96cd3dca655", "7"]);
  });
});
