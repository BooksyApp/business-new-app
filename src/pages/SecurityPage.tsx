import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { businessService } from "@/services/businessService";

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
      toast.success(res.message ?? "Password changed");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change your password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Security" subtitle="Your sign-in details" />

      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Current password</Label>
              <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
              {tooShort && <p className="text-xs text-destructive">At least 8 characters.</p>}
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              {mismatch && <p className="text-xs text-destructive">These do not match.</p>}
            </div>
            {/* Said before the click, not after: someone changing a password because they
                think it leaked needs to know the other session actually gets closed. */}
            <p className="text-xs text-muted-foreground">
              Changing your password signs you out everywhere else.
            </p>
            <Button disabled={!ready || saving} onClick={() => void submit()}>
              {saving ? "Changing…" : "Change password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
