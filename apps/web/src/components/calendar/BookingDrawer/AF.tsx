import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Drawer field of the frame (BF41): `.af > .fld > div > small + control`, optional trailing icon and hint. */
export function AF({ label, required, icon, hint, area, children }: { label: ReactNode; required?: boolean; icon?: ReactNode; hint?: ReactNode; area?: boolean; children: ReactNode }) {
  return (
    <div className={cn("af", area && "area")}>
      <div className="fld">
        <div>
          <small>
            {label}
            {required ? <i>*</i> : null}
          </small>
          {children}
        </div>
        {icon}
      </div>
      {hint ? <div className="hp">{hint}</div> : null}
    </div>
  );
}

/** `.a-sec` numbered section heading. */
export function Sec({ n, children, hint }: { n: number; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="a-sec">
      <i>{n}</i>
      {children}
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}
