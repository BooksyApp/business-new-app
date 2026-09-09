import { useEffect, useState } from 'react';

import { discountService, type ServiceDiscount } from '@/services/discountService';

export interface ServiceOffer {
  /** What a client pays today. Already discounted when an offer is running. */
  price: number;
  /** The list price, when an offer is running. Undefined otherwise. */
  wasPrice?: number;
  percent?: number;
  label?: string;
}

/**
 * What each service costs today, offers applied.
 *
 * The till and the calendar read the catalogue, which carries the list price — so a salon
 * running 20% off saw the old number on its own screens while the app advertised the new
 * one, and the totals only agreed once the backend re-priced the sale on confirmation.
 * That is a confusing way to find out.
 *
 * One request per business, shared by both screens.
 */
export function useServiceOffers(businessId: number): Map<number, ServiceOffer> {
  const [offers, setOffers] = useState<Map<number, ServiceOffer>>(new Map());

  useEffect(() => {
    if (!businessId) return;
    let live = true;
    discountService
      .list(businessId)
      .then((rows: ServiceDiscount[]) => {
        if (!live) return;
        const next = new Map<number, ServiceOffer>();
        rows.forEach((row) => {
          const running = row.running && row.sale_price != null;
          next.set(row.id, {
            price: running ? Number(row.sale_price) : Number(row.price),
            wasPrice: running ? Number(row.price) : undefined,
            percent: running ? Number(row.discount_percent) : undefined,
            label: running ? row.discount_label ?? undefined : undefined,
          });
        });
        setOffers(next);
      })
      // A failed lookup leaves the list price showing, which is the safe way to be wrong.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [businessId]);

  return offers;
}
