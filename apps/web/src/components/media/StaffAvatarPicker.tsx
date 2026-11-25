import { useRef, useState } from "react";
import { Camera, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { assetUrl } from "@/config/api";
import { UPLOAD_REQUIREMENT, uploadImage } from "@/services/uploadService";
import { t } from "@/i18n";

/** The team member's photo: tap the camera to upload, × to go back to initials. */
export function StaffAvatarPicker({
  value,
  onChange,
  initials,
}: {
  value: string;
  onChange: (url: string) => void;
  initials?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange((await uploadImage(file, "STAFF_AVATAR")).url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("media.thePhotoCouldNotBe"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className="h-24 w-24">
          {value && <AvatarImage src={assetUrl(value)} alt="" className="object-cover" />}
          <AvatarFallback className="bg-gray-200 text-gray-700 text-2xl font-medium">
            {initials ? initials : <UserPlus size={32} />}
          </AvatarFallback>
        </Avatar>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin" aria-label={t("media.uploading")} />
          </div>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={value ? t("media.changePhoto") : t("media.addAPhoto")}
          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800"
        >
          <Camera size={16} />
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("media.removePhoto")}
            className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:text-gray-900"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("media.shownToCustomersWhenThey", { STAFF_AVATAR: UPLOAD_REQUIREMENT.STAFF_AVATAR })}</p>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" aria-label={t("media.staffPhoto")}
             onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
