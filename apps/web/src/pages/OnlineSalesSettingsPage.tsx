import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Btn, Field, FormGrid, Note, Tag, Toggle } from "@/components/bz";
import { SettingsFrame } from "@/components/bz/p3-Settings";
import { useBusinessId } from "@/hooks/useBusinessId";
import { t } from "@/i18n";
import { onlineSalesService, type OnlineSalesSettings } from "@/services/onlineSalesService";

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
      <SettingsFrame
        title={t("onlineSales.title")}
        sub={t("onlineSales.subtitle")}
        right={s ? <Btn kind="v" disabled={busy} onClick={() => void save()}>{t("onlineSales.save")}</Btn> : undefined}
      >
        {s && !s.stripeEnabled && <Note kind="wa">{t("onlineSales.noStripe")}</Note>}
        {s && (
          <>
            <Toggle title={t("onlineSales.giftCards")} help={t("onlineSales.giftCardsHint")} checked={s.giftCardsEnabled} onChange={(v) => setS({ ...s, giftCardsEnabled: v })} />
            <FormGrid cols={3}>
              <Field label={t("onlineSales.min")}>
                <input id="gc-min" type="number" min={1} step="1" value={s.giftCardMin} onChange={(e) => setS({ ...s, giftCardMin: num(e.target.value) })} />
              </Field>
              <Field label={t("onlineSales.max")}>
                <input id="gc-max" type="number" min={1} step="1" value={s.giftCardMax} onChange={(e) => setS({ ...s, giftCardMax: num(e.target.value) })} />
              </Field>
              <Field label={t("onlineSales.presets")}>
                <input id="gc-presets" value={presets} onChange={(e) => setPresets(e.target.value)} placeholder="25, 50, 100" />
              </Field>
            </FormGrid>
            <Tag>{t("onlineSales.soldCount", { value: s.onlineSales })}</Tag>

            <Toggle title={t("onlineSales.wallet")} help={t("onlineSales.walletHint")} checked={s.walletEnabled} onChange={(v) => setS({ ...s, walletEnabled: v })} />
            <FormGrid cols={2}>
              <Field label={t("onlineSales.min")}>
                <input id="w-min" type="number" min={1} step="1" value={s.walletMin} onChange={(e) => setS({ ...s, walletMin: num(e.target.value) })} />
              </Field>
              <Field label={t("onlineSales.max")}>
                <input id="w-max" type="number" min={1} step="1" value={s.walletMax} onChange={(e) => setS({ ...s, walletMax: num(e.target.value) })} />
              </Field>
            </FormGrid>

            <Note kind="in">{t("onlineSales.shopHint")}</Note>
          </>
        )}
      </SettingsFrame>
    </AppLayout>
  );
}
