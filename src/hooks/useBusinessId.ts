import { useParams } from "react-router-dom";
import { getCurrentBusinessId as getStoredBusinessId } from "@/config/api";
import { idForKey } from "@/lib/salonKey";

/**
 * The current salon's numeric id (what the API takes), from the panel URL's salon key
 * (/<slug>_<publicId>/…, lib/salonKey). BusinessOwnerRoute resolves the key before any
 * business page renders, so the pair is known here; outside a salon, the stored one.
 */
export function useBusinessId(): number {
  const { salonKey } = useParams<{ salonKey?: string }>();
  const fromKey = idForKey(salonKey);
  if (fromKey && fromKey > 0) return fromKey;

  try {
    return getStoredBusinessId();
  } catch {
    // If no business ID is available, return 0 (will cause errors, which is expected)
    return 0;
  }
}
