import { useEffect, useState } from "react";
import { businessService } from "@/services/businessService";
import { MARKET_TIME_ZONE } from "@/lib/salonClock";

const cache = new Map<number, string>();

/** The salon's IANA zone (businesses.timezone); Asia/Baku until known or when unset. */
export function useSalonTimeZone(businessId: number): string {
  const [tz, setTz] = useState<string>(() => cache.get(businessId) ?? MARKET_TIME_ZONE);
  useEffect(() => {
    if (!businessId || businessId <= 0) return;
    const known = cache.get(businessId);
    if (known) {
      setTz(known);
      return;
    }
    let live = true;
    businessService
      .getBusiness(businessId)
      .then((b) => {
        const zone = b?.timezone || MARKET_TIME_ZONE;
        cache.set(businessId, zone);
        if (live) setTz(zone);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [businessId]);
  return tz;
}
