import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W2-29: one photo in a specialist's "Works" gallery (all ids are public UUIDs). */
export interface PortfolioPhoto {
  id: Id;
  staffId: Id;
  /** "/api/public/uploads/<id>.jpg" — render through assetUrl(). */
  url: string;
  caption: string | null;
  serviceId: Id | null;
  position: number;
}

/** The server keeps this many photos per specialist (StaffPortfolioService.MAX_PHOTOS). */
export const MAX_PORTFOLIO_PHOTOS = 30;
export const MAX_PORTFOLIO_CAPTION = 200;

const base = (businessId: Id, staffId: Id) => `/businesses/${businessId}/staff/${staffId}/portfolio`;

export const staffPortfolioService = {
  list: (businessId: Id, staffId: Id) => apiClient.get<PortfolioPhoto[]>(base(businessId, staffId)),
  /** Upload first (uploadImage(file, "STAFF_PORTFOLIO")), then attach the upload's id. */
  add: (businessId: Id, staffId: Id, body: { upload: string; caption?: string | null; serviceId?: Id | null }) =>
    apiClient.post<PortfolioPhoto>(base(businessId, staffId), {
      upload: body.upload,
      caption: body.caption?.trim() || null,
      serviceId: body.serviceId || null,
    }),
  update: (businessId: Id, staffId: Id, photoId: Id, body: { caption: string | null; serviceId: Id | null }) =>
    apiClient.put<PortfolioPhoto>(`${base(businessId, staffId)}/${photoId}`, {
      caption: body.caption?.trim() || null,
      serviceId: body.serviceId || null,
    }),
  remove: (businessId: Id, staffId: Id, photoId: Id) =>
    apiClient.delete<void>(`${base(businessId, staffId)}/${photoId}`),
  /** Every photo of the portfolio exactly once, in the new order. */
  reorder: (businessId: Id, staffId: Id, ids: Id[]) =>
    apiClient.put<PortfolioPhoto[]>(`${base(businessId, staffId)}/order`, { ids }),
};

/** The list with the item at {@code index} moved one step up (-1) or down (+1); unchanged at the ends. */
export function moveItem<T>(items: T[], index: number, step: -1 | 1): T[] {
  const to = index + step;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const out = items.slice();
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}
