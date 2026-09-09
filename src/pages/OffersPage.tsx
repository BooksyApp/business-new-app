import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentBusinessId } from "@/config/api";
import { currencySymbol } from "@/lib/currency";
import { discountService, type ServiceDiscount } from "@/services/discountService";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Cutting a price.
 *
 * The only discount this product had was a promo code, which a client has to already know
 * about — useless for filling a quiet Tuesday and invisible on your card. An offer set
 * here shows as a struck-through price on your services and as a badge on your card in the
 * app and on the web, which is the thing that makes somebody stop scrolling.
 */
export default function OffersPage() {
  const businessId = getCurrentBusinessId();
  const [rows, setRows] = useState<ServiceDiscount[] | null>(null);
  const [busy, setBusy] = useState(false);

  // The whole-menu sale, which is what most salons actually run.
  const [allPercent, setAllPercent] = useState("");
  const [allFrom, setAllFrom] = useState(today());
  const [allTo, setAllTo] = useState("");
  const [allLabel, setAllLabel] = useState("");

  const load = () =>
    discountService
      .list(businessId)
      .then(setRows)
      .catch(() => setRows([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const running = (rows ?? []).filter((row) => row.running);

  const act = (run: Promise<unknown>, message: string) => {
    setBusy(true);
    run
      .then(() => {
        toast.success(message);
        load();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not save that"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A cut price shows on your card in the app and on the web, with the old price struck
          through. Clients see it without needing a code.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Running now</p>
            <p className="mt-1 text-2xl font-semibold">{running.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Best offer</p>
            <p className="mt-1 text-2xl font-semibold">
              {running.length > 0
                ? `${Math.max(...running.map((r) => Number(r.discount_percent ?? 0)))}%`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">this is what the card shows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Services</p>
            <p className="mt-1 text-2xl font-semibold">{rows?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A sale across the whole menu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Percent off</span>
              <Input
                value={allPercent}
                onChange={(e) => setAllPercent(e.target.value)}
                inputMode="numeric"
                placeholder="20"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">From</span>
              <Input type="date" value={allFrom} onChange={(e) => setAllFrom(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Until (optional)</span>
              <Input type="date" value={allTo} onChange={(e) => setAllTo(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">Badge text (optional)</span>
              <Input
                value={allLabel}
                onChange={(e) => setAllLabel(e.target.value)}
                placeholder="New client price"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={busy || !allPercent.trim()}
              onClick={() =>
                act(
                  discountService.setForAll(businessId, {
                    percent: Number(allPercent),
                    startsOn: allFrom || null,
                    endsOn: allTo || null,
                    label: allLabel || null,
                  }),
                  "The sale is on"
                )
              }
            >
              Put everything on offer
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!confirm("End every offer on the menu?")) return;
                act(discountService.setForAll(businessId, { percent: null }), "Offers ended");
              }}
            >
              End all offers
            </Button>
            <p className="text-xs text-muted-foreground">
              No end date means it runs until you stop it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">One service at a time</CardTitle>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You have no services yet.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <ServiceRow
                  key={row.id}
                  row={row}
                  businessId={businessId}
                  busy={busy}
                  onSaved={(message, promise) => act(promise, message)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceRow({
  row,
  businessId,
  busy,
  onSaved,
}: {
  row: ServiceDiscount;
  businessId: number;
  busy: boolean;
  onSaved: (message: string, promise: Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(row.discount_percent ? String(row.discount_percent) : "");
  const [from, setFrom] = useState(row.discount_starts_on ?? "");
  const [to, setTo] = useState(row.discount_ends_on ?? "");
  const [label, setLabel] = useState(row.discount_label ?? "");

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.name}</p>
          <p className="text-sm text-muted-foreground">
            {row.discount_percent ? (
              <>
                <span className="line-through">
                  {row.price} {currencySymbol()}
                </span>{" "}
                <span className="font-semibold text-foreground">
                  {row.sale_price} {currencySymbol()}
                </span>
              </>
            ) : (
              <>
                {row.price} {currencySymbol()}
              </>
            )}
            {" · "}
            {row.duration} min
          </p>
        </div>

        {row.discount_percent ? (
          <Badge variant={row.running ? "default" : "secondary"}>
            {row.discount_label || `-${row.discount_percent}%`}
            {!row.running && " · not running"}
          </Badge>
        ) : null}

        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {row.discount_percent ? "Change" : "Put on offer"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-5">
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Percent off</span>
            <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="numeric" />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Until</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground">Badge text</span>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`-${percent || "20"}%`} />
          </label>
          <div className="flex items-end gap-2">
            <Button
              size="sm"
              disabled={busy || !percent.trim()}
              onClick={() => {
                setOpen(false);
                onSaved(
                  "Offer saved",
                  discountService.setForService(businessId, row.id, {
                    percent: Number(percent),
                    startsOn: from || null,
                    endsOn: to || null,
                    label: label || null,
                  })
                );
              }}
            >
              Save
            </Button>
            {row.discount_percent ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setPercent("");
                  onSaved(
                    "Offer removed",
                    discountService.setForService(businessId, row.id, { percent: null })
                  );
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
