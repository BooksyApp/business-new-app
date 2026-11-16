import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentBusinessId } from "@/config/api";
import { myAccess } from "@/components/layout/navigation";
import { roleService, type BusinessRole } from "@/services/roleService";
import { t } from "@/i18n";
import { roleDescription, roleName } from "@/lib/roleLabel";
import { salonPath } from "@/lib/salonKey";

interface Props {
  /** The team member being edited; omitted on Add Staff. */
  staffId?: number;
  /** Selected role id, as a string ("" = none chosen yet). */
  value: string;
  onChange: (roleId: string) => void;
}

/**
 * The salon's roles, for Add / Edit Staff. Only the owner assigns roles (the server
 * enforces it), so others see the role read-only. The built-in Owner role is the
 * salon's creator and is not offered for anyone else.
 */
export function RoleSelect({ staffId, value, onChange }: Props) {
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const isOwner = myAccess().isOwner;

  useEffect(() => {
    roleService
      .list(getCurrentBusinessId())
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [staffId]);

  // Pre-select the member's current role (or the default one for someone new). Runs
  // again when the form resets its value — the page loads the member after the roles.
  useEffect(() => {
    if (value || roles.length === 0) return;
    const current = staffId ? roles.find((r) => r.memberIds.includes(staffId)) : undefined;
    const pick = current ?? roles.find((r) => r.isDefault);
    if (pick) onChange(String(pick.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, value, staffId]);

  const selected = roles.find((r) => String(r.id) === value);
  const offered = roles.filter((r) => !r.isOwner || String(r.id) === value);

  return (
    <div className="space-y-2">
      <Label htmlFor="permission-level">{t("common.role")}</Label>
      <Select value={value} onValueChange={onChange} disabled={!isOwner || selected?.isOwner}>
        <SelectTrigger id="permission-level">
          <SelectValue placeholder={t("staff.selectARole")} />
        </SelectTrigger>
        <SelectContent>
          {offered.map((r) => (
            <SelectItem key={r.id} value={String(r.id)}>
              {roleName(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {selected && roleDescription(selected) ? `${roleDescription(selected)} ` : ""}
        {isOwner ? (
          <Link to={salonPath(getCurrentBusinessId(), "roles")} className="font-medium text-primary">
            {t("staff.manageRoles")}
          </Link>
        ) : (
          t("staff.onlyTheOwnerCanChange")
        )}
      </p>
    </div>
  );
}
