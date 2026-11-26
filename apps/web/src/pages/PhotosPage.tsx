import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ExternalLink, ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { BooqiScope, PageHeader, pageBody } from "@/components/bz/p4-compat";

import { AppLayout } from "@/components/layout/AppLayout";
import { primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { ClientPreview } from "@/components/page/kit";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { assetUrl, getCurrentBusinessId, publicSiteUrl } from "@/config/api";
import { businessService, type Business } from "@/services/businessService";
import {
  businessPhotoService,
  UPLOAD_REQUIREMENT,
  uploadImage,
  type BusinessPhoto,
  type UploadPurpose,
} from "@/services/uploadService";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const MAX_PHOTOS = 12;

type Pending = { key: string; name: string };

/**
 * Everything a customer sees of the salon, on one page: cover, logo, gallery.
 *
 * It replaces the image fields on Branding, where cover and logo waited for a Save button
 * while gallery photos saved the moment they were added — two rules on one screen, and
 * nothing said where any of it would appear. Here every change is saved as it is made.
 */
export default function PhotosPage() {
  const businessId = getCurrentBusinessId();
  const [business, setBusiness] = useState<Business | null>(null);
  const [photos, setPhotos] = useState<BusinessPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busySlot, setBusySlot] = useState<"cover" | "logo" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [toDelete, setToDelete] = useState<BusinessPhoto | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    Promise.all([businessService.getBusiness(businessId), businessPhotoService.list(businessId)])
      .then(([b, list]) => { setBusiness(b); setPhotos(list); })
      .catch(() => toast.error(t("photos.couldNotLoadYourPhotos")))
      .finally(() => setLoading(false));
  }, [businessId]);

  const publicUrl = (() => {
    if (!business) return "";
    return `${publicSiteUrl()}/salon/${business.slug ?? business.id}`;
  })();

  /** Cover and logo: upload, then save on the business straight away. */
  const setBrandImage = async (slot: "cover" | "logo", url: string, file?: File) => {
    if (!businessId) return;
    setBusySlot(slot);
    try {
      let value = url;
      if (file) {
        const purpose: UploadPurpose = slot === "cover" ? "BUSINESS_COVER" : "BUSINESS_LOGO";
        value = (await uploadImage(file, purpose)).url;
      }
      const patch = slot === "cover" ? { coverImageUrl: value } : { logoUrl: value };
      setBusiness(await businessService.updateBusiness(businessId, patch));
      toast.success(
        value
          ? slot === "cover" ? t("photos.coverPhotoUpdated") : t("photos.logoUpdated")
          : slot === "cover" ? t("photos.coverPhotoRemoved") : t("photos.logoRemoved"),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("photos.couldNotSaveThePhoto"));
    } finally {
      setBusySlot(null);
    }
  };

  const addToGallery = useCallback(async (files: File[]) => {
    if (!businessId || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length - pending.length;
    if (room <= 0) { toast.info(t("photos.theGalleryIsFullPhotos", { MAX_PHOTOS })); return; }
    const chosen = files.slice(0, room);
    if (files.length > room) toast.info(t("photos.onlyMoreFit", { count: room, MAX_PHOTOS }));
    const queue = chosen.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, file: f }));
    setPending((p) => [...p, ...queue.map(({ key, name }) => ({ key, name }))]);
    for (const item of queue) {
      try {
        const up = await uploadImage(item.file, "BUSINESS_PHOTO");
        const added = await businessPhotoService.add(businessId, up.id);
        setPhotos((p) => [...p, added]);
      } catch (e) {
        toast.error(`${item.name}: ${e instanceof Error ? e.message : "could not be added"}`);
      } finally {
        setPending((p) => p.filter((x) => x.key !== item.key));
      }
    }
  }, [businessId, photos.length, pending.length]);

  const removePhoto = async (photo: BusinessPhoto) => {
    if (!businessId) return;
    try {
      await businessPhotoService.remove(businessId, photo.id);
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      toast.success(t("photos.photoRemoved"));
    } catch {
      toast.error(t("photos.couldNotRemoveThePhoto"));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addToGallery(Array.from(e.dataTransfer.files).filter((f) => /^image\/(jpeg|png)$/.test(f.type)));
  };

  const cover = business?.coverImageUrl ?? "";
  const logo = business?.logoUrl ?? "";
  const used = photos.length + pending.length;

  return (
    <AppLayout>
      <BooqiScope>
      <PageHeader
        title={t("common.photos")}
        subtitle={t("photos.whatCustomersSeeOnYour")}
        actions={
          <>
            {publicUrl ? (
              <Button variant="outline" className={cn(secondaryBtn, "hidden sm:inline-flex")} asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} />{" "}{t("photos.viewYourPage")}
                </a>
              </Button>
            ) : null}
            <Button className={primaryBtn} onClick={() => galleryInput.current?.click()} disabled={loading || used >= MAX_PHOTOS}>
              <UploadCloud size={16} />{" "}{t("photos.addPhotos")}
            </Button>
          </>
        }
      />
      <div className={pageBody}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--reg-muted))]">
            <Loader2 className="h-4 w-4 animate-spin" />{" "}{t("common.loading2")}
          </div>
        ) : (
          <>
            {/* Cover + logo: how the page opens. */}
            <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] sm:p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-extrabold tracking-[-0.01em]">{t("photos.coverPhoto")}</h2>
                    <p className="text-sm text-[rgb(var(--reg-muted))]">{t("photos.theFirstThingCustomersSee", { BUSINESS_COVER: UPLOAD_REQUIREMENT.BUSINESS_COVER })}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  disabled={busySlot === "cover"}
                  className={cn(
                    "group relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg",
                    cover ? "bg-muted" : "border-2 border-dashed border-[rgb(var(--reg-line))] bg-muted/30 hover:border-foreground/30",
                  )}
                  aria-label={cover ? t("photos.changeCoverPhoto") : t("photos.addACoverPhoto")}
                >
                  {cover ? (
                    <>
                      <img src={assetUrl(cover)} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                        {t("photos.changeCover")}
                      </span>
                    </>
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-sm text-[rgb(var(--reg-muted))]">
                      <ImagePlus className="h-7 w-7" />
                      {t("photos.addACoverPhoto")}
                      <span className="text-xs">{t("photos.landscapeWorksBestAtLeast")}</span>
                    </span>
                  )}
                  {busySlot === "cover" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-6 w-6 animate-spin" aria-label={t("photos.saving")} />
                    </span>
                  )}
                </button>
                {cover && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => coverInput.current?.click()} disabled={busySlot === "cover"}>
                      {t("photos.change")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setBrandImage("cover", "")} disabled={busySlot === "cover"}>
                      {t("common.remove")}
                    </Button>
                  </div>
                )}
                <input ref={coverInput} type="file" accept="image/jpeg,image/png" className="hidden" aria-label={t("photos.coverPhotoFile")}
                       onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setBrandImage("cover", "", f); }} />
              </div>

              <div className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] sm:p-5">
                <h2 className="text-base font-extrabold tracking-[-0.01em]">{t("photos.logo")}</h2>
                <p className="mb-3 text-sm text-[rgb(var(--reg-muted))]">{t("photos.shownNextToYourName")}</p>
                <p className="-mt-2 mb-3 text-xs text-[rgb(var(--reg-muted))]">{UPLOAD_REQUIREMENT.BUSINESS_LOGO}</p>
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={busySlot === "logo"}
                  className={cn(
                    "relative mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl",
                    logo ? "border border-border/60 bg-white" : "border-2 border-dashed border-[rgb(var(--reg-line))] bg-muted/30 hover:border-foreground/30",
                  )}
                  aria-label={logo ? t("photos.changeLogo") : t("photos.addALogo")}
                >
                  {logo ? (
                    <img src={assetUrl(logo)} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-xs text-[rgb(var(--reg-muted))]">
                      <ImagePlus className="h-6 w-6" />{" "}{t("photos.addLogo")}
                    </span>
                  )}
                  {busySlot === "logo" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-5 w-5 animate-spin" aria-label={t("photos.saving")} />
                    </span>
                  )}
                </button>
                {logo && (
                  <div className="mt-3 flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => logoInput.current?.click()} disabled={busySlot === "logo"}>{t("photos.change")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setBrandImage("logo", "")} disabled={busySlot === "logo"}>{t("common.remove")}</Button>
                  </div>
                )}
                <input ref={logoInput} type="file" accept="image/jpeg,image/png" className="hidden" aria-label={t("photos.logoFile")}
                       onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setBrandImage("logo", "", f); }} />
              </div>
            </section>

            {/* Gallery */}
            <section
              className={cn(
                "rounded-[20px] bg-white p-4 ring-1 transition-colors sm:p-5",
                dragging ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]" : "ring-[rgb(var(--reg-line)/0.8)]",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold tracking-[-0.01em]">{t("photos.gallery")}{" "}<span className="ml-1 text-sm font-normal text-[rgb(var(--reg-muted))]">{used} / {MAX_PHOTOS}</span></h2>
                  <p className="text-sm text-[rgb(var(--reg-muted))]">{t("photos.yourSpaceAndYourWork", { BUSINESS_PHOTO: UPLOAD_REQUIREMENT.BUSINESS_PHOTO })}</p>
                </div>
              </div>

              {used === 0 ? (
                <button
                  type="button"
                  onClick={() => galleryInput.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[rgb(var(--reg-line))] px-4 py-12 text-center hover:border-foreground/30"
                >
                  <UploadCloud className="h-8 w-8 text-[rgb(var(--reg-muted))]" />
                  <span className="font-medium">{t("photos.dragPhotosHereOrClick")}</span>
                  <span className="max-w-md text-sm text-[rgb(var(--reg-muted))]">
                    {t("photos.showCustomersTheRoomThe")}
                  </span>
                  <span className="text-xs text-[rgb(var(--reg-muted))]">{t("photos.jpegOrPngUpTo", { MAX_PHOTOS })}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((p) => {
                    const isCover = cover !== "" && cover === p.url;
                    return (
                      <figure key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-[rgb(var(--reg-canvas))]">
                        <img src={assetUrl(p.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {isCover && (
                          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">{t("photos.cover")}</span>
                        )}
                        {/* Always visible on touch screens; on hover elsewhere. */}
                        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          {!isCover && (
                            <button
                              type="button"
                              onClick={() => setBrandImage("cover", p.url)}
                              className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-900 hover:bg-white"
                            >
                              <Star className="h-3.5 w-3.5" />{" "}{t("photos.makeCover")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setToDelete(p)}
                            aria-label={t("photos.deleteThisPhoto")}
                            className="rounded-full bg-white/90 p-1.5 text-red-600 hover:bg-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </figure>
                    );
                  })}
                  {pending.map((p) => (
                    <div key={p.key} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-xs text-[rgb(var(--reg-muted))]">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="max-w-[90%] truncate">{p.name}</span>
                    </div>
                  ))}
                  {used < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => galleryInput.current?.click()}
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[rgb(var(--reg-line))] text-sm text-[rgb(var(--reg-muted))] hover:border-foreground/30"
                    >
                      <ImagePlus className="h-5 w-5" />
                      {t("photos.addMore")}
                    </button>
                  )}
                </div>
              )}
              <input ref={galleryInput} type="file" accept="image/jpeg,image/png" multiple className="hidden" aria-label={t("photos.galleryPhotoFiles")}
                     onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; addToGallery(files); }} />
              {used > 0 && (
                <p className="mt-3 text-xs text-[rgb(var(--reg-muted))]">{t("photos.changesAreSavedAutomaticallyYou")}</p>
              )}
            </section>
          </>
        )}
      </div>
      {/* How the page opens on booqi-web: cover, logo, name, the first gallery photos. */}
      <aside className="min-w-0 xl:sticky xl:top-[132px] xl:self-start">
        <ClientPreview where={t("common.yourSalonPage")}>
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-[rgb(var(--reg-line))]">
            <div className="relative aspect-[16/8] bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))]">
              {cover ? <img src={assetUrl(cover)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            </div>
            <div className="px-4 pb-4">
              <div className="relative -mt-7 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white text-lg font-extrabold text-[rgb(var(--reg-brand-strong))] shadow-[0_6px_16px_-8px_rgb(var(--reg-ink)/0.4)] ring-2 ring-white">
                {logo ? <img src={assetUrl(logo)} alt="" className="h-full w-full object-contain" /> : (business?.name ?? "?").charAt(0).toUpperCase()}
              </div>
              <p className="mt-2 truncate text-lg font-extrabold tracking-[-0.02em]">{business?.name ?? t("common.yourSalon")}</p>
              {photos.length > 0 ? (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {photos.slice(0, 4).map((ph, i) => (
                    <div key={ph.id} className="relative aspect-square overflow-hidden rounded-lg bg-[rgb(var(--reg-canvas))]">
                      <img src={assetUrl(ph.url)} alt="" className="h-full w-full object-cover" />
                      {i === 3 && photos.length > 4 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold text-white">+{photos.length - 4}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-[rgb(var(--reg-canvas))] px-3 py-4 text-center text-xs text-[rgb(var(--reg-muted))]">{t("photos.galleryPhotosAppearHere")}</p>
              )}
            </div>
          </div>
        </ClientPreview>
      </aside>
      </div>
      </div>
      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("photos.deleteThisPhoto2")}</AlertDialogTitle>
            <AlertDialogDescription>{t("photos.itDisappearsFromYourPage")}</AlertDialogDescription>
          </AlertDialogHeader>
          {toDelete && <img src={assetUrl(toDelete.url)} alt="" className="max-h-48 w-full rounded-md object-cover" />}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("photos.keepIt")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (toDelete) removePhoto(toDelete); setToDelete(null); }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </BooqiScope>
    </AppLayout>
  );
}
