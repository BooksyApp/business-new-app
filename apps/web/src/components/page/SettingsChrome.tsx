
import { Button } from "@/components/ui/button";
import { primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Was "‹ Settings" above a settings sub-page. The way back now lives in the layout for every
 * settings screen (the settings sub-nav on a desktop, the tabs bar's "‹ Settings" on a
 * phone), so pages that still render this get nothing rather than a second back link.
 */
export function BackToSettings() {
  return null;
}

/**
 * The one save bar settings pages share: it sticks to the bottom (above the phone tab bar)
 * and only appears once something has changed, so "did that save?" has one answer.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
}) {
  if (!dirty && !saving) return null;
  return (
    <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-20 px-4 pb-2 md:bottom-4 md:px-8">
      <div
        role="status"
        className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_18px_48px_-20px_rgb(var(--reg-ink)/0.35)] ring-1 ring-[rgb(var(--reg-line))] backdrop-blur"
      >
        <p className="mr-auto min-w-0 truncate text-sm font-semibold">{t("setup.unsavedChanges")}</p>
        {onDiscard && (
          <Button variant="outline" className={cn(secondaryBtn, "hidden sm:inline-flex")} disabled={saving} onClick={onDiscard}>
            {t("setup.discard")}
          </Button>
        )}
        <Button className={primaryBtn} disabled={saving} onClick={onSave}>
          {saving ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
