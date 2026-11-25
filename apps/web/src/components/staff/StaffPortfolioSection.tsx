import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { assetUrl } from "@/config/api";
import { t } from "@/i18n";
import {
  MAX_PORTFOLIO_CAPTION,
  MAX_PORTFOLIO_PHOTOS,
  moveItem,
  staffPortfolioService,
  type PortfolioPhoto,
} from "@/services/staffPortfolioService";
import { UPLOAD_REQUIREMENT, uploadImage } from "@/services/uploadService";
import type { Id } from "@/types/id";

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * FG-W2-29: a specialist's "Works" gallery. Clients see these photos on the salon page and
 * pick a specialist by them. Changes save at once (the sheet's Save is for the profile).
 */
export function StaffPortfolioSection({ businessId, staffId, services }: {
  businessId: Id;
  staffId: Id;
  services: { id: Id; name: string }[];
}) {
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [serviceId, setServiceId] = useState<Id>("");
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setPhotos(await staffPortfolioService.list(businessId, staffId));
    } catch (e) {
      toast.error(errorText(e, t("staffPortfolio.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [businessId, staffId]);

  useEffect(() => {
    if (businessId && staffId) void load();
  }, [businessId, staffId, load]);

  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadImage(file, "STAFF_PORTFOLIO");
      const photo = await staffPortfolioService.add(businessId, staffId, { upload: up.id, caption, serviceId: serviceId || null });
      setPhotos((prev) => [...prev.filter((p) => p.id !== photo.id), photo]);
      setCaption("");
    } catch (e) {
      toast.error(errorText(e, t("staffPortfolio.uploadFailed")));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const save = async (photo: PortfolioPhoto, patch: Partial<Pick<PortfolioPhoto, "caption" | "serviceId">>) => {
    const next = { caption: photo.caption, serviceId: photo.serviceId, ...patch };
    if ((next.caption ?? "") === (photo.caption ?? "") && (next.serviceId ?? "") === (photo.serviceId ?? "")) return;
    try {
      const saved = await staffPortfolioService.update(businessId, staffId, photo.id, next);
      setPhotos((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    } catch (e) {
      toast.error(errorText(e, t("staffPortfolio.saveFailed")));
    }
  };

  const remove = async (photo: PortfolioPhoto) => {
    if (!window.confirm(t("staffPortfolio.deleteConfirm"))) return;
    try {
      await staffPortfolioService.remove(businessId, staffId, photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e) {
      toast.error(errorText(e, t("staffPortfolio.deleteFailed")));
    }
  };

  const move = async (index: number, step: -1 | 1) => {
    const next = moveItem(photos, index, step);
    if (next === photos) return;
    setPhotos(next);
    try {
      setPhotos(await staffPortfolioService.reorder(businessId, staffId, next.map((p) => p.id)));
    } catch (e) {
      toast.error(errorText(e, t("staffPortfolio.reorderFailed")));
      void load();
    }
  };

  const full = photos.length >= MAX_PORTFOLIO_PHOTOS;
  const field = "h-10 rounded-xl border border-[rgb(var(--reg-line))] bg-white px-3 text-sm";
  const iconBtn = "rounded-full bg-white/90 p-1.5 shadow disabled:opacity-40";

  return (
    <div className="mt-6 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[rgb(var(--reg-ink))]">{t("staffPortfolio.title")}</h3>
        <span className="text-xs text-[rgb(var(--reg-muted))]">
          {t("staffPortfolio.count", { count: photos.length, max: MAX_PORTFOLIO_PHOTOS })}
        </span>
      </div>
      <p className="mb-4 text-xs text-[rgb(var(--reg-muted))]">{t("staffPortfolio.hint")}</p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--reg-muted)/0.8)]" aria-label={t("staffPortfolio.loading")} />
        </div>
      ) : photos.length === 0 ? (
        <p className="mb-4 text-sm text-[rgb(var(--reg-muted))]">{t("staffPortfolio.empty")}</p>
      ) : (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((ph, i) => (
            <li key={ph.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
              <div className="relative">
                <img src={assetUrl(ph.url)} alt={ph.caption || t("staffPortfolio.photoAlt")} className="aspect-square w-full object-cover" />
                <div className="absolute right-1 top-1 flex gap-1">
                  <button type="button" className={iconBtn} disabled={i === 0} onClick={() => void move(i, -1)}
                    aria-label={t("staffPortfolio.moveUp")}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className={iconBtn} disabled={i === photos.length - 1} onClick={() => void move(i, 1)}
                    aria-label={t("staffPortfolio.moveDown")}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => void remove(ph)} aria-label={t("staffPortfolio.delete")}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 p-2">
                <input
                  defaultValue={ph.caption ?? ""}
                  maxLength={MAX_PORTFOLIO_CAPTION}
                  placeholder={t("staffPortfolio.captionPlaceholder")}
                  aria-label={t("staffPortfolio.caption")}
                  onBlur={(e) => void save(ph, { caption: e.target.value.trim() || null })}
                  className="h-8 w-full rounded-lg border border-[rgb(var(--reg-line))] px-2 text-xs"
                />
                {services.length > 0 && (
                  <select
                    value={ph.serviceId ?? ""}
                    aria-label={t("staffPortfolio.service")}
                    onChange={(e) => void save(ph, { serviceId: e.target.value || null })}
                    className="h-8 w-full rounded-lg border border-[rgb(var(--reg-line))] bg-white px-2 text-xs"
                  >
                    <option value="">{t("staffPortfolio.noService")}</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={MAX_PORTFOLIO_CAPTION}
          placeholder={t("staffPortfolio.captionPlaceholder")} aria-label={t("staffPortfolio.caption")}
          className={`${field} min-w-0 flex-1`} />
        {services.length > 0 && (
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={field}
            aria-label={t("staffPortfolio.service")}>
            <option value="">{t("staffPortfolio.noService")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={busy || full}
          onClick={() => input.current?.click()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[rgb(var(--reg-brand-strong))] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {t("staffPortfolio.add")}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" aria-label={t("staffPortfolio.add")}
          onChange={(e) => void add(e.target.files?.[0])} />
      </div>
      <p className="mt-1 text-xs text-[rgb(var(--reg-muted))]">
        {full ? t("staffPortfolio.limitReached", { max: MAX_PORTFOLIO_PHOTOS }) : UPLOAD_REQUIREMENT.STAFF_PORTFOLIO}
      </p>
    </div>
  );
}
