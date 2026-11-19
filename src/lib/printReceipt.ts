import type { Sale } from "@/services/saleService";
import { t } from "@/i18n";
import { formatPrice } from "@/lib/currency";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/**
 * A plain printable receipt (or invoice, when one was issued) in a new window; the browser's
 * print dialog also saves it as a PDF. Built from the sale the server returned, so it shows
 * exactly what was charged.
 */
export function printReceipt(sale: Sale, opts: { salonName: string; invoiceNumber?: string | null; methods: { label: string; amount: number }[]; refunded: number; owed: number }) {
  const w = window.open("", "_blank", "noopener=no,width=480,height=720");
  if (!w) return false;
  const title = opts.invoiceNumber ? `${t("ledger.invoice")} ${opts.invoiceNumber}` : t("ledger.receipt");
  const lines = (sale.items ?? [])
    .map((i) => `<tr><td>${esc(i.serviceName)}${i.quantity > 1 ? ` × ${i.quantity}` : ""}</td><td class="r">${esc(formatPrice(i.totalPrice ?? i.unitPrice * i.quantity))}</td></tr>`)
    .join("");
  const tenders = opts.methods.map((m) => `<tr><td>${esc(m.label)}</td><td class="r">${esc(formatPrice(m.amount))}</td></tr>`).join("");
  const row = (label: string, v: number) => (v ? `<tr><td>${esc(label)}</td><td class="r">${esc(formatPrice(v))}</td></tr>` : "");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;color:#1d1730;margin:32px;max-width:420px}h1{font-size:18px;margin:0}
p{margin:2px 0;color:#6b6158}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:4px 0}
.r{text-align:right;font-variant-numeric:tabular-nums}.tot td{border-top:1px solid #ccc;font-weight:700;padding-top:8px}</style></head>
<body><h1>${esc(opts.salonName)}</h1><p>${esc(title)}${sale.billNumber ? ` · ${esc(sale.billNumber)}` : ""}</p>
<p>${esc(sale.saleDate)} ${esc(String(sale.saleTime ?? "").slice(0, 5))}${sale.clientName ? ` · ${esc(sale.clientName)}` : ""}</p>
<table>${lines}
${row(t("ledger.discount"), -Number(sale.discountAmount || 0))}${row(t("ledger.tip"), Number(sale.tipAmount || 0))}
<tr class="tot"><td>${esc(t("ledger.total"))}</td><td class="r">${esc(formatPrice(sale.total))}</td></tr></table>
<table>${tenders}${row(t("ledger.refunded"), -opts.refunded)}${row(t("ledger.owed"), opts.owed)}</table>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}
