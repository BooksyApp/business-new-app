import type { ReactNode } from "react";
import { cx, type Kids } from "./util";

/** Artifact wrappers `.aa/.ab/.ac` scope some area rules; render once around a ported page. */
export function BzScope({ children }: Kids) {
  return (
    <div className="aa ab ac" style={{ display: "contents" }}>
      {children}
    </div>
  );
}

export interface SidebarItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}
export interface SidebarGroup {
  heading?: ReactNode; // artifact: <div class="sg">BIZNES</div>
  items: SidebarItem[];
}

/** <aside class="sbx"> logo, salon switcher, primary action, nav groups, footer (me block). */
export function Sidebar(props: {
  logo?: ReactNode;
  switcher?: ReactNode; // content for <div class="swt">
  action?: { label: ReactNode; icon?: ReactNode; onClick?: () => void };
  groups: SidebarGroup[];
  bottom?: SidebarItem[];
  me?: ReactNode; // content for <div class="meb">
}) {
  const item = (i: SidebarItem) => (
    <span key={i.key} className={cx("sb", i.active && "on")} onClick={i.onClick} role="link" tabIndex={0}>
      {i.icon}
      {i.label}
    </span>
  );
  return (
    <aside className="sbx">
      {props.logo && <div className="lg">{props.logo}</div>}
      {props.switcher && <div className="swt">{props.switcher}</div>}
      {props.action && (
        <span className="nb" onClick={props.action.onClick} role="button" tabIndex={0}>
          {props.action.icon}
          {props.action.label}
        </span>
      )}
      {props.groups.map((g, gi) => (
        <div key={gi} style={{ display: "contents" }}>
          {g.heading && <div className="sg">{g.heading}</div>}
          {g.items.map(item)}
        </div>
      ))}
      <div style={{ flex: 1, minHeight: 8 }} />
      {props.bottom?.map(item)}
      {props.me && <div className="meb">{props.me}</div>}
    </aside>
  );
}

/** Artifact `.dsh` (flex row: sidebar + `.mainx` padded column). `live` = real viewport height, no frame clip. */
export function Shell({ sidebar, children, overlay }: { sidebar?: ReactNode; children?: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="dsh bz-surface bz-live">
      {sidebar}
      <div className="mainx">{children}</div>
      {overlay}
    </div>
  );
}

/** `.pgt` page title row: h5 + small subtitle on the left, actions on the right. */
export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="pgt">
      <div>
        <h5>{title}</h5>
        {sub ? <small>{sub}</small> : null}
      </div>
      <div className="row gap8">{right}</div>
    </div>
  );
}

/** Row of controls under the page title (chips, search, view switch, date). */
export function Toolbar({ children, style }: Kids & { style?: React.CSSProperties }) {
  return (
    <div className="row gap8" style={{ flexWrap: "wrap", marginBottom: 16, ...style }}>
      {children}
    </div>
  );
}

/** Artifact `.btn` family. kind: v (gradient primary), ol (quiet outline), soft, dg (danger), gh, gl. */
export function Btn({
  kind = "ol",
  icon,
  children,
  small = true,
  ...rest
}: { kind?: "v" | "ol" | "soft" | "dg" | "gh" | "gl" | "wh"; icon?: ReactNode; small?: boolean } & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
>) {
  return (
    <button type="button" className={cx("btn", `btn-${kind}`, small && "s")} {...rest}>
      {icon}
      {children}
    </button>
  );
}
