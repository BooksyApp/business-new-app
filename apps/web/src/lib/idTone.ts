import type { Id } from "@/types/id";

/** A stable 0..n-1 bucket for an id (avatar colours): ids are UUID strings, not numbers to `%`. */
export function idTone(id: Id | null | undefined, n: number): number {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return n > 0 ? Math.abs(h) % n : 0;
}
