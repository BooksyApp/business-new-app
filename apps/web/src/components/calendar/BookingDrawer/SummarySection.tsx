import { Heart } from "lucide-react";
import { Field } from "@/components/bz";
import { currencySymbol } from "@/lib/currency";
import { t as tr } from "@/i18n";
import type { BookingDrawerProps } from "./types";

type P = Pick<BookingDrawerProps, "form" | "setForm" | "total">;

/** Notes, the "customer chose this specialist" flag, and the total / to-be-paid summary. */
export function SummarySection({ form, setForm, total }: P) {
  const label = `${total.toFixed(2)} ${currencySymbol()}`;
  return (
    <>
      <Field label={tr("calendar.notesOptional")} kind="ta">
        <textarea placeholder={tr("calendar.addNotes")} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} style={{ resize: "none" }} />
      </Field>
      <button
        type="button"
        className={`bkd-heart${form.requestedByClient ? " on" : ""}`}
        aria-label={tr("calendar.requestedByClient")}
        aria-pressed={form.requestedByClient}
        onClick={() => setForm((prev) => ({ ...prev, requestedByClient: !prev.requestedByClient }))}
      >
        <Heart className="ic" />
        {tr("calendar.requestedByClient")}
      </button>
      <div className="bkd-sum">
        <div>
          <span>{tr("common.total")}</span>
          <span>{label}</span>
        </div>
        <div>
          <span>{tr("calendar.toBePaid")}</span>
          <span>{label}</span>
        </div>
      </div>
    </>
  );
}
