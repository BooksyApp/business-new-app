import type { Id } from "@/types/id";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { FormSheet } from "@/components/page/booqi";
import { sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/i18n";
import { salonDayService, type StockLocation } from "@/services/salonDayService";

const NAME_MAX = 120;

/** Invalidate everything that depends on stock quantities, whichever location it was for. */
export function useInvalidateStock(businessId: Id) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["stock-levels", businessId] }),
      qc.invalidateQueries({ queryKey: ["stock-low", businessId] }),
      qc.invalidateQueries({ queryKey: ["stock-transfers", businessId] }),
    ]);
}

/** The salon's stock locations and the one currently picked (the default until the user picks). */
export function useStockLocations(businessId: Id) {
  const [picked, setPicked] = useState<Id | null>(null);
  const q = useQuery({
    queryKey: ["stock-locations", businessId],
    queryFn: () => salonDayService.getStockLocations(businessId),
  });
  const locations = q.data ?? [];
  const current =
    locations.find((l) => String(l.id) === String(picked)) ?? locations.find((l) => l.is_default) ?? locations[0];
  return {
    locations,
    location: current,
    locationId: current?.id as Id | undefined,
    setLocationId: setPicked,
    ready: !!current,
  };
}

export const locationLabel = (l: Pick<StockLocation, "name" | "is_default">) =>
  l.is_default ? t("inventory.defaultLocation") : l.name;

export function LocationSelect({
  locations,
  value,
  onChange,
  className,
}: {
  locations: StockLocation[];
  value?: Id;
  onChange: (id: Id) => void;
  className?: string;
}) {
  if (locations.length === 0) return null;
  return (
    <Select value={value === undefined ? undefined : String(value)} onValueChange={(v) => onChange(v as Id)}>
      <SelectTrigger aria-label={t("inventory.location")} className={className ?? "h-11 w-[200px] rounded-full"}>
        <SelectValue placeholder={t("inventory.location")} />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={String(l.id)} value={String(l.id)}>
            {locationLabel(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TransferSheet({
  businessId,
  product,
  from,
  locations,
  onClose,
}: {
  businessId: Id;
  product: { id: Id; name: string } | null;
  from?: StockLocation;
  locations: StockLocation[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateStock(businessId);
  const [to, setTo] = useState<Id | "">("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const targets = locations.filter((l) => String(l.id) !== String(from?.id));

  const submit = async () => {
    const quantity = Number(qty);
    if (!product || !from || !to) {
      toast.error(t("inventory.pickDestination"));
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error(t("inventory.transferQuantityInvalid"));
      return;
    }
    setSaving(true);
    try {
      await salonDayService.transferStock(businessId, {
        productId: product.id,
        fromLocationId: from.id,
        toLocationId: to,
        quantity,
        note: note.trim() || undefined,
      });
      toast.success(t("inventory.transferDone"));
      await invalidate();
      setTo("");
      setQty("1");
      setNote("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.transferFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={!!product}
      onOpenChange={(o) => !o && onClose()}
      title={t("inventory.transferTitle", { name: product?.name ?? "" })}
      description={from ? t("inventory.transferFrom", { from: locationLabel(from) }) : ""}
      footer={
        <>
          <Button variant="outline" className={sheetSecondary} onClick={onClose}>{t("common.cancel")}</Button>
          <Button className={sheetPrimary} onClick={() => void submit()} disabled={saving}>
            {saving ? t("common.saving") : t("inventory.transfer")}
          </Button>
        </>
      }
    >
      <Field label={t("inventory.transferTo")} htmlFor="tr-to">
        <LocationSelect locations={targets} value={to || undefined} onChange={setTo} className="h-11 w-full rounded-xl" />
      </Field>
      <Field label={t("inventory.transferQuantity")} htmlFor="tr-qty">
        <input id="tr-qty" type="number" inputMode="numeric" min={1} step={1} className={fieldCls} value={qty} onChange={(e) => setQty(e.target.value)} />
      </Field>
      <Field label={t("inventory.transferNote")} htmlFor="tr-note">
        <input id="tr-note" className={fieldCls} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormSheet>
  );
}

export function LocationsSheet({
  businessId,
  open,
  locations,
  onClose,
}: {
  businessId: Id;
  open: boolean;
  locations: StockLocation[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["stock-locations", businessId] });
  const valid = (name: string) => name.trim().length > 0 && name.trim().length <= NAME_MAX;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.locationFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("inventory.manageLocations")}
      description={t("inventory.manageLocationsHint")}
      footer={<Button variant="outline" className={sheetSecondary} onClick={onClose}>{t("common.close")}</Button>}
    >
      {locations.map((l) => {
        const key = String(l.id);
        const value = edits[key] ?? l.name;
        return (
          <div key={key} className="flex items-center gap-2">
            <input
              aria-label={t("inventory.locationName")}
              className={fieldCls}
              maxLength={NAME_MAX}
              value={value}
              onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
            />
            <Button
              variant="outline"
              className={sheetSecondary}
              disabled={busy || value.trim() === l.name || !valid(value)}
              onClick={() => void run(async () => {
                await salonDayService.renameStockLocation(businessId, l.id, value.trim());
                setEdits((prev) => { const { [key]: _drop, ...rest } = prev; return rest; });
              }, t("inventory.locationRenamed"))}
            >
              {t("common.save")}
            </Button>
          </div>
        );
      })}
      <Field label={t("inventory.newLocation")} htmlFor="loc-new">
        <div className="flex items-center gap-2">
          <input id="loc-new" className={fieldCls} maxLength={NAME_MAX} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button
            className={sheetPrimary}
            disabled={busy || !valid(newName)}
            onClick={() => void run(async () => {
              await salonDayService.createStockLocation(businessId, newName.trim());
              setNewName("");
            }, t("inventory.locationAdded"))}
          >
            {t("inventory.addLocation")}
          </Button>
        </div>
      </Field>
    </FormSheet>
  );
}

export function RecentTransfers({ businessId }: { businessId: Id }) {
  const q = useQuery({
    queryKey: ["stock-transfers", businessId],
    queryFn: () => salonDayService.getStockTransfers(businessId, 10),
  });
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section aria-label={t("inventory.recentTransfers")} className="space-y-2">
      <h2 className="text-sm font-bold">{t("inventory.recentTransfers")}</h2>
      <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
        {rows.map((r, i) => (
          <li key={String(r.id)} className={"flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm md:px-5" + (i > 0 ? " border-t border-[rgb(var(--reg-line)/0.6)]" : "")}>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.product_name}</span>
            <span className="text-[rgb(var(--reg-muted))]">{r.from_name} {"→"} {r.to_name}</span>
            <span className="tabular-nums font-semibold">{r.quantity}</span>
            <span className="text-xs text-[rgb(var(--reg-muted))]">{new Date(r.created_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
