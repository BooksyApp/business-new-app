import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { Kids } from "./util";

/** Footer action bar `.df`: quiet secondary + gradient primary (pass <Btn kind="ol"/> and <Btn kind="v"/>). */
export const FooterBar = ({ children }: Kids) => <div className="df">{children}</div>;

/** Right drawer `.dwr` (header, optional tabs row, scroll body, footer bar). Radix Dialog: Esc, focus trap, aria. Rendered in place (no portal) so artifact scope wrappers still apply. */
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
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose?.()}>
      <DialogPrimitive.Overlay className="veil bz-fixed" />
      <DialogPrimitive.Content className={`dwr bz-fixed${narrow ? " nrw" : ""}`} aria-describedby={undefined}>
        <div className="dh">
          <div>
            <DialogPrimitive.Title asChild>
              <h5>{title}</h5>
            </DialogPrimitive.Title>
            {sub ? <small>{sub}</small> : null}
          </div>
          <DialogPrimitive.Close asChild>
            <span className="circ" role="button" tabIndex={0} aria-label="close">
              {closeIcon}
            </span>
          </DialogPrimitive.Close>
        </div>
        {tabs}
        <div className="db">{children}</div>
        {footer ? <FooterBar>{footer}</FooterBar> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

/** Sheet = Drawer, narrow. */
export const Sheet = (p: React.ComponentProps<typeof Drawer>) => <Drawer {...p} narrow />;

/** Centered dialog `.dlg` with title, sub, stacked body, right-aligned footer. Radix Dialog. */
export function Dialog({ title, sub, footer, width = 520, onClose, children }: Kids & { title: ReactNode; sub?: ReactNode; footer?: ReactNode; width?: number; onClose?: () => void }) {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose?.()}>
      <DialogPrimitive.Overlay className="veil bz-fixed" />
      <DialogPrimitive.Content className="dlg bz-fixed" style={{ width }} aria-describedby={undefined}>
        <DialogPrimitive.Title asChild>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.015em" }}>{title}</div>
        </DialogPrimitive.Title>
        {sub ? <div style={{ fontSize: 14.5, color: "var(--bz-muted)", fontWeight: 600, margin: "4px 0 14px" }}>{sub}</div> : null}
        <div className="stk">{children}</div>
        {footer ? (
          <div className="row gap8" style={{ justifyContent: "flex-end", marginTop: 18 }}>
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

/** Confirm dialog (artifact `confirm()`): title, body text, cancel + ok (pass the two buttons). */
export function ConfirmDialog({ title, body, footer, onClose }: { title: ReactNode; body: ReactNode; footer: ReactNode; onClose?: () => void }) {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose?.()}>
      <DialogPrimitive.Overlay className="veil bz-fixed" />
      <DialogPrimitive.Content className="dlg bz-fixed" role="alertdialog" style={{ width: 480 }}>
        <DialogPrimitive.Title asChild>
          <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.25 }}>{title}</div>
        </DialogPrimitive.Title>
        <DialogPrimitive.Description asChild>
          <div style={{ fontSize: 15, color: "var(--bz-muted)", fontWeight: 500, margin: "10px 0 20px", lineHeight: 1.5 }}>{body}</div>
        </DialogPrimitive.Description>
        <div className="row gap8" style={{ justifyContent: "flex-end" }}>
          {footer}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
