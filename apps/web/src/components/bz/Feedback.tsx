import type { ReactNode } from "react";
import type { Style } from "./util";

/** `.esx` empty state: icon badge `.ib`, title, text, optional action node. */
export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="esx">
      {icon ? <div className="ib">{icon}</div> : null}
      <b>{title}</b>
      {text ? <span>{text}</span> : null}
      {action}
    </div>
  );
}

/** Error state: `.esx` with the guava badge colours of the artifact's error notice. */
export function ErrorState({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="esx">
      {icon ? (
        <div className="ib" style={{ background: "var(--bz-gsoft)", color: "var(--bz-gink)" }}>
          {icon}
        </div>
      ) : null}
      <b>{title}</b>
      {text ? <span>{text}</span> : null}
      {action}
    </div>
  );
}

/** `.a-skel` shimmer blocks (loading). */
export function Skeleton({ lines = [90, 70, 80, 55], height, style }: { lines?: number[]; height?: number; style?: Style }) {
  return (
    <div style={{ display: "grid", gap: 12, padding: "10px 0", ...style }}>
      {lines.map((w, i) => (
        <div key={i} className="a-skel" style={{ width: `${w}%`, height, borderRadius: height ? 16 : undefined }} />
      ))}
    </div>
  );
}
