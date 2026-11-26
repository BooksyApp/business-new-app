import type { Id } from "@/types/id";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CopyPlus, Lock, Pencil, Plus, ShieldCheck, Star, Trash2, Users } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBusinessId } from "@/config/api";
import { cn } from "@/lib/utils";
import { roleService, type BusinessRole, type TeamPermissionInfo } from "@/services/roleService";
import { t } from "@/i18n";

import { permDescription, permGroup, permLabel, roleDescription, roleName } from "@/lib/roleLabel";
type Draft = { id?: Id; name: string; description: string; permissions: Set<string>; isDefault: boolean };

const brandSwitch = "data-[state=checked]:bg-[rgb(var(--reg-brand))]";

/**
 * The salon's roles and what each one can do, as one matrix: permissions down the side,
 * grouped by area, roles across the top. A switch saves at once. Owner only (the server
 * refuses everyone else). Owner is built in and fixed; a role somebody still has cannot
 * be deleted.
 */
const RolesPage = () => {
  const businessId = getCurrentBusinessId();
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [catalog, setCatalog] = useState<TeamPermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  // On a phone the matrix is one role at a time.
  const [phoneRoleId, setPhoneRoleId] = useState<Id | null>(null);

  const load = async () => {
    try {
      const [r, c] = await Promise.all([roleService.list(businessId), roleService.catalog()]);
      setRoles(r);
      setCatalog(c);
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("roles.couldNotLoadRoles"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const groups = useMemo(() => {
    const m = new Map<string, TeamPermissionInfo[]>();
    for (const p of catalog) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [catalog]);

  const editable = roles.filter((r) => !r.isOwner);
  const phoneRole = roles.find((r) => r.id === phoneRoleId) ?? editable[0] ?? roles[0];

  const inputOf = (r: BusinessRole, permissions: string[]) => ({
    name: r.name,
    description: r.description ?? undefined,
    permissions,
    isDefault: r.isDefault,
  });

  /** One switch in the matrix: save that role with the permission flipped. */
  const flip = async (r: BusinessRole, key: string, on: boolean) => {
    const next = on ? [...new Set([...r.permissions, key])] : r.permissions.filter((p) => p !== key);
    const id = `${r.id}:${key}`;
    setPending(id);
    setRoles((rs) => rs.map((x) => (x.id === r.id ? { ...x, permissions: next } : x)));
    try {
      await roleService.update(businessId, r.id, inputOf(r, next));
    } catch (e) {
      setRoles((rs) => rs.map((x) => (x.id === r.id ? { ...x, permissions: r.permissions } : x)));
      toast.error((e instanceof Error && e.message) || t("roles.couldNotChangeThat"));
    } finally {
      setPending(null);
    }
  };

  const openNew = () => setDraft({ name: "", description: "", permissions: new Set(), isDefault: false });
  const openEdit = (r: BusinessRole) =>
    setDraft({ id: r.id, name: r.name, description: r.description ?? "", permissions: new Set(r.permissions), isDefault: r.isDefault });
  const duplicate = (r: BusinessRole) =>
    setDraft({ name: `${r.name} copy`, description: r.description ?? "", permissions: new Set(r.permissions), isDefault: false });

  const toggleDraft = (key: string) => {
    if (!draft) return;
    const next = new Set(draft.permissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft({ ...draft, permissions: next });
  };

  const toggleGroup = (items: TeamPermissionInfo[], on: boolean) => {
    if (!draft) return;
    const next = new Set(draft.permissions);
    items.forEach((p) => (on ? next.add(p.key) : next.delete(p.key)));
    setDraft({ ...draft, permissions: next });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error(t("roles.giveTheRoleAName"));
    setSaving(true);
    const input = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      permissions: [...draft.permissions],
      isDefault: draft.isDefault,
    };
    try {
      if (draft.id) await roleService.update(businessId, draft.id, input);
      else await roleService.create(businessId, input);
      toast.success(draft.id ? t("roles.roleSaved") : t("roles.roleCreated"));
      setDraft(null);
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("roles.couldNotSaveTheRole"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: BusinessRole) => {
    if (!confirm(t("roles.deleteNobodyHasThisRole", { name: r.name }))) return;
    try {
      await roleService.remove(businessId, r.id);
      toast.success(t("roles.deleted", { name: r.name }));
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("roles.couldNotDeleteTheRole"));
    }
  };

  const deleteBlocker = (r: BusinessRole) =>
    r.isOwner
      ? t("roles.theOwnerRoleIsBuilt")
      : r.memberCount > 0
        ? t("roles.usedBy", { count: r.memberCount })
        : r.isDefault
          ? t("roles.newTeamMembersGetThis")
          : null;

  const roleMenu = (r: BusinessRole) => {
    const blocker = deleteBlocker(r);
    return (
      <ActionMenu
        label={t("common.moreFor", { name: roleName(r) })}
        actions={[
          ...(r.isOwner ? [] : [{ label: t("roles.editNameDetails"), icon: Pencil, onSelect: () => openEdit(r) }]),
          { label: t("common.duplicate"), icon: CopyPlus, onSelect: () => duplicate(r) },
          ...(r.isOwner ? [] : [{ label: blocker ? t("roles.canTDeleteInUse") : t("roles.deleteRole"), icon: Trash2, danger: !blocker, disabled: !!blocker, onSelect: () => void remove(r) }]),
        ]}
      />
    );
  };

  const cell = (r: BusinessRole, p: TeamPermissionInfo) =>
    r.isOwner ? (
      <Lock size={15} className="mx-auto text-[rgb(var(--reg-ink)/0.35)]" aria-label={t("roles.alwaysAllowed", { name: roleName(r) })} />
    ) : (
      <Switch
        checked={r.permissions.includes(p.key)}
        disabled={pending === `${r.id}:${p.key}`}
        onCheckedChange={(v) => void flip(r, p.key, v)}
        aria-label={`${roleName(r)}: ${permLabel(p)}`}
        className={brandSwitch}
      />
    );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("roles.roles")}
          subtitle={t("roles.whatEachPersonOnYour")}
          actions={
            <Button className={primaryBtn} onClick={openNew}>
              <Plus size={16} />{" "}{t("roles.newRole")}
            </Button>
          }
        />

        <div className={pageBody}>
          {loading ? (
            <div className="h-72 animate-pulse rounded-[20px] bg-white ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)]" aria-busy />
          ) : (
            <>
              {/* Role summary cards */}
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {roles.map((r) => (
                  <li key={r.id} data-testid={`role-${r.name}`} className="flex items-start gap-3 rounded-[20px] bg-white p-4 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)]">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", r.isOwner ? "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.7)]" : "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]")}>
                      {r.isOwner ? <Lock size={18} /> : <ShieldCheck size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold">{roleName(r)}</span>
                        {r.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-inset ring-amber-200">
                            <Star size={10} />{" "}{t("roles.default")}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-[rgb(var(--reg-muted))]">
                        {r.isOwner ? t("roles.everythingIncludingRolesBillingAnd") : roleDescription(r) || (r.permissions.length ? t("roles.ofPermissions", { count: r.permissions.length, count2: catalog.length }) : t("roles.ownCalendarOnly"))}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[rgb(var(--reg-ink)/0.7)]">
                        <Users size={12} /> {t("roles.memberCount", { count: r.memberCount })}
                      </p>
                    </div>
                    {roleMenu(r)}
                  </li>
                ))}
              </ul>

              <p className="text-sm text-[rgb(var(--reg-muted))]">
                {t("roles.everyoneSeesTheirOwnCalendar")}
              </p>

              {/* Desktop: the matrix */}
              <div className="hidden overflow-x-auto rounded-[20px] bg-white ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)] md:block">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--reg-line)/0.8)]">
                      <th scope="col" className="sticky left-0 bg-white px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("roles.permission")}</th>
                      {roles.map((r) => (
                        <th key={r.id} scope="col" className="w-[120px] px-3 py-3.5 text-center text-sm font-bold">{roleName(r)}</th>
                      ))}
                    </tr>
                  </thead>
                  {groups.map(([group, items]) => (
                    <tbody key={group}>
                      <tr>
                        <th colSpan={roles.length + 1} scope="colgroup" className="bg-[rgb(var(--reg-canvas))] px-5 py-2 text-left text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-ink)/0.7)]">
                          {permGroup(group)}
                        </th>
                      </tr>
                      {items.map((p) => (
                        <tr key={p.key} className="border-t border-[rgb(var(--reg-line)/0.5)]">
                          <th scope="row" className="px-5 py-3 text-left font-normal">
                            <span className="block font-semibold">{permLabel(p)}</span>
                            <span className="block text-xs text-[rgb(var(--reg-muted))]">{permDescription(p)}</span>
                          </th>
                          {roles.map((r) => (
                            <td key={r.id} className="px-3 py-3 text-center">{cell(r, p)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>

              {/* Phone: one role at a time */}
              <div className="space-y-3 md:hidden">
                <div role="tablist" aria-label={t("common.role")} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {roles.map((r) => {
                    const on = phoneRole?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setPhoneRoleId(r.id)}
                        className={cn("h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold", on ? "bg-[rgb(var(--reg-ink))] text-white" : "bg-white ring-1 ring-inset ring-[rgb(var(--reg-line))]")}
                      >
                        {roleName(r)}
                      </button>
                    );
                  })}
                </div>
                {phoneRole &&
                  groups.map(([group, items]) => (
                    <section key={group} className="overflow-hidden rounded-[20px] bg-white ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)]">
                      <h3 className="bg-[rgb(var(--reg-canvas))] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-ink)/0.7)]">{permGroup(group)}</h3>
                      <ul>
                        {items.map((p, i) => (
                          <li key={p.key} className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-[rgb(var(--reg-line)/0.5)]")}>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{permLabel(p)}</span>
                              <span className="block text-xs text-[rgb(var(--reg-muted))]">{permDescription(p)}</span>
                            </span>
                            {cell(phoneRole, p)}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            </>
          )}
        </div>

        <FormSheet
          open={!!draft}
          onOpenChange={(o) => !o && setDraft(null)}
          title={draft?.id ? t("roles.edit", { value: draft.name || t("roles.role") }) : t("roles.newRole")}
          description={t("roles.everyoneOnTheTeamSees")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} onClick={save} disabled={saving}>
                {saving ? t("common.saving") : draft?.id ? t("roles.saveRole") : t("roles.createRole")}
              </Button>
            </>
          }
        >
          {draft && (
            <>
              <Field label={t("common.name")} htmlFor="role-name">
                <input id="role-name" className={fieldCls} value={draft.name} maxLength={60} placeholder={t("roles.eGReceptionist")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label={t("common.descriptionOptional")} htmlFor="role-description">
                <Textarea id="role-description" rows={2} maxLength={255} className="rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <label htmlFor="role-default" className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <span>
                  <span className="block text-sm font-semibold">{t("roles.defaultForNewTeamMembers")}</span>
                  <span className="block text-xs text-[rgb(var(--reg-muted))]">{t("roles.invitedPeopleStartWithThis")}</span>
                </span>
                <Switch id="role-default" checked={draft.isDefault} onCheckedChange={(v) => setDraft({ ...draft, isDefault: v })} className={brandSwitch} />
              </label>
              {groups.map(([group, items]) => {
                const allOn = items.every((p) => draft.permissions.has(p.key));
                return (
                  <section key={group} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center justify-between bg-[rgb(var(--reg-canvas)/0.6)] px-4 py-2.5">
                      <h3 className="text-sm font-extrabold">{permGroup(group)}</h3>
                      <button type="button" className="text-xs font-bold text-[rgb(var(--reg-brand-strong))] hover:underline" onClick={() => toggleGroup(items, !allOn)}>
                        {allOn ? t("roles.clearAll") : t("roles.selectAll")}
                      </button>
                    </div>
                    <ul>
                      {items.map((p) => (
                        <li key={p.key} className="flex items-center gap-3 border-t border-[rgb(var(--reg-line)/0.5)] px-4 py-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{permLabel(p)}</span>
                            <span className="block text-xs text-[rgb(var(--reg-muted))]">{permDescription(p)}</span>
                          </span>
                          <Switch checked={draft.permissions.has(p.key)} onCheckedChange={() => toggleDraft(p.key)} aria-label={permLabel(p)} className={brandSwitch} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
};

export default RolesPage;
