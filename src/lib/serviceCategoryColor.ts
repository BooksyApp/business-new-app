/**
 * One colour per service category, for the calendar blocks and the details sheet.
 *
 * Eight soft tints, picked to sit next to the booqi violet and to stay apart from each
 * other. Text is always the dark ink on a pale fill (>= 7:1), so a category colour never
 * costs legibility. Status is NOT carried by this colour — see lib/appointmentStatus.
 * The category's own `color` field is deliberately ignored: arbitrary hex would break the
 * contrast guarantee and most salons never set it, which put every block back to one colour.
 */
export interface CategoryTint {
  /** Block background. */
  fill: string;
  /** Darker left stripe and legend dot. */
  accent: string;
  /** Main text on the fill. */
  ink: string;
  /** Secondary text on the fill. */
  muted: string;
}

const INK = "#1E1B2E";
const MUTED = "#4A4560";

export const CATEGORY_PALETTE: CategoryTint[] = [
  { fill: "#EDE9FE", accent: "#7C3AED", ink: INK, muted: MUTED }, // violet
  { fill: "#FFE4EC", accent: "#D6336C", ink: INK, muted: MUTED }, // rose
  { fill: "#FEF0C7", accent: "#D97706", ink: INK, muted: MUTED }, // amber
  { fill: "#DCF5E4", accent: "#16A34A", ink: INK, muted: MUTED }, // green
  { fill: "#DFF1FC", accent: "#0284C7", ink: INK, muted: MUTED }, // sky
  { fill: "#FFE8D5", accent: "#EA580C", ink: INK, muted: MUTED }, // orange
  { fill: "#D3F5F0", accent: "#0D9488", ink: INK, muted: MUTED }, // teal
  { fill: "#F7E3FB", accent: "#C026D3", ink: INK, muted: MUTED }, // fuchsia
];

/** Stable: the same category (or, without one, the same service) is always the same tint. */
export function categoryTint(categoryId?: number | null, serviceId?: number | null): CategoryTint {
  const key = categoryId ?? serviceId;
  if (key == null || !Number.isFinite(Number(key))) return CATEGORY_PALETTE[0];
  const n = Math.abs(Math.trunc(Number(key)));
  // Multiply first so neighbouring ids (1, 2, 3) do not walk the palette in order.
  return CATEGORY_PALETTE[(n * 5 + 3) % CATEGORY_PALETTE.length];
}
