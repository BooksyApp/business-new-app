/** Pure helpers for package services (several specialists in one visit) and visit colours. */

export interface PackageStepDraft {
  serviceId: string;
  staffId: string | null;
  parallel: boolean;
}

export interface StepFigures {
  durationMinutes: number;
  price: number;
}

/**
 * Sequential steps add up; a parallel step runs alongside the previous step, so a group
 * lasts as long as its longest member. Price is the sum of every step. The first step is
 * never parallel.
 */
export function packageTotals(
  steps: { parallel: boolean }[],
  figures: StepFigures[],
): { totalDurationMinutes: number; totalPrice: number } {
  let total = 0;
  let groupLen = 0;
  let price = 0;
  steps.forEach((s, i) => {
    const f = figures[i] ?? { durationMinutes: 0, price: 0 };
    price += f.price;
    if (i > 0 && s.parallel) {
      groupLen = Math.max(groupLen, f.durationMinutes);
    } else {
      total += groupLen;
      groupLen = f.durationMinutes;
    }
  });
  return { totalDurationMinutes: total + groupLen, totalPrice: price };
}

/** Same visitId, same colour, always: a hue taken from a hash of the id. */
export function visitAccent(visitId: string | null | undefined): string | null {
  if (!visitId) return null;
  let hash = 0;
  for (let i = 0; i < visitId.length; i++) hash = (hash * 31 + visitId.charCodeAt(i)) >>> 0;
  return `hsl(${(hash * 137) % 360} 70% 42%)`;
}
