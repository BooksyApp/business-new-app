import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { ExternalLink, ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
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
      .catch(() => toast.error("Could not load your photos"))
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
          ? slot === "cover" ? "Cover photo updated" : "Logo updated"
          : slot === "cover" ? "Cover photo removed" : "Logo removed",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the photo");
    } finally {
      setBusySlot(null);
    }
  };

  const addToGallery = useCallback(async (files: File[]) => {
    if (!businessId || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length - pending.length;
    if (room <= 0) { toast.info(`The gallery is full (${MAX_PHOTOS} photos). Remove one to add another.`); return; }
    const chosen = files.slice(0, room);
    if (files.length > room) toast.info(`Only ${room} more photo${room === 1 ? "" : "s"} fit — ${MAX_PHOTOS} at most.`);
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
      toast.success("Photo removed");
    } catch {
      toast.error("Could not remove the photo");
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
      <PageHeader
        title="Photos"
        subtitle="What customers see on your booqi page and in the app"
        actions={
          publicUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View your page
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Cover + logo: how the page opens. */}
            <section className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="rounded-xl border border-border/60 bg-white p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">Cover photo</h2>
                    <p className="text-sm text-muted-foreground">The first thing customers see — at the top of your page and on your card in search. {UPLOAD_REQUIREMENT.BUSINESS_COVER}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  disabled={busySlot === "cover"}
                  className={cn(
                    "group relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg",
                    cover ? "bg-muted" : "border-2 border-dashed border-border bg-muted/30 hover:border-foreground/30",
                  )}
                  aria-label={cover ? "Change cover photo" : "Add a cover photo"}
                >
                  {cover ? (
                    <>
                      <img src={assetUrl(cover)} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                        Change cover
                      </span>
                    </>
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <ImagePlus className="h-7 w-7" />
                      Add a cover photo
                      <span className="text-xs">Landscape works best · at least 1200 px wide</span>
                    </span>
                  )}
                  {busySlot === "cover" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-6 w-6 animate-spin" aria-label="Saving" />
                    </span>
                  )}
                </button>
                {cover && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => coverInput.current?.click()} disabled={busySlot === "cover"}>
                      Change
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setBrandImage("cover", "")} disabled={busySlot === "cover"}>
                      Remove
                    </Button>
                  </div>
                )}
                <input ref={coverInput} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Cover photo file"
                       onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setBrandImage("cover", "", f); }} />
              </div>

              <div className="rounded-xl border border-border/60 bg-white p-4 sm:p-5">
                <h2 className="font-semibold">Logo</h2>
                <p className="mb-3 text-sm text-muted-foreground">Shown next to your name on your page, in search results and when customers book. Square works best.</p>
                <p className="-mt-2 mb-3 text-xs text-muted-foreground">{UPLOAD_REQUIREMENT.BUSINESS_LOGO}</p>
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={busySlot === "logo"}
                  className={cn(
                    "relative mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl",
                    logo ? "border border-border/60 bg-white" : "border-2 border-dashed border-border bg-muted/30 hover:border-foreground/30",
                  )}
                  aria-label={logo ? "Change logo" : "Add a logo"}
                >
                  {logo ? (
                    <img src={assetUrl(logo)} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                      <ImagePlus className="h-6 w-6" /> Add logo
                    </span>
                  )}
                  {busySlot === "logo" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-5 w-5 animate-spin" aria-label="Saving" />
                    </span>
                  )}
                </button>
                {logo && (
                  <div className="mt-3 flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => logoInput.current?.click()} disabled={busySlot === "logo"}>Change</Button>
                    <Button size="sm" variant="ghost" onClick={() => setBrandImage("logo", "")} disabled={busySlot === "logo"}>Remove</Button>
                  </div>
                )}
                <input ref={logoInput} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Logo file"
                       onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setBrandImage("logo", "", f); }} />
              </div>
            </section>

            {/* Gallery */}
            <section
              className={cn(
                "rounded-xl border bg-white p-4 transition-colors sm:p-5",
                dragging ? "border-foreground/40 bg-muted/40" : "border-border/60",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Gallery <span className="ml-1 text-sm font-normal text-muted-foreground">{used} / {MAX_PHOTOS}</span></h2>
                  <p className="text-sm text-muted-foreground">Your space and your work. Customers swipe through these on your page. {UPLOAD_REQUIREMENT.BUSINESS_PHOTO}</p>
                </div>
                <Button size="sm" onClick={() => galleryInput.current?.click()} disabled={used >= MAX_PHOTOS}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Add photos
                </Button>
              </div>

              {used === 0 ? (
                <button
                  type="button"
                  onClick={() => galleryInput.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-12 text-center hover:border-foreground/30"
                >
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <span className="font-medium">Drag photos here, or click to choose</span>
                  <span className="max-w-md text-sm text-muted-foreground">
                    Show customers the room, the chairs and your best work. Daylight photos look best.
                  </span>
                  <span className="text-xs text-muted-foreground">JPEG or PNG · up to 8 MB each · {MAX_PHOTOS} at most</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((p) => {
                    const isCover = cover !== "" && cover === p.url;
                    return (
                      <figure key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border/60 bg-muted">
                        <img src={assetUrl(p.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {isCover && (
                          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">Cover</span>
                        )}
                        {/* Always visible on touch screens; on hover elsewhere. */}
                        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                          {!isCover && (
                            <button
                              type="button"
                              onClick={() => setBrandImage("cover", p.url)}
                              className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-900 hover:bg-white"
                            >
                              <Star className="h-3.5 w-3.5" /> Make cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setToDelete(p)}
                            aria-label="Delete this photo"
                            className="rounded-full bg-white/90 p-1.5 text-red-600 hover:bg-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </figure>
                    );
                  })}
                  {pending.map((p) => (
                    <div key={p.key} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="max-w-[90%] truncate">{p.name}</span>
                    </div>
                  ))}
                  {used < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => galleryInput.current?.click()}
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-foreground/30"
                    >
                      <ImagePlus className="h-5 w-5" />
                      Add more
                    </button>
                  )}
                </div>
              )}
              <input ref={galleryInput} type="file" accept="image/jpeg,image/png" multiple className="hidden" aria-label="Gallery photo files"
                     onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; addToGallery(files); }} />
              {used > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">Changes are saved automatically. You can also drag photos onto this box.</p>
              )}
            </section>
          </>
        )}
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from your page straight away.</AlertDialogDescription>
          </AlertDialogHeader>
          {toDelete && <img src={assetUrl(toDelete.url)} alt="" className="max-h-48 w-full rounded-md object-cover" />}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (toDelete) removePhoto(toDelete); setToDelete(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
