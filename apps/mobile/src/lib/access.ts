import type { Business } from '@/lib/api';

/**
 * What the signed-in person may open in the current salon: the owner, or a team member's role (Business.myPermissions from GET /businesses/{id}).
 * Same table as salon-hub components/layout/navigation.ts PAGE_NEEDS; the server enforces it too, this only hides what would answer 403.
 * null = owner only; a section not listed is open to the whole team.
 */
const NEEDS: Record<string, string[] | null> = {
  sales: ['TILL', 'SALES_VIEW'], reports: ['ANALYTICS'], custom: ['ANALYTICS'], finance: ['MONEY'], payroll: ['MONEY'], expenses: ['MONEY'],
  promotion: null, roles: null, marketing: ['MARKETING'], offers: ['MARKETING'], inventory: ['CATALOG'], suppliers: ['CATALOG'],
  team: ['TEAM'], plan: ['MONEY'], loyaltycards: ['MARKETING'], giftcards: ['MONEY'], resources: ['CATALOG'], texts: ['SETTINGS'], profile: ['SETTINGS'], settings: ['SETTINGS'], hours: ['SETTINGS'], clients: ['CLIENTS_VIEW'],
};

export function canOpen(salon: Business | null | undefined, section: string): boolean {
  const s = salon as (Business & { isOwner?: boolean; myPermissions?: string[] }) | null | undefined;
  if (!s || s.isOwner || !Array.isArray(s.myPermissions)) return true; // owners, and entries from before roles existed
  if (!(section in NEEDS)) return true;
  const need = NEEDS[section];
  return need !== null && need.some((p) => s.myPermissions!.includes(p));
}
