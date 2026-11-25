/**
 * #12: the zł symbol was hardcoded at ~60 call sites across 15 files, so a business
 * on any other currency saw Polish złoty on every price, receipt and report — and
 * changing it meant editing every file.
 *
 * `businesses.currency` has existed since V17 (VARCHAR(3), default USD) and the API
 * already returns it; nothing on the client ever read it. This is the single place
 * the symbol comes from, so wiring it to the real business value is now one change
 * here instead of sixty.
 */
const SYMBOLS: Record<string, string> = {
  PLN: "zł",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CZK: "Kč",
  AZN: "₼",
};

/** ISO code of the current business, from the copy login stores. */
export function currentCurrencyCode(): string {
  try {
    const raw = localStorage.getItem("currentBusiness");
    const code = raw ? JSON.parse(raw)?.currency : null;
    return typeof code === "string" && code.length === 3 ? code.toUpperCase() : "PLN";
  } catch {
    // A malformed cache must not take a price display down.
    return "PLN";
  }
}

/** Display symbol for the current business. Falls back to the ISO code if unmapped. */
export function currencySymbol(): string {
  const code = currentCurrencyCode();
  return SYMBOLS[code] ?? code;
}

/** `12.50 zł` — the format every screen was already producing by hand. */
export function formatPrice(amount: number | string | null | undefined, currency?: string | null): string {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount ?? 0));
  // A row that carries its own currency (a promotion bought in AZN) is shown in it, not in the cached one.
  const code = typeof currency === "string" && currency.length === 3 ? currency.toUpperCase() : null;
  const symbol = code ? SYMBOLS[code] ?? code : currencySymbol();
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${symbol}`;
}
