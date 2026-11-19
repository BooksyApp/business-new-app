import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useBusinessId } from "@/hooks/useBusinessId";
import { t } from "@/i18n";
import { onlineSalesService, type OnlineSalesSettings } from "@/services/onlineSalesService";

const card = "space-y-4 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]";

/** Settings > Payments > Online sales: gift cards and wallet top-ups (the shop is switched per product). */
export default function OnlineSalesSettingsPage() {
  const businessId = useBusinessId();
  const [s, setS] = useState<OnlineSalesSettings | null>(null);
  const [presets, setPresets] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    onlineSalesService
      .get(businessId)
      .then((v) => {
        setS(v);
        setPresets(v.giftCardPresets.join(", "));
      })
      .catch(() => toast.error(t("onlineSales.loadFailed")));
  }, [businessId]);

  const save = async () => {
    if (!businessId || !s) return;
    const list = presets
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    if (list.some((n) => !Number.isFinite(n) || n <= 0)) {
      toast.error(t("onlineSales.presetsInvalid"));
      return;
    }
    setBusy(true);
    try {
      const next = await onlineSalesService.update(businessId, {
        giftCardsEnabled: s.giftCardsEnabled,
        giftCardMin: s.giftCardMin,
        giftCardMax: s.giftCardMax,
        giftCardPresets: list,
        walletEnabled: s.walletEnabled,
        walletMin: s.walletMin,
        walletMax: s.walletMax,
      });
      setS(next);
      setPresets(next.giftCardPresets.join(", "));
      toast.success(t("onlineSales.saved"));
    } catch {
      toast.error(t("onlineSales.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("onlineSales.title")} subtitle={t("onlineSales.subtitle")} />
        <div className={pageBody}>
          {s && !s.stripeEnabled && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("onlineSales.noStripe")}</p>
          )}
          {s && (
            <>
              <section className={card}>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-semibold">{t("onlineSales.giftCards")}</span>
                    <span className="text-sm text-[rgb(var(--reg-muted))]">{t("onlineSales.giftCardsHint")}</span>
                  </span>
                  <Switch checked={s.giftCardsEnabled} onCheckedChange={(v) => setS({ ...s, giftCardsEnabled: v })} />
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("onlineSales.min")} htmlFor="gc-min">
                    <input id="gc-min" className={fieldCls} type="number" min={1} step="1" value={s.giftCardMin} onChange={(e) => setS({ ...s, giftCardMin: num(e.target.value) })} />
                  </Field>
                  <Field label={t("onlineSales.max")} htmlFor="gc-max">
                    <input id="gc-max" className={fieldCls} type="number" min={1} step="1" value={s.giftCardMax} onChange={(e) => setS({ ...s, giftCardMax: num(e.target.value) })} />
                  </Field>
                  <Field label={t("onlineSales.presets")} htmlFor="gc-presets">
                    <input id="gc-presets" className={fieldCls} value={presets} onChange={(e) => setPresets(e.target.value)} placeholder="25, 50, 100" />
                  </Field>
                </div>
                <p className="text-xs text-[rgb(var(--reg-muted))]">{t("onlineSales.soldCount", { value: s.onlineSales })}</p>
              </section>

              <section className={card}>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-semibold">{t("onlineSales.wallet")}</span>
                    <span className="text-sm text-[rgb(var(--reg-muted))]">{t("onlineSales.walletHint")}</span>
                  </span>
                  <Switch checked={s.walletEnabled} onCheckedChange={(v) => setS({ ...s, walletEnabled: v })} />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("onlineSales.min")} htmlFor="w-min">
                    <input id="w-min" className={fieldCls} type="number" min={1} step="1" value={s.walletMin} onChange={(e) => setS({ ...s, walletMin: num(e.target.value) })} />
                  </Field>
                  <Field label={t("onlineSales.max")} htmlFor="w-max">
                    <input id="w-max" className={fieldCls} type="number" min={1} step="1" value={s.walletMax} onChange={(e) => setS({ ...s, walletMax: num(e.target.value) })} />
                  </Field>
                </div>
              </section>

              <p className="text-sm text-[rgb(var(--reg-muted))]">{t("onlineSales.shopHint")}</p>
              <div>
                <Button className={primaryBtn} disabled={busy} onClick={() => void save()}>
                  {t("onlineSales.save")}
                </Button>
              </div>
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
