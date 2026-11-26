import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { Btn, Card, Field, Note } from "@/components/bz";
import { SettingsFrame } from "@/components/bz/p3-Settings";
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
      <SettingsFrame title={t("security.security")} sub={t("security.yourSignInDetails")}>
        <Card title={t("security.changePassword")} help={t("security.atLeastCharacters")}>
          <form className="stk" onSubmit={(e) => { e.preventDefault(); if (ready && !saving) void submit(); }}>
            <Field label={t("security.currentPassword")}>
              <input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label={t("security.newPassword")} error={tooShort ? t("security.atLeastCharacters") : undefined}>
              <input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-invalid={tooShort} />
            </Field>
            {next && (
              <div className="row gap8" aria-live="polite">
                <div style={{ display: "flex", flex: 1, gap: 4 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ height: 6, flex: 1, borderRadius: 999, background: i <= strength ? (strength >= 3 ? "var(--bz-ok)" : "var(--bz-star)") : "var(--bz-fill2)" }} />
                  ))}
                </div>
                <small style={{ width: 48, textAlign: "right", fontWeight: 700, color: "var(--bz-muted)" }}>{strengthLabel}</small>
              </div>
            )}
            <Field label={t("security.confirmNewPassword")} error={mismatch ? t("security.theseDoNotMatch") : undefined}>
              <input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
            </Field>
            {/* Said before the click, not after: someone changing a password because they
                think it leaked needs to know the other session actually gets closed. */}
            <Note kind="wa" icon={<ShieldCheck size={16} />}>{t("security.changingYourPasswordSignsYou")}</Note>
            <div>
              <Btn kind="v" type="submit" disabled={!ready || saving}>
                {saving ? t("security.changing") : t("security.changePassword")}
              </Btn>
            </div>
          </form>
        </Card>
      </SettingsFrame>
    </AppLayout>
  );
}
