import { useEffect, useState } from "react";

import { t } from "@/i18n";
import { clientTagService, type ClientField, type ClientTag } from "@/services/clientTagService";
import type { Id } from "@/types/id";
import { Btn, Field, Toolbar } from "@/components/bz";

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
    <Toolbar style={{ marginTop: 12, marginBottom: 0 }}>
      {tags.length > 0 && (
        <Field label={t("clients.cfFilterTag")} kind="sel">
          <select aria-label={t("clients.cfFilterTag")} value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">{t("clients.cfFilterAnyTag")}</option>
            {tags.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
          </select>
        </Field>
      )}
      {fields.length > 0 && (
        <Field label={t("clients.cfFilterField")} kind="sel">
          <select
            aria-label={t("clients.cfFilterField")}
            value={fieldId}
            onChange={(e) => { setFieldId(e.target.value); setValue(""); }}
          >
            <option value="">{t("clients.cfFilterAnyField")}</option>
            {fields.map((x) => <option key={x.id} value={String(x.id)}>{x.name}</option>)}
          </select>
        </Field>
      )}
      {field && field.type === "SELECT" && (
        <Field label={t("clients.cfFilterValue")} kind="sel">
          <select aria-label={t("clients.cfFilterValue")} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">{t("clients.cfFilterAnyValue")}</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      )}
      {field && field.type !== "SELECT" && (
        <Field label={t("clients.cfFilterValue")}>
          <input
            aria-label={t("clients.cfFilterValue")}
            type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
            value={value}
            placeholder={t("clients.cfFilterValue")}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      )}
      {(tagId || fieldId) && (
        <Btn kind="gh" onClick={() => { setTagId(""); setFieldId(""); setValue(""); }}>
          {t("clients.cfFilterClear")}
        </Btn>
      )}
    </Toolbar>
  );
}
