import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/config/api";
import { authService } from "@/services/authService";
import { startSession } from "@/utils/session";

type Invite = { salonName: string; staffName: string; email: string; accountExists: boolean };

/**
 * Where the link in a team invitation lands: set a password (or, for an address that
 * already has a booqi sign-in, enter it) and you are in the salon's manager.
 *
 * Plain fetch rather than apiClient: a wrong password is a 401 here, and apiClient treats
 * every 401 as an expired session and sends the browser to the login page.
 */
const AcceptInvitePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setProblem("This invitation link is not complete. Open it again from the email.");
      return;
    }
    fetch(`${API_BASE_URL}/public/staff-invites/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || data.message || "This invitation link is not valid");
        setInvite(data);
      })
      .catch((e) => setProblem(e.message));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!invite.accountExists) {
      if (password.length < 8) return toast.error("Use at least 8 characters");
      if (password !== confirm) return toast.error("The passwords do not match");
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/public/staff-invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || data.message || "Could not accept the invitation");
      const auth = await authService.login({ email: invite.email, password });
      await startSession(auth);
      toast.success(`Welcome to ${invite.salonName}`);
      navigate("/");
    } catch (err) {
      toast.error((err instanceof Error && err.message) || "Could not accept the invitation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Join your salon on booqi</h1>
        {problem ? (
          <>
            <p className="mt-3 text-sm text-destructive">{problem}</p>
            <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-primary">
              Go to sign in
            </Link>
          </>
        ) : !invite ? (
          <p className="mt-3 text-sm text-muted-foreground">Checking your invitation…</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{invite.salonName}</strong> added you, {invite.staffName}, to their
              team. You will sign in with <strong className="text-foreground">{invite.email}</strong>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="invite-password">
                {invite.accountExists ? "Your booqi password" : "Choose a password"}
              </Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete={invite.accountExists ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {!invite.accountExists && (
              <div className="space-y-2">
                <Label htmlFor="invite-confirm">Repeat the password</Label>
                <Input
                  id="invite-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Joining…" : "Join the team"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitePage;
