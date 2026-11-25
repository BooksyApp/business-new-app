import { useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { t } from "@/i18n";
import { salonDayService, type ClientRecord } from "@/services/salonDayService";
import { uploadImage } from "@/services/uploadService";
import type { Id } from "@/types/id";

/**
 * FG-W1-09: before/after photos on the client card. A phone photo (often 5–12 MB, sometimes
 * HEIC) is redrawn in the browser as a JPEG of at most 2000 px before upload, so the 8 MB
 * upload limit and the JPEG/PNG rule never stop a camera shot; the server keeps 1600 px.
 */
async function asJpeg(file: File): Promise<File> {
  if (/^image\/(jpeg|png)$/.test(file.type) && file.size <= 4 * 1024 * 1024) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
  if (!blob) throw new Error(t("clients.photoReadFailed"));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function ClientPhotosSection({ businessId, clientId, record, onChanged, labelClass }: {
  businessId: Id;
  clientId: Id;
  record: ClientRecord;
  onChanged: () => void;
  labelClass: string;
}) {
  const [kind, setKind] = useState<"BEFORE" | "AFTER">("BEFORE");
  const [caption, setCaption] = useState("");
  const [visit, setVisit] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t("clients.photoTooLarge"));
      return;
    }
    setBusy(true);
    try {
      const up = await uploadImage(await asJpeg(file), "CLIENT_PHOTO");
      await salonDayService.addClientPhoto(businessId, clientId, {
        url: up.url, kind, caption: caption.trim() || undefined, appointmentId: visit || undefined,
      });
      setCaption("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("clients.photoUploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photoId: Id) => {
    if (!window.confirm(t("clients.photoDeleteConfirm"))) return;
    try {
      await salonDayService.deleteClientPhoto(businessId, photoId);
      onChanged();
    } catch {
      toast.error(t("clients.photoDeleteFailed"));
    }
  };

  const field = "h-10 rounded-xl border border-[rgb(var(--reg-line))] bg-white px-3 text-sm";
  return (
    <section>
      <p className={`${labelClass} mb-2`}>{t("clients.photos", { count: record.photos.length })}</p>
      {record.photos.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {record.photos.map((ph) => (
            <figure key={ph.id} className="relative overflow-hidden rounded-xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
              <img src={ph.url} alt={ph.caption || ph.kind.toLowerCase()} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => void remove(ph.id)}
                aria-label={t("clients.photoDelete")}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1.5 shadow"
              >
                <Trash2 size={14} />
              </button>
              <figcaption className="px-2 py-1 text-[11px] font-semibold">
                {ph.kind === "BEFORE" ? t("clients.before") : t("clients.after")} · {ph.taken_on}
                {ph.caption ? <span className="block font-normal text-[rgb(var(--reg-muted))]">{ph.caption}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as "BEFORE" | "AFTER")} className={field}>
          <option value="BEFORE">{t("clients.before")}</option>
          <option value="AFTER">{t("clients.after")}</option>
        </select>
        {record.visits.length > 0 && (
          <select value={visit} onChange={(e) => setVisit(e.target.value)} className={field}>
            <option value="">{t("clients.photoNoVisit")}</option>
            {record.visits.slice(0, 20).map((v) => (
              <option key={String(v.id)} value={String(v.id)}>
                {v.appointment_date} · {v.service_name ?? ""}
              </option>
            ))}
          </select>
        )}
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200}
          placeholder={t("clients.photoCaption")} className={`${field} min-w-0 flex-1`} />
        <label className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[rgb(var(--reg-brand-strong))] px-4 text-sm font-semibold text-white ${busy ? "opacity-60" : ""}`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {t("clients.photoAdd")}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
            onChange={(e) => { void add(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      <p className="mt-1 text-xs text-[rgb(var(--reg-muted))]">{t("clients.photoPrivate")}</p>
    </section>
  );
}
