import { ASection } from "@/components/biz/a-Section";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t as tr } from "@/i18n";
import { waitlistService } from "@/services/waitlistService";

type Part = "MORNING" | "AFTERNOON" | "EVENING";

/** The salon puts a client on its own waiting list (a phone call, a walk-in). */
export function WaitlistAddDialog({
  open,
  onOpenChange,
  businessId,
  date,
  services,
  masters,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  date: string;
  services: { id: string; name: string }[];
  masters: { id: string; name: string }[];
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [masterId, setMasterId] = useState("");
  const [from, setFrom] = useState(date);
  const [until, setUntil] = useState("");
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (p: Part) => setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const chosenService = serviceId || services[0]?.id || "";

  const save = async () => {
    if (busy || !name.trim() || !chosenService || !from) return;
    setBusy(true);
    try {
      await waitlistService.add(businessId, {
        serviceId: chosenService,
        staffId: masterId || undefined,
        clientName: name.trim(),
        clientPhone: phone.trim() || undefined,
        clientEmail: email.trim() || undefined,
        preferredDate: from,
        preferredEndDate: until && until > from ? until : undefined,
        timeOfDay: parts.length > 0 && parts.length < 3 ? parts : undefined,
      });
      toast.success(tr("waitlistCal.addDone"));
      setName("");
      setPhone("");
      setEmail("");
      setParts([]);
      setUntil("");
      onAdded();
      onOpenChange(false);
    } catch {
      toast.error(tr("waitlistCal.addFailed"));
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
      active ? "bg-[rgb(var(--reg-brand-soft))] ring-[rgb(var(--reg-brand)/0.5)]" : "bg-white ring-[rgb(var(--reg-line))]"
    }`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setFrom(date);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{tr("waitlistCal.addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <ASection>
          <label className="block font-medium">
            {tr("waitlistCal.addName")}
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-medium">
              {tr("waitlistCal.addPhone")}
              <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </label>
            <label className="block font-medium">
              {tr("waitlistCal.addMaster")}
              <select className={field} value={masterId} onChange={(e) => setMasterId(e.target.value)}>
                <option value="">{tr("waitlistCal.anyMaster")}</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block font-medium">
            {tr("waitlistCal.addEmail")}
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          </ASection>
          <ASection>
          <label className="block font-medium">
            {tr("waitlistCal.addService")}
            <select className={field} value={chosenService} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-medium">
              {tr("waitlistCal.addFrom")}
              <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block font-medium">
              {tr("waitlistCal.addTo")}
              <input type="date" className={field} min={from} value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
          </div>
          <div>
            <p className="font-medium">{tr("waitlistCal.addWhen")}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" className={chip(parts.length === 0)} onClick={() => setParts([])}>
                {tr("waitlistCal.addAny")}
              </button>
              {(["MORNING", "AFTERNOON", "EVENING"] as const).map((p) => (
                <button type="button" key={p} className={chip(parts.includes(p))} onClick={() => toggle(p)}>
                  {tr(p === "MORNING" ? "waitlistCal.addMorning" : p === "AFTERNOON" ? "waitlistCal.addAfternoon" : "waitlistCal.addEvening")}
                </button>
              ))}
            </div>
          </div>
          </ASection>
          <Button variant="brand" className="w-full rounded-full" onClick={save} disabled={busy || !name.trim() || !chosenService}>
            {tr("waitlistCal.addSave")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
