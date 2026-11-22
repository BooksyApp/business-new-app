import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { assetUrl, getCurrentBusinessId } from "@/config/api";
import { looksService, type Look, type LookStatus } from "@/services/looksService";
import { serviceService, type Service } from "@/services/serviceService";
import { staffService, type Staff } from "@/services/staffService";
import { UPLOAD_REQUIREMENT, uploadImage } from "@/services/uploadService";
import { t } from "@/i18n";

const NONE = "";
const selectCls =
  "h-11 w-full rounded-md border border-[rgb(var(--reg-line))] bg-white px-3 text-sm text-[rgb(var(--reg-ink))]";

function statusLabel(s: LookStatus) {
  return s === "APPROVED" ? t("looks.approved") : s === "REJECTED" ? t("looks.rejected") : t("looks.pending");
}
const statusCls: Record<LookStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

/** Work photos shown on booqi once an admin approves them. The salon edits only its own looks. */
export default function LooksPage() {
  const businessId = getCurrentBusinessId();
  const [looks, setLooks] = useState<Look[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Look | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Look | null>(null);

  const load = () => {
    if (!businessId) { setLoading(false); return; }
    Promise.all([
      looksService.list(businessId),
      serviceService.getServicesByBusiness(businessId).catch(() => [] as Service[]),
      staffService.getStaffByBusiness(businessId).catch(() => [] as Staff[]),
    ])
      .then(([l, sv, st]) => { setLooks(l); setServices(sv); setStaff(st); })
      .catch(() => toast.error(t("looks.loadFail")))
      .finally(() => setLoading(false));
  };
  useEffect(load, [businessId]);

  const remove = async () => {
    if (!businessId || !toDelete) return;
    try {
      await looksService.remove(businessId, toDelete.id);
      setLooks((p) => p.filter((x) => x.id !== toDelete.id));
      toast.success(t("looks.deleted"));
    } catch {
      toast.error(t("looks.deleteFail"));
    }
    setToDelete(null);
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("looks.title")}
          subtitle={t("looks.subtitle")}
          actions={
            <Button className={primaryBtn} onClick={() => setEditing("new")} disabled={loading}>
              <Plus size={16} /> {t("looks.add")}
            </Button>
          }
        />
        <div className={pageBody}>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[rgb(var(--reg-muted))]">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading2")}
            </div>
          ) : looks.length === 0 ? (
            <p className="rounded-[20px] bg-white p-8 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              {t("looks.empty")}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {looks.map((l) => (
                <li key={l.id} className="min-w-0 overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  <div className="relative aspect-square bg-muted">
                    <img src={assetUrl(l.photoUrl)} alt={l.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusCls[l.status]}`}>
                      {statusLabel(l.status)}
                    </span>
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-bold">{l.title || "—"}</p>
                    <p className="truncate text-xs text-[rgb(var(--reg-muted))]">
                      {[l.serviceName, l.staffName].filter(Boolean).join(" · ") || t("looks.none")}
                    </p>
                    {l.status === "REJECTED" && l.rejectNote ? (
                      <p className="text-xs text-rose-700">{t("looks.reason")}: {l.rejectNote}</p>
                    ) : null}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => setEditing(l)} aria-label={t("looks.edit")}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 flex-1 text-rose-700" onClick={() => setToDelete(l)} aria-label={t("looks.delete")}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {editing && businessId ? (
          <LookDialog
            businessId={businessId}
            look={editing === "new" ? null : editing}
            services={services}
            staff={staff}
            onClose={() => setEditing(null)}
            onSaved={(saved) => {
              setLooks((p) => (p.some((x) => x.id === saved.id) ? p.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...p]));
              setEditing(null);
            }}
          />
        ) : null}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("looks.deleteQ")}</AlertDialogTitle>
              <AlertDialogDescription>{t("looks.deleteHint")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("looks.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>{t("looks.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </BooqiScope>
    </AppLayout>
  );
}

function LookDialog({ businessId, look, services, staff, onClose, onSaved }: {
  businessId: string;
  look: Look | null;
  services: Service[];
  staff: Staff[];
  onClose: () => void;
  onSaved: (l: Look) => void;
}) {
  const [title, setTitle] = useState(look?.title ?? "");
  const [serviceId, setServiceId] = useState<string>(look?.serviceId ? String(look.serviceId) : NONE);
  const [staffId, setStaffId] = useState<string>(look?.staffId ? String(look.staffId) : NONE);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async () => {
    if (!look && !file) { toast.error(t("looks.needPhoto")); return; }
    if (!title.trim()) { toast.error(t("looks.needTitle")); return; }
    const body = { title: title.trim(), serviceId: serviceId || null, staffId: staffId || null };
    setBusy(true);
    try {
      const saved = look
        ? await looksService.update(businessId, look.id, body)
        : await looksService.create(businessId, (await uploadImage(file as File, "LOOK")).id, body);
      toast.success(t("looks.saved"));
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("looks.saveFail"));
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? (look ? assetUrl(look.photoUrl) : null);

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{look ? t("looks.edit") : t("looks.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!look ? (
            <div>
              <Label>{t("looks.photo")}</Label>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="mt-1 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[rgb(var(--reg-line))] bg-muted/30 text-sm text-[rgb(var(--reg-muted))]"
              >
                {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : t("looks.choosePhoto")}
              </button>
              <p className="mt-1 text-xs text-[rgb(var(--reg-muted))]">{UPLOAD_REQUIREMENT.LOOK ?? t("looks.req")}</p>
              <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          ) : (
            <>
              {shown ? <img src={shown} alt="" className="aspect-square w-full rounded-lg object-cover" /> : null}
              <p className="text-xs text-[rgb(var(--reg-muted))]">{t("looks.reeditNote")}</p>
            </>
          )}
          <div>
            <Label htmlFor="look-title">{t("looks.titleLabel")}</Label>
            <Input id="look-title" className="mt-1 h-11" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="look-service">{t("looks.service")}</Label>
            <select id="look-service" className={`${selectCls} mt-1`} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value={NONE}>{t("looks.none")}</option>
              {services.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="look-staff">{t("looks.staff")}</Label>
            <select id="look-staff" className={`${selectCls} mt-1`} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value={NONE}>{t("looks.none")}</option>
              {staff.filter((s) => s.isActive).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className={secondaryBtn} onClick={onClose} disabled={busy}>{t("looks.cancel")}</Button>
          <Button className={primaryBtn} onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {busy ? t("looks.saving") : t("looks.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
