import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { BackToSettings } from "@/components/page/SettingsChrome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServices } from "@/hooks/useServices";
import { getCurrentBusinessId } from "@/config/api";
import { t } from "@/i18n";
import {
  consentFormService,
  type ConsentForm,
  type ConsentFormField,
  type ConsentFieldType,
  type ConsentFormInput,
} from "@/services/consentFormService";
import type { Id } from "@/types/id";

const FIELD_TYPES: ConsentFieldType[] = ["TEXT", "LONG_TEXT", "YES_NO", "CHOICE", "DATE", "CONSENT", "SIGNATURE"];

const EMPTY_FIELD: ConsentFormField = {
  type: "TEXT",
  labelAz: "",
  labelEn: "",
  labelRu: "",
  options: [],
  required: false,
  sensitive: false,
};

/**
 * FG-W4-02: the salon's digital forms. A form is a list of questions; it is attached to services,
 * and a client fills it through a signed link after booking one of them. Sensitive questions are
 * shown on the client card only to the owner, managers and the staff who did the visit.
 */
export default function ConsentFormsPage() {
  const businessId = getCurrentBusinessId() as Id;
  const { services } = useServices();
  const [forms, setForms] = useState<ConsentForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConsentForm | "new" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setForms(await consentFormService.list(businessId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("consentForms.failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("consentForms.title")}
          subtitle={t("consentForms.subtitle")}
          actions={
            <Button className={primaryBtn} onClick={() => setEditing("new")}>
              {t("consentForms.new")}
            </Button>
          }
        />
        <div className={pageBody}>
          <BackToSettings />
          {loading ? (
            <div className="h-40 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : forms.length === 0 ? (
            <p className="text-sm text-[rgb(var(--reg-muted))]">{t("consentForms.empty")}</p>
          ) : (
            <ul className="space-y-3">
              {forms.map((form) => (
                <li key={String(form.id)} className="flex items-center gap-3 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{form.name}</p>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">
                      {t("consentForms.questions", { count: form.fields.length })} · {t("consentForms.services", { count: form.serviceIds.length })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditing(form)}>
                    {t("consentForms.edit")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {editing && (
          <FormEditor
            key={editing === "new" ? "new" : String(editing.id)}
            businessId={businessId}
            initial={editing === "new" ? null : editing}
            services={services.map((s) => ({ id: s.id, name: s.name }))}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
      </BooqiScope>
    </AppLayout>
  );
}

function FormEditor({
  businessId,
  initial,
  services,
  onClose,
  onSaved,
}: {
  businessId: Id;
  initial: ConsentForm | null;
  services: Array<{ id: Id; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [fields, setFields] = useState<ConsentFormField[]>(initial?.fields ?? []);
  const [serviceIds, setServiceIds] = useState<string[]>((initial?.serviceIds ?? []).map(String));
  const [busy, setBusy] = useState(false);

  const update = (index: number, patch: Partial<ConsentFormField>) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const move = (index: number, dir: -1 | 1) =>
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const toggleService = (id: Id) => {
    const key = String(id);
    setServiceIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const validate = (): string | null => {
    if (!name.trim()) return t("consentForms.needName");
    if (fields.length === 0) return t("consentForms.needField");
    for (const f of fields) {
      if (!f.labelAz.trim() && !f.labelEn.trim() && !f.labelRu.trim()) return t("consentForms.needLabel");
      if (f.type === "CHOICE" && f.options.length < 2) return t("consentForms.needOptions");
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    const body: ConsentFormInput = { name: name.trim(), fields, serviceIds };
    setBusy(true);
    try {
      if (initial) {
        await consentFormService.update(initial.id, body);
      } else {
        await consentFormService.create(businessId, body);
      }
      toast.success(t("consentForms.saved"));
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("consentForms.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("consentForms.editForm") : t("consentForms.newForm")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("consentForms.name")}</span>
            <input className={fieldCls} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("consentForms.questionsTitle")}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={fields.length >= 40}
                onClick={() => setFields((prev) => [...prev, { ...EMPTY_FIELD }])}
              >
                {t("consentForms.addField")}
              </Button>
            </div>

            {fields.map((f, i) => (
              <div key={`${i}-${f.key ?? "new"}`} className="space-y-2 rounded-2xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={fieldCls}
                    aria-label={t("consentForms.fieldType")}
                    value={f.type}
                    onChange={(e) => update(i, { type: e.target.value as ConsentFieldType })}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>{t(`consentForms.type_${type}`)}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => move(i, -1)} aria-label={t("consentForms.moveUp")}>↑</Button>
                    <Button variant="ghost" size="sm" onClick={() => move(i, 1)} aria-label={t("consentForms.moveDown")}>↓</Button>
                    <Button variant="ghost" size="sm" onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}>
                      {t("consentForms.removeField")}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <input className={fieldCls} placeholder={t("consentForms.labelAz")} value={f.labelAz} onChange={(e) => update(i, { labelAz: e.target.value })} />
                  <input className={fieldCls} placeholder={t("consentForms.labelEn")} value={f.labelEn} onChange={(e) => update(i, { labelEn: e.target.value })} />
                  <input className={fieldCls} placeholder={t("consentForms.labelRu")} value={f.labelRu} onChange={(e) => update(i, { labelRu: e.target.value })} />
                </div>

                {f.type === "CHOICE" && (
                  <textarea
                    className={fieldCls}
                    rows={3}
                    placeholder={t("consentForms.optionsHint")}
                    value={f.options.join("\n")}
                    onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                  />
                )}

                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
                    {t("consentForms.required")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.sensitive} onChange={(e) => update(i, { sensitive: e.target.checked })} />
                    {t("consentForms.sensitive")}
                  </label>
                </div>
                {f.sensitive && <p className="text-xs text-[rgb(var(--reg-muted))]">{t("consentForms.sensitiveHint")}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{t("consentForms.servicesTitle")}</span>
            <p className="text-xs text-[rgb(var(--reg-muted))]">{t("consentForms.servicesHint")}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {services.map((s) => (
                <label key={String(s.id)} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={serviceIds.includes(String(s.id))} onChange={() => toggleService(s.id)} />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("consentForms.cancel")}</Button>
          <Button className={primaryBtn} onClick={() => void save()} disabled={busy}>
            {busy ? t("consentForms.saving") : t("consentForms.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
