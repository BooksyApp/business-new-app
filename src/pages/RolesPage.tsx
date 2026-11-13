import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentBusinessId } from "@/config/api";
import { roleService, type BusinessRole, type TeamPermissionInfo } from "@/services/roleService";

type Draft = { id?: number; name: string; description: string; permissions: Set<string>; isDefault: boolean };

/**
 * The salon's roles and what each one can do. Owner only (the server refuses everyone
 * else). Owner is built in and fixed; the rest can be created, changed and deleted —
 * a role somebody still has cannot be deleted.
 */
const RolesPage = () => {
  const businessId = getCurrentBusinessId();
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [catalog, setCatalog] = useState<TeamPermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<BusinessRole | null>(null);

  const load = async () => {
    try {
      const [r, c] = await Promise.all([roleService.list(businessId), roleService.catalog()]);
      setRoles(r);
      setCatalog(c);
    } catch (e) {
      toast.error((e instanceof Error && e.message) || "Could not load roles");
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

  const labelOf = (key: string) => catalog.find((p) => p.key === key)?.label ?? key;

  const openNew = () => setDraft({ name: "", description: "", permissions: new Set(), isDefault: false });
  const openEdit = (r: BusinessRole) =>
    setDraft({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      permissions: new Set(r.permissions),
      isDefault: r.isDefault,
    });

  const toggle = (key: string) => {
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
    if (!draft.name.trim()) return toast.error("Give the role a name");
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
      toast.success(draft.id ? "Role saved" : "Role created");
      setDraft(null);
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || "Could not save the role");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await roleService.remove(businessId, toDelete.id);
      toast.success(`"${toDelete.name}" deleted`);
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || "Could not delete the role");
    } finally {
      setToDelete(null);
    }
  };

  const deleteBlocker = (r: BusinessRole) =>
    r.isOwner
      ? "The Owner role is built in"
      : r.memberCount > 0
        ? `Used by ${r.memberCount} team member${r.memberCount === 1 ? "" : "s"} — give them another role first`
        : r.isDefault
          ? "New team members get this role — make another role the default first"
          : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Roles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              What each person on your team can see and do. Only you, the owner, can change roles.
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> New role
          </Button>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading roles…</p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {roles.map((r) => {
              const blocker = deleteBlocker(r);
              return (
                <div key={r.id} className="rounded-xl border bg-card p-5" data-testid={`role-${r.name}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.isOwner ? <Lock className="h-4 w-4 text-muted-foreground" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
                        <h2 className="text-lg font-semibold">{r.name}</h2>
                        {r.isDefault && <Badge variant="secondary">Default for new members</Badge>}
                      </div>
                      {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {r.memberCount} team member{r.memberCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!r.isOwner && (
                        <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${r.name}`}
                              disabled={!!blocker}
                              onClick={() => setToDelete(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {blocker && <TooltipContent>{blocker}</TooltipContent>}
                      </Tooltip>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {r.isOwner ? (
                      <Badge>Everything, including roles, billing and deleting the salon</Badge>
                    ) : r.permissions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Own calendar only</span>
                    ) : (
                      r.permissions.map((p) => (
                        <Badge key={p} variant="outline">
                          {labelOf(p)}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? `Edit ${draft.name || "role"}` : "New role"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Name</Label>
                  <Input
                    id="role-name"
                    value={draft.name}
                    maxLength={60}
                    placeholder="e.g. Receptionist"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-3 pb-2">
                  <Switch
                    id="role-default"
                    checked={draft.isDefault}
                    onCheckedChange={(v) => setDraft({ ...draft, isDefault: v })}
                  />
                  <Label htmlFor="role-default">Default for new team members</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Textarea
                  id="role-description"
                  rows={2}
                  maxLength={255}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Everyone on the team sees their own calendar and can request time off. Tick what else this role
                  can do.
                </p>
                {groups.map(([group, items]) => {
                  const allOn = items.every((p) => draft.permissions.has(p.key));
                  return (
                    <div key={group} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{group}</h3>
                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => toggleGroup(items, !allOn)}>
                          {allOn ? "Clear all" : "Select all"}
                        </Button>
                      </div>
                      <div className="mt-3 space-y-3">
                        {items.map((p) => (
                          <label key={p.key} className="flex cursor-pointer items-start gap-3">
                            <Checkbox
                              checked={draft.permissions.has(p.key)}
                              onCheckedChange={() => toggle(p.key)}
                              aria-label={p.label}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="block text-sm font-medium">{p.label}</span>
                              <span className="block text-xs text-muted-foreground">{p.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : draft?.id ? "Save role" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Nobody has this role, so nothing else changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default RolesPage;
