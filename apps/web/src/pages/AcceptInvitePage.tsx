import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Field, Note, Skeleton } from "@/components/bz";
import { API_BASE_URL } from "@/config/api";
import { authService } from "@/services/authService";
import { startSession } from "@/utils/session";
import { t } from "@/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { authTitle } from "@/components/auth/authStyles";

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
      setProblem(t("acceptInvite.linkIncomplete"));
      return;
    }
    fetch(`${API_BASE_URL}/public/staff-invites/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.detail || data.message || t("acceptInvite.thisInvitationLinkIsNot"));
        setInvite(data);
      })
      .catch((e) => setProblem(e.message));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!invite.accountExists) {
      if (password.length < 8) return toast.error(t("acceptInvite.useAtLeastCharacters"));
      if (password !== confirm) return toast.error(t("acceptInvite.thePasswordsDoNotMatch"));
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/public/staff-invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || data.message || t("acceptInvite.couldNotAcceptTheInvitation"));
      const auth = await authService.login({ email: invite.email, password });
      await startSession(auth);
      toast.success(t("acceptInvite.welcomeTo", { salonName: invite.salonName }));
      navigate("/");
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("acceptInvite.couldNotAcceptTheInvitation"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="stk">
        <h1 className={authTitle}>{t("acceptInvite.joinYourSalonOnBooqi")}</h1>
        {problem ? (
          <>
            <Note kind="er">{problem}</Note>
            <div><Link to="/login" className="btn btn-ol s" style={{ textDecoration: "none" }}>{t("acceptInvite.goToSignIn")}</Link></div>
          </>
        ) : !invite ? (
          <Skeleton lines={[70, 50]} />
        ) : (
          <form onSubmit={submit} className="stk">
            <Note kind="in">
              <strong>{invite.salonName}</strong>{" "}{t("acceptInvite.addedYouToTheirTeam", { staffName: invite.staffName })}{" "}<strong>{invite.email}</strong>.
            </Note>
            <Field label={invite.accountExists ? t("acceptInvite.yourBooqiPassword") : t("acceptInvite.chooseAPassword")}>
              <input
                id="invite-password"
                type="password"
                autoComplete={invite.accountExists ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {!invite.accountExists && (
              <Field label={t("acceptInvite.repeatThePassword")}>
                <input
                  id="invite-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </Field>
            )}
            <button type="submit" className="btn btn-v" style={{ width: "100%", justifyContent: "center" }} disabled={busy} aria-busy={busy}>
              {busy ? t("acceptInvite.joining") : t("acceptInvite.joinTheTeam")}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
};

export default AcceptInvitePage;
