import { businessService } from "@/services/businessService";
import type { AuthResponse } from "@/services/authService";

/**
 * Store what sign-in returned and pick the salon to open.
 *
 * The salon comes from the account's list (owned salons plus the ones it was invited to as a
 * team member), because only that list says what this person is there — `myRole` — and the
 * menu and pages limit themselves by it.
 */
export async function startSession(authResponse: AuthResponse): Promise<void> {
  // #9: AuthResponse is a flat record (accessToken, refreshToken, userId, fullName,
  // email, role, businessId).
  const { accessToken, refreshToken, userId, fullName, email, role, businessId } = authResponse;
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  localStorage.setItem("user", JSON.stringify({ id: userId, fullName, email, role }));

  try {
    const businesses = await businessService.getBusinessesByOwner(userId, accessToken);
    const chosen = businesses.find((b) => b.id === businessId) ?? businesses[0];
    if (chosen) {
      localStorage.setItem("currentBusinessId", chosen.id.toString());
      localStorage.setItem("currentBusiness", JSON.stringify(chosen));
      return;
    }
    if (businessId) {
      const business = await businessService.getBusiness(businessId, accessToken);
      localStorage.setItem("currentBusinessId", business.id.toString());
      localStorage.setItem("currentBusiness", JSON.stringify(business));
    }
  } catch (err) {
    // Not fatal: the home page lists the salons again.
    console.warn("Could not load the salon after sign-in:", err);
  }
}
