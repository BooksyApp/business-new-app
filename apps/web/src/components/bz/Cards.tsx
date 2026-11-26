import type { ReactNode } from "react";
import { cx, type Kids, type Style } from "./util";

/** `.crd2` card with optional h6 title + helper `p`. */
export function Card({ title, help, children, style, className }: Kids & { title?: ReactNode; help?: ReactNode; style?: Style; className?: string }) {
  return (
    <div className={cx("crd2", className)} style={style}>
      {title ? <h6>{title}</h6> : null}
      {help ? <p>{help}</p> : null}
      {children}
    </div>
  );
}

/** Numbered / titled section header `.a-sec` (n optional) with helper text and right slot. */
export function SectionHead({ n, title, hint, right }: { n?: number | string; title: ReactNode; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="a-sec">
      {n ? <i>{n}</i> : null}
      {title}
      {hint ? <span>{hint}</span> : null}
      {right ? <em>{right}</em> : null}
    </div>
  );
}

/** Card with a SectionHead on top. */
export function SectionCard({ n, title, hint, right, children }: Kids & { n?: number | string; title: ReactNode; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="a-card">
      <SectionHead n={n} title={title} hint={hint} right={right} />
      {children}
    </div>
  );
}

/** Small form-section heading `h6.fsec` (b-family). */
export function FormSection({ children }: Kids) {
  return <h6 className="fsec">{children}</h6>;
}

/** Stat tile `.stl` inside `Tiles` (`.stt cN`). */
export function Tile({ label, value = "—", hint, wide }: { label: ReactNode; value?: ReactNode; hint?: ReactNode; wide?: boolean }) {
  return (
    <div className={cx("stl", wide && "w")}>
      <small>{label}</small>
      <b>{value}</b>
      {hint ? <span className="h">{hint}</span> : null}
    </div>
  );
}
export function Tiles({ cols = 4, children }: Kids & { cols?: 2 | 3 | 4 | 5 }) {
  return <div className={`stt c${cols}`}>{children}</div>;
}

/** `.pcc` panel card with `.hh` head (title + small). */
export function Panel({ title, small, children }: Kids & { title: ReactNode; small?: ReactNode }) {
  return (
    <div className="pcc">
      <div className="hh">
        <h6>{title}</h6>
        {small ? <small>{small}</small> : null}
      </div>
      {children}
    </div>
  );
}

/** Inline notice `.nt` (kinds: er, gd, in, wa). */
export function Note({ kind = "in", icon, children }: Kids & { kind?: "er" | "gd" | "in" | "wa"; icon?: ReactNode }) {
  return (
    <div className={cx("nt", kind)}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
