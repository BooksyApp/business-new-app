import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { businessService } from "@/services/businessService";
import { getCurrentUser } from "@/utils/businessUtils";
import LoadingView from "@/components/ui/loading-view";

/**
 * /legacy/<id>/<page>?… — where Caddy sends an old getbooqi.tech/manage/<id>/<page> link.
 * The id is matched against the signed-in person's own salons (owner or team) only, then
 * replaced by the salon's key: /<slug>_<publicId>/<page>. Anything else → the salon picker,
 * which says nothing about whether that id exists.
 */
const LegacyPanelRedirect = () => {
  const location = useLocation();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const [, idPart = "", ...rest] = location.pathname.split("/").filter(Boolean);
    // UUID phase 2: a pre-key link carries the salon id; numeric ones no longer match anything.
    const id = idPart;
    const user = getCurrentUser() as { id?: Id } | null;
    if (!id || !user?.id) {
      setTarget("/");
      return;
    }
    let cancelled = false;
    businessService
      .getBusinessesByOwner(user.id)
      .then((list) => {
        const b = (list ?? []).find((x) => x.id === id);
        const page = rest.join("/") || "calendar";
        if (!cancelled) setTarget(b?.panelKey ? `/${b.panelKey}/${page}${location.search}${location.hash}` : "/");
      })
      .catch(() => !cancelled && setTarget("/"));
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, location.hash]);

  if (!target) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingView />
      </div>
    );
  }
  return <Navigate to={target} replace />;
};

export default LegacyPanelRedirect;
