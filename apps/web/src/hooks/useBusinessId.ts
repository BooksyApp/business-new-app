import type { Id } from "@/types/id";
import { useParams } from "react-router-dom";
import { getCurrentBusinessId as getStoredBusinessId } from "@/config/api";
import { idForKey } from "@/lib/salonKey";

/**
 * The current salon's id (its public UUID — what the API takes), from the panel URL's salon key
 * (/<slug>_<publicId>/…, lib/salonKey). BusinessOwnerRoute resolves the key before any
 * business page renders, so the pair is known here; outside a salon, the stored one.
 */
export function useBusinessId(): Id {
  const { salonKey } = useParams<{ salonKey?: string }>();
  const fromKey = idForKey(salonKey);
  if (fromKey) return fromKey;

  try {
    return getStoredBusinessId();
  } catch {
    // No salon: "" (the API calls then fail, which is expected).
    return "";
  }
}
