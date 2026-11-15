import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { businessService } from "@/services/businessService";
import { t } from "@/i18n";

/**
 * Setup listed "Password" under Security with nothing behind it, and no change-password
 * endpoint existed either — an owner who believed their password was exposed had no route
 * short of a database edit.
 */
export default function SecurityPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const ready = current.length > 0 && next.length >= 8 && next === confirm;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await businessService.changePassword(current, next);
      toast.success(res.message ?? t("security.passwordChanged"));
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("security.couldNotChangeYourPassword"));
    } finally {
      setSaving(false);
    }
  };

  // Rough strength: length and character mix — a nudge, not a gate (the server decides).
  const strength = Math.min(4, [next.length >= 8, next.length >= 12, /[A-Z]/.test(next) && /[a-z]/.test(next), /\d|[^\w]/.test(next)].filter(Boolean).length);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("security.security")} subtitle={t("security.yourSignInDetails")} />
        <div className={pageBody}>
          <section className="max-w-xl rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]"><KeyRound size={18} /></span>
              <div>
                <h2 className="text-base font-extrabold">{t("security.changePassword")}</h2>
                <p className="text-sm text-[rgb(var(--reg-muted))]">{t("security.atLeastCharacters")}</p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready && !saving) void submit(); }}>
              <Field label={t("security.currentPassword")} htmlFor="pw-current">
                <input id="pw-current" type="password" className={fieldCls} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
              </Field>
              <Field label={t("security.newPassword")} htmlFor="pw-new" hint={tooShort ? <span className="text-rose-700">{t("security.atLeastCharacters")}</span> : undefined}>
                <input id="pw-new" type="password" className={fieldCls} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-invalid={tooShort} />
                {next && (
                  <div className="flex items-center gap-2 pt-1" aria-live="polite">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= strength ? (strength >= 3 ? "bg-emerald-500" : "bg-amber-500") : "bg-[rgb(var(--reg-ink)/0.08)]")} />
                      ))}
                    </div>
                    <span className="w-12 text-right text-xs font-semibold text-[rgb(var(--reg-muted))]">{strengthLabel}</span>
                  </div>
                )}
              </Field>
              <Field label={t("security.confirmNewPassword")} htmlFor="pw-confirm" hint={mismatch ? <span className="text-rose-700">{t("security.theseDoNotMatch")}</span> : undefined}>
                <input id="pw-confirm" type="password" className={fieldCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
              </Field>
              {/* Said before the click, not after: someone changing a password because they
                  think it leaked needs to know the other session actually gets closed. */}
              <p className="flex items-center gap-2 rounded-2xl bg-[rgb(var(--reg-canvas))] px-3 py-2.5 text-sm text-[rgb(var(--reg-ink)/0.8)]">
                <ShieldCheck size={16} className="shrink-0 text-[rgb(var(--reg-brand))]" />{" "}{t("security.changingYourPasswordSignsYou")}
              </p>
              <Button type="submit" className={primaryBtn} disabled={!ready || saving}>
                {saving ? t("security.changing") : t("security.changePassword")}
              </Button>
            </form>
          </section>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
