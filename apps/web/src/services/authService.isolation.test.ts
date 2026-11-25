import { afterEach, describe, expect, it, vi } from "vitest";
import { authService } from "./authService";

// Role isolation: the panel signs in as app "hub" and explains a customer / booqi-team account.
function answer(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

describe("authService.login — role isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends app: 'WEB_BUSINESS'", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "a" }), { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    await authService.login({ email: "o@x.test", password: "pw" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).app).toBe("WEB_BUSINESS");
  });

  it("a customer account gets the customer-account message, not the raw code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(403, { status: 403, detail: "ACCOUNT_IS_CUSTOMER" })));
    const err = await authService.login({ email: "c@x.test", password: "pw" }).catch((e) => e);
    expect(err.status).toBe(403);
    expect(err.message).not.toContain("ACCOUNT_IS_CUSTOMER");
    expect(err.message.length).toBeGreaterThan(20);
  });

  it("a booqi-team account gets its own message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(answer(403, { status: 403, detail: "ACCOUNT_IS_ADMIN" })));
    const err = await authService.login({ email: "a@x.test", password: "pw" }).catch((e) => e);
    expect(err.message).not.toContain("ACCOUNT_IS_ADMIN");
  });
});
