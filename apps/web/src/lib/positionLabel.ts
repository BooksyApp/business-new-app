import { t } from "@/i18n";

/**
 * A staff "position" is free text the owner typed, often the generic AZ word "Usta"/"Ustad"
 * (or "Master"). Shown as typed it stays Azerbaijani in an RU/EN panel (UI2-HUBA-026), so those
 * generic words, and only those, are shown in the interface language. Any custom title is kept.
 */
const GENERIC = new Set(["usta", "ustad", "master", "мастер"]);

export function positionLabel(position?: string | null): string {
  const p = (position ?? "").trim();
  if (!p) return "";
  return GENERIC.has(p.toLowerCase()) ? t("staff.masterTitle") : p;
}
