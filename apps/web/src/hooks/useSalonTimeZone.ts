import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { businessService } from "@/services/businessService";
import { MARKET_TIME_ZONE, setCurrentSalonZone } from "@/lib/salonClock";

const cache = new Map<Id, string>();

/**
 * The salon's IANA zone (businesses.timezone); Asia/Baku until known or when unset.
 * Also makes it the open salon's zone for salonNow()/salonToday() called without one.
 */
export function useSalonTimeZone(businessId: Id | null | undefined): string {
  const [tz, setTz] = useState<string>(() => (businessId ? cache.get(businessId) : undefined) ?? MARKET_TIME_ZONE);
  useEffect(() => {
    if (!businessId) return;
    const known = cache.get(businessId);
    if (known) {
      setCurrentSalonZone(known);
      setTz(known);
      return;
    }
    let live = true;
    businessService
      .getBusiness(businessId)
      .then((b) => {
        const zone = b?.timezone || MARKET_TIME_ZONE;
        cache.set(businessId, zone);
        setCurrentSalonZone(zone);
        if (live) setTz(zone);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [businessId]);
  return tz;
}
