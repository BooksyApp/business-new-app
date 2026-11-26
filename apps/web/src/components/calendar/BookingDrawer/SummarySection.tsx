import { Check } from "lucide-react";
import { currencySymbol } from "@/lib/currency";
import { t as tr } from "@/i18n";
import { AF, Sec } from "./AF";
import type { BookingDrawerProps } from "./types";

type P = Pick<BookingDrawerProps, "form" | "setForm" | "total">;

/** 9 Qeyd, 10 Seçim ("customer chose this specialist"), 11 Cəmi (total + to-be-paid). */
export function SummarySection({ form, setForm, total }: P) {
  const label = `${total.toFixed(2)} ${currencySymbol()}`;
  return (
    <>
      <Sec n={9}>{tr("calendar.notesOptional")}</Sec>
      <AF label={tr("calendar.notesOptional")} area hint={tr("calendar.notesLimit")}>
        <textarea placeholder={tr("calendar.addNotes")} value={form.notes} maxLength={2000} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} style={{ resize: "none" }} />
      </AF>

      <Sec n={10}>{tr("calendar.choiceHeading")}</Sec>
      <div
        className="a-ck"
        role="checkbox"
        tabIndex={0}
        aria-checked={form.requestedByClient}
        aria-label={tr("calendar.requestedByClient")}
        style={{ cursor: "pointer" }}
        onClick={() => setForm((prev) => ({ ...prev, requestedByClient: !prev.requestedByClient }))}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setForm((prev) => ({ ...prev, requestedByClient: !prev.requestedByClient }));
          }
        }}
      >
        <span className={form.requestedByClient ? "bx on" : "bx"}>{form.requestedByClient ? <Check className="ic" aria-hidden /> : null}</span>
        <div>
          <b>{tr("calendar.requestedByClient")}</b>
          <span className="h">{tr("calendar.requestedByClientHint")}</span>
        </div>
      </div>

      <Sec n={11}>{tr("common.total")}</Sec>
      <div className="a-tot">
        <div className="r">
          <span>{tr("common.total")}</span>
          <span>{label}</span>
        </div>
      </div>
      <AF label={tr("calendar.toBePaid")}>
        <b>{label}</b>
      </AF>
    </>
  );
}
