import { Suspense, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { staticFrames, staticFrameComponents } from "@/bz-static";
import Sprite from "@/bz-static/Sprite";
import "@/styles/bz-static.css";

/** Hidden dev route /bz-static/:frameId: every artifact frame as generated TSX (scaled to fit, 100% toggle). */
export default function BzStaticPage() {
  const { frameId, salonKey } = useParams();
  const meta = staticFrames.find((f) => f.id === frameId) ?? staticFrames[0];
  const Comp = staticFrameComponents[meta.id];
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(1200);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const zoom = full ? 1 : Math.min(1, (avail - 32) / meta.w);
  const base = salonKey ? `/${salonKey}/bz-static` : "/bz-static";
  let lastBlock = "";
  return (
    <div style={{ display: "flex", height: "100vh", background: "#ece8e1", fontFamily: "system-ui,sans-serif" }}>
      <aside style={{ width: 230, overflowY: "auto", background: "#fff", borderRight: "1px solid #ddd", padding: 8, fontSize: 12, flex: "none" }}>
        {staticFrames.map((f) => {
          const head = f.block !== lastBlock ? <div key={f.block} style={{ fontWeight: 800, margin: "10px 0 2px" }}>{f.block}</div> : null;
          lastBlock = f.block;
          return (
            <div key={f.id}>
              {head}
              <Link to={`${base}/${f.id}`} title={f.label} style={{ display: "block", padding: "2px 6px", borderRadius: 4, textDecoration: "none", color: "#1d1730", background: f.id === meta.id ? "#e5dcff" : "transparent" }}>
                {f.id} <span style={{ opacity: 0.5 }}>{f.kind === "m" ? "390" : "1440"}</span>
              </Link>
            </div>
          );
        })}
      </aside>
      <main ref={box} style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <div style={{ marginBottom: 10, fontSize: 13, display: "flex", gap: 12, alignItems: "center" }}>
          <b>{meta.id}</b>
          <span style={{ opacity: 0.6 }}>{meta.label}</span>
          <button type="button" onClick={() => setFull((v) => !v)} style={{ marginLeft: "auto", padding: "4px 10px", border: "1px solid #999", borderRadius: 6, background: "#fff" }}>
            {full ? "Fit" : "100%"}
          </button>
        </div>
        <Sprite />
        <div style={{ zoom }}>
          <Suspense fallback={<div>...</div>}>
            <Comp />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
