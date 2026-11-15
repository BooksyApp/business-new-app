import { Check, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import { useIsMobile } from "@/hooks/use-mobile";
import { HUB_LOCALES } from "@/lib/hubLocale";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface LanguageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLanguage: string;
  onLanguageChange: (code: string) => void;
}

/**
 * The panel's language: native names with the English name underneath, the current one
 * checked, no flags (a flag is a country, not a language). Picking one switches at once
 * and closes — there is no OK step. A dialog on desktop, a bottom sheet on a phone.
 */
export function LanguageModal({ open, onOpenChange, selectedLanguage, onLanguageChange }: LanguageModalProps) {
  const isMobile = useIsMobile();

  const list = (
    <div className="px-3 pb-3" style={{ fontFamily: BRAND_FONT }}>
      <ul role="radiogroup" aria-label={t("layout.language")} className="space-y-1">
        {HUB_LOCALES.map((l) => {
          const on = l.code === selectedLanguage;
          return (
            <li key={l.code}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                lang={l.code}
                onClick={() => {
                  if (!on) onLanguageChange(l.code);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]",
                  on ? "bg-[rgb(var(--reg-brand-soft))]" : "hover:bg-[rgb(var(--reg-ink)/0.04)]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-base text-[rgb(var(--reg-ink))]", on ? "font-bold" : "font-semibold")}>{l.name}</span>
                  <span className="block text-sm text-[rgb(var(--reg-muted))]">{l.subtitle}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    on ? "bg-[rgb(var(--reg-brand))] text-white" : "ring-1 ring-inset ring-[rgb(var(--reg-line))]",
                  )}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const header = (Title: typeof DialogTitle | typeof SheetTitle, Desc: typeof DialogDescription | typeof SheetDescription) => (
    <div className="flex items-center gap-2 px-6 pb-2 pt-5" style={{ fontFamily: BRAND_FONT }}>
      <Globe size={20} className="text-[rgb(var(--reg-muted))]" aria-hidden />
      <Title className="text-lg font-extrabold tracking-[-0.02em] text-[rgb(var(--reg-ink))]">{t("layout.language")}</Title>
      <Desc className="sr-only">{t("layout.chooseTheLanguageOfThe")}</Desc>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-[28px] border-0 bg-white p-0 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[rgb(var(--reg-ink)/0.15)]" aria-hidden />
          {header(SheetTitle, SheetDescription)}
          {list}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-[24px] border-0 bg-white p-0 sm:max-w-sm">
        {header(DialogTitle, DialogDescription)}
        {list}
      </DialogContent>
    </Dialog>
  );
}
