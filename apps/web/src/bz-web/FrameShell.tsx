import { Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { staticFrames, staticFrameComponents } from "@/bz-static";
import Sprite from "@/bz-static/Sprite";
import { NAV, ROUTES } from "./routes";
import "@/styles/bz-static.css";
import "@/styles/bz-web.css";

function expand(spec: string): string[] {
  const [block, range] = spec.split(":");
  const all = staticFrames.filter((f) => f.block === block).map((f) => f.id);
  if (!range) return all;
  const [a, b] = range.split("-").map(Number);
  return all.filter((id) => {
    const n = Number(id.slice(5));
    return n >= a && n <= b;
  });
}

const BOOKING_SHEET = "BF43-01";

function useNarrow() {
  const [n, setN] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const on = () => setN(window.innerWidth < 768);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return n;
}

/** Renders the artifact frames of the matched route; the sidebar/dock and frame buttons navigate. */
export default function FrameShell({ route }: { route: string }) {
  const { salonKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const narrow = useNarrow();
  const [idx, setIdx] = useState(0);
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const ids = useMemo(() => {
    const list = Array.from(new Set((ROUTES[route] ?? []).flatMap(expand)));
    const meta = (id: string) => staticFrames.find((f) => f.id === id)!;
    const desktop = list.filter((id) => meta(id).kind === "d");
    const mobile = list.filter((id) => meta(id).kind === "m");
    return narrow && mobile.length ? mobile : desktop.length ? desktop : mobile;
  }, [route, narrow]);

  useEffect(() => setIdx(0), [route, narrow, location.pathname]);

  const id = ids[Math.min(idx, ids.length - 1)];
  const meta = staticFrames.find((f) => f.id === id);
  const Comp = id ? staticFrameComponents[id] : undefined;
  const base = salonKey ? `/${salonKey}` : "";

  const onClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    const nav = el.closest(".sbx .sb, .tab, .nb, .swt");
    if (!nav) return;
    if (nav.classList.contains("nb")) {
      const target = ids.indexOf(BOOKING_SHEET);
      if (target >= 0) setIdx(target);
      else navigate(`${base}/calendar`);
      return;
    }
    if (nav.classList.contains("swt")) return navigate("/");
    const label = (nav.textContent ?? "").trim();
    const to = NAV[label];
    if (to) navigate(`${base}/${to}`);
  };

  if (!Comp || !meta) return <div className="bzw-empty">—</div>;
  const zoom = meta.kind === "d" && width < meta.w ? width / meta.w : 1;
  return (
    <div className={"bzw bzw-" + meta.kind} onClick={onClick} style={{ zoom }}>
      <Sprite />
      <Suspense fallback={null}>
        <Comp />
      </Suspense>
      {ids.length > 1 && (
        <div className="bzw-pager" style={{ zoom: 1 / zoom }}>
          <button type="button" aria-label="prev" onClick={() => setIdx((i) => (i + ids.length - 1) % ids.length)}>‹</button>
          <span>{id} · {Math.min(idx, ids.length - 1) + 1}/{ids.length}</span>
          <button type="button" aria-label="next" onClick={() => setIdx((i) => (i + 1) % ids.length)}>›</button>
        </div>
      )}
    </div>
  );
}
