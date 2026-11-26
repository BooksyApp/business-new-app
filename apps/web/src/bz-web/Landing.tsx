import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoadingView from "@/components/ui/loading-view";
import { getUserBusinesses } from "@/utils/businessUtils";
import { salonPath } from "@/lib/salonKey";

/** After sign-in: the person's first salon -> its calendar; none -> create one. */
export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await getUserBusinesses();
        if (!live) return;
        if (list.length === 0) return navigate("/create-business", { replace: true });
        const stored = Number(localStorage.getItem("currentBusinessId"));
        const biz = list.find((b) => Number(b.id) === stored) ?? list[0];
        localStorage.setItem("currentBusinessId", String(biz.id));
        localStorage.setItem("currentBusiness", JSON.stringify(biz));
        navigate(salonPath(biz.id), { replace: true });
      } catch {
        if (live) navigate("/login", { replace: true });
      }
    })();
    return () => { live = false; };
  }, [navigate]);
  return <div className="flex items-center justify-center min-h-screen"><LoadingView /></div>;
}
