import type { ReactNode } from "react";
import type { Kids } from "./util";

/** Footer action bar `.df`: quiet secondary + gradient primary (pass <Btn kind="ol"/> and <Btn kind="v"/>). */
export const FooterBar = ({ children }: Kids) => <div className="df">{children}</div>;

/** Right drawer `.dwr` (header, optional tabs row, scroll body, footer bar). Position is fixed via .bz-fixed. `veil` dims the page. */
export function Drawer({
  title,
  sub,
  onClose,
  closeIcon,
  tabs,
  footer,
  narrow,
  children,
}: Kids & { title: ReactNode; sub?: ReactNode; onClose?: () => void; closeIcon?: ReactNode; tabs?: ReactNode; footer?: ReactNode; narrow?: boolean }) {
  return (
    <>
      <div className="veil bz-fixed" onClick={onClose} />
      <aside className={`dwr bz-fixed${narrow ? " nrw" : ""}`} role="dialog" aria-modal="true">
        <div className="dh">
          <div>
            <h5>{title}</h5>
            {sub ? <small>{sub}</small> : null}
          </div>
          <span className="circ" role="button" tabIndex={0} aria-label="close" onClick={onClose}>
            {closeIcon}
          </span>
        </div>
        {tabs}
        <div className="db">{children}</div>
        {footer ? <FooterBar>{footer}</FooterBar> : null}
      </aside>
    </>
  );
}
/** Sheet = Drawer, narrow. */
export const Sheet = (p: React.ComponentProps<typeof Drawer>) => <Drawer {...p} narrow />;

/** Centered dialog `.dlg` with title, sub, stacked body, right-aligned footer. */
export function Dialog({ title, sub, footer, width = 520, onClose, children }: Kids & { title: ReactNode; sub?: ReactNode; footer?: ReactNode; width?: number; onClose?: () => void }) {
  return (
    <>
      <div className="veil bz-fixed" onClick={onClose} />
      <div className="dlg bz-fixed" role="dialog" aria-modal="true" style={{ width }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.015em" }}>{title}</div>
        {sub ? <div style={{ fontSize: 14.5, color: "var(--bz-muted)", fontWeight: 600, margin: "4px 0 14px" }}>{sub}</div> : null}
        <div className="stk">{children}</div>
        {footer ? (
          <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Confirm dialog (artifact `confirm()`): title, body text, cancel + ok (pass the two buttons). */
export function ConfirmDialog({ title, body, footer, onClose }: { title: ReactNode; body: ReactNode; footer: ReactNode; onClose?: () => void }) {
  return (
    <>
      <div className="veil bz-fixed" onClick={onClose} />
      <div className="dlg bz-fixed" role="alertdialog" aria-modal="true" style={{ width: 480 }}>
        <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 15, color: "var(--bz-muted)", fontWeight: 500, margin: "10px 0 20px", lineHeight: 1.5 }}>{body}</div>
        <div className="row gap8" style={{ justifyContent: "flex-end" }}>
          {footer}
        </div>
      </div>
    </>
  );
}
