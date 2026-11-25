import { useEffect, useState } from "react";

import { t } from "@/i18n";
import { clientTagService, type ClientField, type ClientTag } from "@/services/clientTagService";
import type { Id } from "@/types/id";
import { Input } from "@/components/ui/input";

const selectCls = "h-9 rounded-full border border-[rgb(var(--reg-line))] bg-white px-3 text-sm";

/**
 * FG-W2-05: filter the client list by the salon's tag and/or a custom field. The server answers
 * with the matching clients' ids; the page keeps only those rows. Renders nothing until the
 * salon has defined a tag or a field.
 */
export function ClientCrmFilters({ businessId, onChange }: {
  businessId: Id;
  onChange: (ids: Set<string> | null) => void;
}) {
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [fields, setFields] = useState<ClientField[]>([]);
  const [tagId, setTagId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!businessId) return;
    void clientTagService.tags(businessId).then(setTags).catch(() => undefined);
    void clientTagService.fields(businessId).then(setFields).catch(() => undefined);
  }, [businessId]);

  const field = fields.find((f) => String(f.id) === fieldId);

  useEffect(() => {
    if (!tagId && !fieldId) {
      onChange(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      clientTagService
        .filterClients(businessId, { tagId: tagId || undefined, fieldId: fieldId || undefined, value: value || undefined })
        .then((r) => live && onChange(new Set(r.clientIds.map(String))))
        .catch(() => live && onChange(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, tagId, fieldId, value]);

  if (tags.length === 0 && fields.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {tags.length > 0 && (
        <select className={selectCls} aria-label={t("clients.cfFilterTag")} value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">{t("clients.cfFilterAnyTag")}</option>
          {tags.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
        </select>
      )}
      {fields.length > 0 && (
        <select
          className={selectCls}
          aria-label={t("clients.cfFilterField")}
          value={fieldId}
          onChange={(e) => { setFieldId(e.target.value); setValue(""); }}
        >
          <option value="">{t("clients.cfFilterAnyField")}</option>
          {fields.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
        </select>
      )}
      {field && field.type === "SELECT" && (
        <select className={selectCls} aria-label={t("clients.cfFilterValue")} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">{t("clients.cfFilterAnyValue")}</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {field && field.type !== "SELECT" && (
        <Input
          className="h-9 w-44 rounded-full"
          aria-label={t("clients.cfFilterValue")}
          type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
          value={value}
          placeholder={t("clients.cfFilterValue")}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      {(tagId || fieldId) && (
        <button type="button" className="text-sm font-semibold text-[rgb(var(--reg-muted))] underline" onClick={() => { setTagId(""); setFieldId(""); setValue(""); }}>
          {t("clients.cfFilterClear")}
        </button>
      )}
    </div>
  );
}
