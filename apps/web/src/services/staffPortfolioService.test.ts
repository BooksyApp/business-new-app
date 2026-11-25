import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/config/api";
import { moveItem, staffPortfolioService } from "./staffPortfolioService";

// FG-W2-29: the hub talks to /businesses/{b}/staff/{s}/portfolio with these exact shapes.
describe("staffPortfolioService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const B = "b-uuid";
  const S = "s-uuid";

  it("lists a specialist's photos under the salon", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue([]);
    await staffPortfolioService.list(B, S);
    expect(get).toHaveBeenCalledWith("/businesses/b-uuid/staff/s-uuid/portfolio");
  });

  it("adds an upload with a trimmed caption, empty fields as null", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({});
    await staffPortfolioService.add(B, S, { upload: "u1", caption: "  Ombre  ", serviceId: "svc" });
    expect(post).toHaveBeenCalledWith("/businesses/b-uuid/staff/s-uuid/portfolio",
      { upload: "u1", caption: "Ombre", serviceId: "svc" });
    await staffPortfolioService.add(B, S, { upload: "u2", caption: "   ", serviceId: "" });
    expect(post).toHaveBeenLastCalledWith("/businesses/b-uuid/staff/s-uuid/portfolio",
      { upload: "u2", caption: null, serviceId: null });
  });

  it("updates, deletes and reorders by photo id", async () => {
    const put = vi.spyOn(apiClient, "put").mockResolvedValue({});
    const del = vi.spyOn(apiClient, "delete").mockResolvedValue(undefined);
    await staffPortfolioService.update(B, S, "p1", { caption: "Bob", serviceId: null });
    expect(put).toHaveBeenCalledWith("/businesses/b-uuid/staff/s-uuid/portfolio/p1", { caption: "Bob", serviceId: null });
    await staffPortfolioService.reorder(B, S, ["p2", "p1"]);
    expect(put).toHaveBeenLastCalledWith("/businesses/b-uuid/staff/s-uuid/portfolio/order", { ids: ["p2", "p1"] });
    await staffPortfolioService.remove(B, S, "p1");
    expect(del).toHaveBeenCalledWith("/businesses/b-uuid/staff/s-uuid/portfolio/p1");
  });
});

describe("moveItem", () => {
  it("swaps one step and leaves the ends alone", () => {
    const xs = ["a", "b", "c"];
    expect(moveItem(xs, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(xs, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(xs, 0, -1)).toBe(xs);
    expect(moveItem(xs, 2, 1)).toBe(xs);
    expect(xs).toEqual(["a", "b", "c"]);
  });
});
