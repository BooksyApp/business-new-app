import type { ReactNode } from "react";
import { cx, type Kids } from "./util";

/** `.chip`; `on` solid, `violet` (vo) soft-violet selected state. */
export function Chip({ children, on, violet, icon, onClick }: Kids & { on?: boolean; violet?: boolean; icon?: ReactNode; onClick?: () => void }) {
  return (
    <span className={cx("chip", on && "on", violet && "vo")} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      {icon}
      {children}
    </span>
  );
}
export function ChipRow({ children }: Kids) {
  return <div className="chs">{children}</div>;
}

/** `.st` status pill: c confirmed/green, d default, w warning, x cancelled, r red. */
export function StatusPill({ kind = "d", children }: Kids & { kind?: "c" | "d" | "w" | "x" | "r" }) {
  return <span className={cx("st", kind)}>{children}</span>;
}

/** `.tag2` small tag / `.rolechip` role chip. */
export function Tag({ children, kind }: Kids & { kind?: string }) {
  return <span className={cx("tag2", kind)}>{children}</span>;
}
export function RoleChip({ children, icon, sub }: Kids & { icon?: ReactNode; sub?: boolean }) {
  return (
    <span className={cx("rolechip", sub && "sub")}>
      {icon}
      {children}
    </span>
  );
}

/** `.av` photo avatar; falls back to the gradient `.ring` initials. */
export function Avatar({ src, initials, size = 44, ring }: { src?: string; initials?: string; size?: number; ring?: boolean }) {
  if (src && !ring) return <img className="av" src={src} alt="" style={{ width: size, height: size }} />;
  return (
    <div className="ring">
      {src ? (
        <img src={src} alt="" style={{ width: size, height: size }} />
      ) : (
        <span style={{ width: size, height: size, fontWeight: 800, fontSize: Math.max(14, Math.floor(size / 3)) }}>{initials}</span>
      )}
    </div>
  );
}

/** `.avs` overlapping initials/avatars. */
export function AvatarStack({ items }: { items: ReactNode[] }) {
  return (
    <div className="avs">
      {items.map((x, i) => (
        <span key={i}>{x}</span>
      ))}
    </div>
  );
}

/** Round icon button `.circ` (close, bell, overflow). */
export function IconBadge({ icon, onClick, label }: { icon: ReactNode; onClick?: () => void; label?: string }) {
  return (
    <span className="circ" onClick={onClick} role={onClick ? "button" : undefined} aria-label={label} tabIndex={onClick ? 0 : undefined}>
      {icon}
    </span>
  );
}

/** Calendar-style legend line: row of chip-like swatches (`.chs` + coloured dot). Calendar markers live in components/calendar. */
export function Legend({ items }: { items: Array<{ color: string; label: ReactNode }> }) {
  return (
    <div className="chs">
      {items.map((it, i) => (
        <span className="chip" key={i}>
          <i style={{ width: 10, height: 10, borderRadius: 99, background: it.color, display: "inline-block" }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** `.lr` roomy avatar row: left (avatar), title + sub, right slot. */
export function RowItem({ left, title, sub, right, onClick }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  return (
    <div className="lr" onClick={onClick} role={onClick ? "button" : undefined}>
      {left}
      <div className="tx">
        <b>{title}</b>
        {sub ? <span>{sub}</span> : null}
      </div>
      {right}
    </div>
  );
}
