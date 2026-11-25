import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { t } from "@/i18n";
import { clientTagService, type ClientField, type ClientFieldType } from "@/services/clientTagService";
import type { Id } from "@/types/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { primaryBtn } from "@/components/page/booqiStyles";
import { cn } from "@/lib/utils";

const TYPES: ClientFieldType[] = ["TEXT", "NUMBER", "DATE", "SELECT"];
const typeLabel = (type: ClientFieldType) =>
  ({ TEXT: t("clients.cfTypeText"), NUMBER: t("clients.cfTypeNumber"), DATE: t("clients.cfTypeDate"), SELECT: t("clients.cfTypeSelect") })[type];

/** FG-W2-05: the salon's custom fields on one client, and the dialog that defines the fields. */
export function ClientFieldsSection({ businessId, clientId, labelClass, boxClass }: {
  businessId: Id;
  clientId: Id;
  labelClass: string;
  boxClass: string;
}) {
  const [fields, setFields] = useState<ClientField[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [defs, setDefs] = useState<ClientField[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ClientFieldType>("TEXT");
  const [newOptions, setNewOptions] = useState("");

  const apply = (list: ClientField[]) => {
    setFields(list);
    setDraft(Object.fromEntries(list.map((f) => [String(f.id), f.value ?? ""])));
  };

  const load = () => clientTagService.clientFields(businessId, clientId).then(apply).catch(() => undefined);

  useEffect(() => {
    setFields(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, clientId]);

  const dirty = (fields ?? []).some((f) => (draft[String(f.id)] ?? "") !== (f.value ?? ""));

  const save = async () => {
    setBusy(true);
    try {
      const changed: Record<string, string> = {};
      for (const f of fields ?? []) {
        const v = draft[String(f.id)] ?? "";
        if (v !== (f.value ?? "")) changed[String(f.id)] = v;
      }
      apply(await clientTagService.setClientFields(businessId, clientId, changed));
    } catch {
      toast.error(t("clients.cfSaveError"));
    } finally {
      setBusy(false);
    }
  };

  const openManage = async () => {
    setManageOpen(true);
    setDefs(await clientTagService.fields(businessId).catch(() => []));
  };

  const addField = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await clientTagService.createField(businessId, {
        name: newName.trim(),
        type: newType,
        options: newType === "SELECT" ? newOptions.split("\n") : undefined,
      });
      setNewName("");
      setNewOptions("");
      setDefs(await clientTagService.fields(businessId));
      await load();
    } catch {
      toast.error(t("clients.cfCreateError"));
    } finally {
      setBusy(false);
    }
  };

  const removeField = async (id: Id) => {
    setBusy(true);
    try {
      await clientTagService.deleteField(businessId, id);
      setDefs(await clientTagService.fields(businessId));
      await load();
    } catch {
      toast.error(t("clients.cfSaveError"));
    } finally {
      setBusy(false);
    }
  };

  const input = (f: ClientField) => {
    const key = String(f.id);
    const set = (v: string) => setDraft((d) => ({ ...d, [key]: v }));
    if (f.type === "SELECT") {
      return (
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={draft[key] ?? ""}
          onChange={(e) => set(e.target.value)}
        >
          <option value="">{t("clients.cfNotSet")}</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <Input
        type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"}
        inputMode={f.type === "NUMBER" ? "decimal" : undefined}
        maxLength={500}
        value={draft[key] ?? ""}
        onChange={(e) => set(e.target.value)}
      />
    );
  };

  return (
    <section className={cn(boxClass, "space-y-3")}>
      <div className="flex items-center justify-between gap-2">
        <p className={labelClass}>{t("clients.cfTitle")}</p>
        <Button variant="outline" size="sm" onClick={() => void openManage()}>
          {t("clients.cfManage")}
        </Button>
      </div>
      {fields && fields.length === 0 && <p className="text-sm text-[rgb(var(--reg-muted))]">{t("clients.cfNone")}</p>}
      {fields && fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((f) => (
            <label key={f.id} className="block space-y-1">
              <span className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{f.name}</span>
              {input(f)}
            </label>
          ))}
          <div className="flex justify-end">
            <Button className={primaryBtn} size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {t("clients.cfSave")}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("clients.cfDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {defs.length === 0 && <p className="text-sm text-[rgb(var(--reg-muted))]">{t("clients.cfNone")}</p>}
              {defs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {d.name} <span className="text-xs text-[rgb(var(--reg-muted))]">· {typeLabel(d.type)}</span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={t("clients.cfDelete")} onClick={() => void removeField(d.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-[rgb(var(--reg-line))] pt-3">
              <p className={labelClass}>{t("clients.cfAddField")}</p>
              <Input value={newName} maxLength={60} placeholder={t("clients.cfName")} onChange={(e) => setNewName(e.target.value)} />
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("clients.cfType")}
                value={newType}
                onChange={(e) => setNewType(e.target.value as ClientFieldType)}
              >
                {TYPES.map((x) => <option key={x} value={x}>{typeLabel(x)}</option>)}
              </select>
              {newType === "SELECT" && (
                <Textarea rows={3} value={newOptions} placeholder={t("clients.cfOptions")} onChange={(e) => setNewOptions(e.target.value)} />
              )}
              <Button variant="outline" size="sm" onClick={() => void addField()} disabled={busy || !newName.trim() || (newType === "SELECT" && !newOptions.trim())}>
                {t("clients.cfAddField")}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button className={primaryBtn} onClick={() => setManageOpen(false)}>{t("clients.cfDone")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
