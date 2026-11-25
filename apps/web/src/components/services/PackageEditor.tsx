import type { Id } from "@/types/id";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { currencySymbol } from "@/lib/currency";
import { packageTotals, type PackageStepDraft } from "@/lib/servicePackage";
import type { Service } from "@/services/serviceService";
import { t as tr, formatMinutes } from "@/i18n";

export interface PackageDraft {
  enabled: boolean;
  maxPartySize: number;
  steps: PackageStepDraft[];
}

export const EMPTY_PACKAGE: PackageDraft = { enabled: false, maxPartySize: 1, steps: [] };

interface Props {
  value: PackageDraft;
  onChange: (next: PackageDraft) => void;
  /** Services a step may use: already filtered to active, non-class, non-package, not this one. */
  services: Service[];
  staff: { id: Id; name: string }[];
}

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function PackageEditor({ value, onChange, services, staff }: Props) {
  const byId = new Map(services.map((s) => [String(s.id), s]));
  const set = (patch: Partial<PackageDraft>) => onChange({ ...value, ...patch });
  const setStep = (i: number, patch: Partial<PackageStepDraft>) =>
    set({ steps: value.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.steps.length) return;
    const steps = [...value.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    set({ steps });
  };

  const figures = value.steps.map((st) => {
    const svc = byId.get(st.serviceId);
    const ov = st.staffId ? svc?.staffOverrides?.find((o) => String(o.staffId) === String(st.staffId)) : undefined;
    return {
      durationMinutes: Number(ov?.durationMinutes ?? svc?.durationMinutes ?? 0),
      price: Number(ov?.price ?? svc?.price ?? 0),
    };
  });
  const totals = packageTotals(value.steps, figures);

  return (
    <div className="grid gap-4 py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">{tr("addService.packageTitle")}</Label>
          <span className="text-xs text-[rgb(var(--reg-muted))]">{tr("addService.packageHint")}</span>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) =>
            set({ enabled, steps: enabled && value.steps.length === 0 ? [{ serviceId: "", staffId: null, parallel: false }] : value.steps })
          }
        />
      </div>

      {value.enabled && (
        <>
          <ol className="grid gap-3">
            {value.steps.map((st, i) => {
              const svc = byId.get(st.serviceId);
              const able = staff.filter((m) => svc?.staffIds?.some((id) => String(id) === String(m.id)));
              return (
                <li key={i} className="grid gap-2 rounded-lg border border-[rgb(var(--reg-line))] p-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-line)/0.6)] text-xs font-bold">{i + 1}</span>
                    <select
                      className={SELECT}
                      aria-label={tr("addService.packageStepService")}
                      value={st.serviceId}
                      onChange={(e) => setStep(i, { serviceId: e.target.value, staffId: null })}
                    >
                      <option value="">{tr("addService.packagePickService")}</option>
                      {services.map((s) => (
                        <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                    <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr("addService.packageMoveUp")}>
                      <ArrowUp size={16} />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" disabled={i === value.steps.length - 1} onClick={() => move(i, 1)} aria-label={tr("addService.packageMoveDown")}>
                      <ArrowDown size={16} />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => set({ steps: value.steps.filter((_, j) => j !== i) })} aria-label={tr("addService.packageRemoveStep")}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <select
                    className={SELECT}
                    aria-label={tr("addService.packageStepSpecialist")}
                    value={st.staffId ? String(st.staffId) : ""}
                    disabled={!svc}
                    onChange={(e) => setStep(i, { staffId: e.target.value || null })}
                  >
                    <option value="">{tr("addService.packageAnySpecialist")}</option>
                    {able.map((m) => (
                      <option key={String(m.id)} value={String(m.id)}>{m.name}</option>
                    ))}
                  </select>
                  {i > 0 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={st.parallel} onCheckedChange={(v) => setStep(i, { parallel: v === true })} />
                      {tr("addService.packageParallel")}
                    </label>
                  )}
                </li>
              );
            })}
          </ol>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={value.steps.length >= 10}
              onClick={() => set({ steps: [...value.steps, { serviceId: "", staffId: null, parallel: false }] })}
            >
              <Plus size={14} className="mr-1" />{tr("addService.packageAddStep")}
            </Button>
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">{tr("addService.packageMaxParty")}</Label>
            <select className={SELECT} value={value.maxPartySize} onChange={(e) => set({ maxPartySize: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <p className="text-sm font-semibold" data-testid="package-totals">
            {tr("addService.packageTotals", {
              duration: formatMinutes(totals.totalDurationMinutes),
              price: `${totals.totalPrice} ${currencySymbol()}`,
            })}
          </p>
        </>
      )}
    </div>
  );
}
