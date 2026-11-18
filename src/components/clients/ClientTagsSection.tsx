import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { t } from "@/i18n";
import { clientTagService, type ClientCrm, type ClientTag } from "@/services/clientTagService";
import type { Id } from "@/types/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { primaryBtn } from "@/components/page/booqiStyles";
import { cn } from "@/lib/utils";

/** FG-W2-05 / FG-W2-06: the salon's tags on one client, and its block with a reason. */
export function ClientTagsSection({ businessId, clientId, labelClass, boxClass }: {
  businessId: Id;
  clientId: Id;
  labelClass: string;
  boxClass: string;
}) {
  const [crm, setCrm] = useState<ClientCrm | null>(null);
  const [allTags, setAllTags] = useState<ClientTag[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [selected, setSelected] = useState<Id[]>([]);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState("#7c8cf8");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([clientTagService.clientCrm(businessId, clientId), clientTagService.tags(businessId)])
      .then(([c, tags]) => {
        setCrm(c);
        setAllTags(tags);
      })
      .catch(() => undefined);

  useEffect(() => {
    setCrm(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, clientId]);

  const openManage = () => {
    setSelected(crm?.tags.map((x) => x.id) ?? []);
    setManageOpen(true);
  };

  const toggle = (id: Id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const saveTags = async () => {
    setBusy(true);
    try {
      setCrm(await clientTagService.setClientTags(businessId, clientId, selected));
      setManageOpen(false);
    } catch {
      toast.error(t("clients.tagSaveError"));
    } finally {
      setBusy(false);
    }
  };

  const addTag = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await clientTagService.createTag(businessId, { name: newName.trim(), colour: newColour });
      setNewName("");
      setAllTags(await clientTagService.tags(businessId));
    } catch {
      toast.error(t("clients.tagCreateError"));
    } finally {
      setBusy(false);
    }
  };

  const removeTag = async (tagId: Id) => {
    setBusy(true);
    try {
      await clientTagService.deleteTag(businessId, tagId);
      setSelected((cur) => cur.filter((x) => x !== tagId));
      await load();
    } catch {
      toast.error(t("clients.tagSaveError"));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      setCrm(await clientTagService.block(businessId, clientId, reason.trim()));
      setReason("");
      setBlockOpen(false);
    } catch {
      toast.error(t("clients.blockSaveError"));
    } finally {
      setBusy(false);
    }
  };

  const unblock = async () => {
    setBusy(true);
    try {
      setCrm(await clientTagService.unblock(businessId, clientId));
    } catch {
      toast.error(t("clients.blockSaveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn(boxClass, "space-y-3")}>
      <div className="flex items-center justify-between gap-2">
        <p className={labelClass}>{t("clients.tagsTitle")}</p>
        <Button variant="outline" size="sm" onClick={openManage} disabled={!crm}>
          {t("clients.manageTags")}
        </Button>
      </div>

      {crm && crm.tags.length === 0 && <p className="text-sm text-[rgb(var(--reg-muted))]">{t("clients.noTagsYet")}</p>}
      {crm && crm.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {crm.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: tag.colour }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--reg-line))] pt-3">
        {crm?.blocked ? (
          <>
            <div className="min-w-0">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-900">
                {t("clients.blockedBadge")}
              </span>
              <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{t("clients.blockedFromOnline")}</p>
              {crm.blockReason && <p className="mt-0.5 whitespace-pre-wrap text-sm">{crm.blockReason}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => void unblock()} disabled={busy}>
              {t("clients.unblockButton")}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setBlockOpen(true)} disabled={!crm}>
            {t("clients.blockButton")}
          </Button>
        )}
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("clients.tagsDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className={labelClass}>{t("clients.tagsOnClient")}</p>
              {allTags.length === 0 && <p className="text-sm text-[rgb(var(--reg-muted))]">{t("clients.noTagsYet")}</p>}
              {allTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between gap-2">
                  <label className="flex min-w-0 items-center gap-2 text-sm">
                    <input type="checkbox" checked={selected.includes(tag.id)} onChange={() => toggle(tag.id)} />
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.colour }} />
                    <span className="truncate">{tag.name}</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("clients.deleteTag")}
                    onClick={() => void removeTag(tag.id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-[rgb(var(--reg-line))] pt-3">
              <p className={labelClass}>{t("clients.addTag")}</p>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  maxLength={40}
                  placeholder={t("clients.tagName")}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  type="color"
                  aria-label={t("clients.tagColour")}
                  value={newColour}
                  onChange={(e) => setNewColour(e.target.value)}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-[rgb(var(--reg-line))]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => void addTag()} disabled={busy || !newName.trim()}>
                {t("clients.addTag")}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button className={primaryBtn} onClick={() => void saveTags()} disabled={busy}>
              {t("clients.saveTags")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clients.blockDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className={labelClass}>{t("clients.blockReason")}</p>
            <Textarea
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-[rgb(var(--reg-muted))]">{t("clients.blockReasonHint")}</p>
          </div>
          <DialogFooter>
            <Button className={primaryBtn} onClick={() => void block()} disabled={busy || !reason.trim()}>
              {t("clients.blockConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
