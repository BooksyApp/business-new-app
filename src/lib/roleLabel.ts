import { t } from "@/i18n";
import type { BusinessRole } from "@/services/roleService";

/**
 * The three roles every salon is seeded with (V116__business_roles.sql). They come from the
 * backend in English, so they are translated here; a role the owner created or renamed keeps
 * its own text. A built-in is recognised by name AND its seeded description.
 */
const DEFAULT_DESC = {
  Manager: "Runs the salon day to day.",
  Staff: "Their own calendar and the till.",
} as const;

type R = Pick<BusinessRole, "name" | "description" | "isOwner">;

export function roleName(r: R): string {
  if (r.isOwner && r.name === "Owner") return t("roles.defaultOwner");
  if (r.name === "Manager" && r.description === DEFAULT_DESC.Manager) return t("roles.defaultManager");
  if (r.name === "Staff" && r.description === DEFAULT_DESC.Staff) return t("roles.defaultStaff");
  return r.name;
}

export function roleDescription(r: R): string | null | undefined {
  if (r.isOwner && r.name === "Owner") return t("roles.defaultOwnerDesc");
  if (r.name === "Manager" && r.description === DEFAULT_DESC.Manager) return t("roles.defaultManagerDesc");
  if (r.name === "Staff" && r.description === DEFAULT_DESC.Staff) return t("roles.defaultStaffDesc");
  return r.description;
}
