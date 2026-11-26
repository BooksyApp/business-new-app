import type { ReactNode } from "react";
import { cx } from "./util";

/** `.tdr2` table: CSS-grid rows. `grid` = grid-template-columns. Cells are nodes (pills, avatars, existing buttons). */
export function DataTable<T>({
  columns,
  rows,
  grid,
  rowKey,
  render,
  onRowClick,
  rowActions,
}: {
  columns: ReactNode[];
  rows: T[];
  grid: string;
  rowKey: (r: T) => string | number;
  render: (r: T) => ReactNode[];
  onRowClick?: (r: T) => void;
  rowActions?: (r: T) => ReactNode; // appended as last cell (use <RowMenu/> or buttons)
}) {
  const cols = rowActions ? `${grid} 44px` : grid;
  return (
    <div>
      <div className="tdr2 h" style={{ gridTemplateColumns: cols }}>
        {columns.map((c, i) => (
          <div key={i}>{c}</div>
        ))}
        {rowActions ? <div /> : null}
      </div>
      {rows.map((r) => (
        <div key={rowKey(r)} className="tdr2" style={{ gridTemplateColumns: cols, cursor: onRowClick ? "pointer" : undefined }} onClick={() => onRowClick?.(r)}>
          {render(r).map((c, i) => (
            <div key={i}>{c}</div>
          ))}
          {rowActions ? <div onClick={(e) => e.stopPropagation()}>{rowActions(r)}</div> : null}
        </div>
      ))}
    </div>
  );
}
/** `.mn` overflow button for row actions. */
export const RowMenu = ({ icon, onClick }: { icon: ReactNode; onClick?: () => void }) => (
  <span className="mn" role="button" tabIndex={0} onClick={onClick}>
    {icon}
  </span>
);

/** `.tbs` underline tabs (`pill` = pill variant). */
export function Tabs({ items, value, onChange, pill }: { items: Array<{ key: string; label: ReactNode; disabled?: boolean }>; value: string; onChange?: (k: string) => void; pill?: boolean }) {
  return (
    <div className={cx("tbs", pill && "pill")} role="tablist">
      {items.map((t) => (
        <span key={t.key} role="tab" aria-selected={t.key === value} className={cx(t.key === value && "on", t.disabled && "dis")} onClick={() => !t.disabled && onChange?.(t.key)}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

/** `.sgc` segmented pills (wide = full width). */
export function SegPills({ items, value, onChange, wide }: { items: Array<{ key: string; label: ReactNode }>; value: string; onChange?: (k: string) => void; wide?: boolean }) {
  return (
    <div className={cx("sgc", wide && "w")}>
      {items.map((t) => (
        <span key={t.key} className={t.key === value ? "on" : ""} onClick={() => onChange?.(t.key)} role="button" tabIndex={0}>
          {t.label}
        </span>
      ))}
    </div>
  );
}
