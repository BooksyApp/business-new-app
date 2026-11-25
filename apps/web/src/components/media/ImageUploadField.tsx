import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assetUrl } from "@/config/api";
import { uploadImage, type UploadPurpose } from "@/services/uploadService";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface Props {
  /** The stored URL ("/api/public/uploads/<id>.jpg", or an older absolute link). */
  value: string | null | undefined;
  onChange: (url: string) => void;
  purpose: UploadPurpose;
  /** circle: a person; square: a logo; wide: a cover. */
  shape?: "circle" | "square" | "wide";
  label: string;
  hint?: string;
  className?: string;
}

/** Pick a photo from the device, upload it, and hand back its URL. Replaces paste-a-link fields. */
export function ImageUploadField({ value, onChange, purpose, shape = "square", label, hint, className }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadImage(file, purpose);
      onChange(up.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("media.thePhotoCouldNotBe"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const frame = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden border border-border/60 bg-muted/40",
    shape === "circle" && "h-20 w-20 rounded-full",
    shape === "square" && "h-20 w-20 rounded-lg",
    shape === "wide" && "aspect-[16/7] w-full rounded-lg",
  );

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className={cn("flex gap-4", shape === "wide" ? "flex-col" : "items-center")}>
        <div className={frame}>
          {value ? (
            <img src={assetUrl(value)} alt="" className={cn("h-full w-full", shape === "square" ? "object-contain bg-white" : "object-cover")} />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin" aria-label={t("media.uploading")} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            {value ? t("media.changePhoto") : t("media.uploadPhoto")}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange("")}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("common.remove")}
            </Button>
          )}
          {hint && <p className="w-full text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        aria-label={label}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
