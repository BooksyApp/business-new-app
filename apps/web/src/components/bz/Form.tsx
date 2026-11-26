import type { ReactNode } from "react";
import { cx, type Kids } from "./util";

/** Labelled box `.fld` (b-family `.fw`). `children` = the EXISTING input/select/textarea (styled bare via biz-ui.css). */
export function Field({
  label,
  required,
  hint,
  error,
  suffix,
  kind,
  disabled,
  focused,
  children,
}: Kids & {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  suffix?: ReactNode;
  kind?: "sel" | "ta";
  disabled?: boolean;
  focused?: boolean;
}) {
  return (
    <div className="fw">
      <div className={cx("fld", focused && "on", error && "er", kind, disabled && "dis")}>
        <small>
          {label}
          {required ? <em className="rq"> *</em> : null}
        </small>
        {children}
        {suffix ? <i className="sf">{suffix}</i> : null}
      </div>
      {error || hint ? <div className={cx("hint", error && "er")}>{error ?? hint}</div> : null}
    </div>
  );
}
/** Select shell: Field kind="sel" (children = existing <select> / Radix trigger). */
export const SelectField = (p: Omit<React.ComponentProps<typeof Field>, "kind">) => <Field {...p} kind="sel" />;

/** Form grids `.g1/.g2/.g3` and vertical stack `.stk`. */
export const FormGrid = ({ cols = 2, children }: Kids & { cols?: 1 | 2 | 3 }) => <div className={`g${cols}`}>{children}</div>;
export const FormStack = ({ children }: Kids) => <div className="stk">{children}</div>;

/** `.swr` toggle row: title + help left, `.tg` switch right. Controlled; renders a real button for a11y. */
export function Toggle({ title, help, checked, onChange }: { title: ReactNode; help?: ReactNode; checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <div className="swr">
      <div>
        <b>{title}</b>
        {help ? <span>{help}</span> : null}
      </div>
      <button type="button" role="switch" aria-checked={checked} className={cx("tg", !checked && "off")} onClick={() => onChange?.(!checked)} style={{ border: 0, padding: 0 }} />
    </div>
  );
}

/** `.cbr` checkbox row (icon = check mark node, e.g. lucide Check). */
export function CheckRow({ label, sub, checked, right, icon, onChange }: { label: ReactNode; sub?: ReactNode; checked: boolean; right?: ReactNode; icon?: ReactNode; onChange?: (v: boolean) => void }) {
  return (
    <div className="cbr" onClick={() => onChange?.(!checked)} role="checkbox" aria-checked={checked} tabIndex={0}>
      <i className={checked ? "on" : ""}>{checked ? icon : null}</i>
      <div>
        {label}
        {sub ? <small>{sub}</small> : null}
      </div>
      {right ? <span className="rt">{right}</span> : null}
    </div>
  );
}

/** `.rdg` radio group of `.rd` options. */
export function RadioGroup({ title, options, value, onChange }: { title?: ReactNode; options: Array<{ value: string; label: ReactNode; hint?: ReactNode }>; value: string; onChange?: (v: string) => void }) {
  return (
    <>
      {title ? <div className="lbl2">{title}</div> : null}
      <div className="rdg" role="radiogroup">
        {options.map((o) => (
          <div key={o.value} className={cx("rd", o.value === value && "on")} role="radio" aria-checked={o.value === value} tabIndex={0} onClick={() => onChange?.(o.value)}>
            <i />
            <div>
              <b>{o.label}</b>
              {o.hint ? <span>{o.hint}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
