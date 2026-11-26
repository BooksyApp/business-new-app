import type { Id } from "@/types/id";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CopyPlus, Lock, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";

import { Btn, Card, Drawer, Field, Note, PageHead, Skeleton, Tag, Toggle } from "@/components/bz";
import { BzPage } from "@/components/bz/p2-page";
import { ActionMenu } from "@/components/page/kit";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getCurrentBusinessId } from "@/config/api";
import { roleService, type BusinessRole, type TeamPermissionInfo } from "@/services/roleService";
import { t } from "@/i18n";

import { permDescription, permGroup, permLabel, roleDescription, roleName } from "@/lib/roleLabel";
type Draft = { id?: Id; name: string; description: string; permissions: Set<string>; isDefault: boolean };

/**
 * The salon's roles and what each one can do, as one matrix: permissions down the side,
 * grouped by area, roles across the top. A switch saves at once. Owner only (the server
 * refuses everyone else). Owner is built in and fixed; a role somebody still has cannot
 * be deleted.
 */
const brandSwitch = "data-[state=checked]:bg-[rgb(var(--reg-brand))]";

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

  const tg = (on: boolean, onClick: () => void, label: string) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? "tg" : "tg off"} style={{ border: 0, padding: 0 }} onClick={onClick} />
  );

  const drawer = draft ? (
    <Drawer
      title={draft.id ? t("roles.edit", { value: draft.name || t("roles.role") }) : t("roles.newRole")}
      sub={t("roles.everyoneOnTheTeamSees")}
      onClose={() => setDraft(null)}
      closeIcon={<X className="ic" />}
      footer={
        <>
          <Btn kind="ol" onClick={() => setDraft(null)}>{t("common.cancel")}</Btn>
          <Btn kind="v" onClick={save} disabled={saving}>
            {saving ? t("common.saving") : draft.id ? t("roles.saveRole") : t("roles.createRole")}
          </Btn>
        </>
      }
    >
      <div className="g1">
        <Field label={t("common.name")} required>
          <input id="role-name" value={draft.name} maxLength={60} placeholder={t("roles.eGReceptionist")} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label={t("common.descriptionOptional")} kind="ta">
          <textarea id="role-description" rows={2} maxLength={255} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <Toggle title={t("roles.defaultForNewTeamMembers")} help={t("roles.invitedPeopleStartWithThis")} checked={draft.isDefault} onChange={(v) => setDraft({ ...draft, isDefault: v })} />
        <Note kind="in">{t("roles.everyoneSeesTheirOwnCalendar")}</Note>
        <div className="mx">
          {groups.map(([group, items]) => {
            const allOn = items.every((p) => draft.permissions.has(p.key));
            return (
              <div key={group} style={{ display: "contents" }}>
                <div className="gh">
                  {permGroup(group)}{" "}
                  <span className="cp" role="button" tabIndex={0} onClick={() => toggleGroup(items, !allOn)}>
                    {allOn ? t("roles.clearAll") : t("roles.selectAll")}
                  </span>
                </div>
                {items.map((p) => (
                  <div key={p.key} className="pr">
                    {tg(draft.permissions.has(p.key), () => toggleDraft(p.key), permLabel(p))}
                    <div className="tx">
                      <b>{permLabel(p)}</b>
                      <span>{permDescription(p)}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Drawer>
  ) : null;

  return (
    <BzPage overlay={drawer}>
      <PageHead
        title={t("roles.roles")}
        sub={t("roles.whatEachPersonOnYour")}
        right={<Btn kind="v" icon={<Plus className="ic" />} onClick={openNew}>{t("roles.newRole")}</Btn>}
      />
      {loading ? (
        <Skeleton />
      ) : (
        <div className="tbx">
          {roles.map((r) => (
            <div key={r.id} className="lr" data-testid={`role-${r.name}`}>
              <span className="mn" style={{ background: "var(--bz-vsoft)", color: "var(--bz-vtext)" }}>
                {r.isOwner ? <Lock className="ic" /> : <ShieldCheck className="ic" />}
              </span>
              <div className="tx">
                <b>{roleName(r)}</b>
                <span>
                  {r.isOwner ? t("roles.everythingIncludingRolesBillingAnd") : roleDescription(r) || (r.permissions.length ? t("roles.ofPermissions", { count: r.permissions.length, count2: catalog.length }) : t("roles.ownCalendarOnly"))}
                </span>
              </div>
              {r.isDefault && <Tag kind="v">{t("roles.default")}</Tag>}
              {!r.isOwner && <Tag>{t("roles.ofPermissions", { count: r.permissions.length, count2: catalog.length })}</Tag>}
              <Tag>{t("roles.memberCount", { count: r.memberCount })}</Tag>
              <span className="acts">{roleMenu(r)}</span>
            </div>
          ))}
        </div>
      )}
      {!loading && (
        <Card style={{ marginTop: 16 }}>
          <div className="space-y-3">
            <p className="text-sm text-[rgb(var(--reg-muted))]">{t("roles.everyoneSeesTheirOwnCalendar")}</p>
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
          </div>
        </Card>
      )}
    </BzPage>
  );
};

export default RolesPage;
