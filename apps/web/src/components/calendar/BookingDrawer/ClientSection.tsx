import { Check, ChevronDown, Mail, Phone, User } from "lucide-react";
import { Avatar } from "@/components/bz";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { t as tr } from "@/i18n";
import { AF, Sec } from "./AF";
import type { BookingDrawerProps } from "./types";

type P = Pick<BookingDrawerProps, "form" | "setForm" | "clients" | "clientSearchOpen" | "setClientSearchOpen" | "initialsOf">;

/** 1 Müştəri: combobox field (search / pick / new) + manual name, phone, email while no client is picked. */
export function ClientSection({ form, setForm, clients, clientSearchOpen, setClientSearchOpen, initialsOf }: P) {
  const selected = form.clientId ? clients.find((c) => c.id.toString() === form.clientId) : undefined;
  const label = form.clientId
    ? selected
      ? `${selected.firstName} ${selected.lastName || ""}`.trim()
      : tr("calendar.selectClient")
    : form.clientName || "";
  return (
    <>
      <Sec n={1} hint={tr("calendar.optionalEmptyWalkIn")}>
        {tr("common.client")}
      </Sec>
      <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
        <PopoverTrigger asChild>
          <button type="button" role="combobox" aria-expanded={clientSearchOpen} className="af af-btn">
            <div className="fld">
              <div>
                <small>{tr("common.client")}</small>
                <b className={label ? undefined : "ph"}>{label || tr("calendar.searchClientsOrAddNew")}</b>
              </div>
              <ChevronDown className="ic" aria-hidden />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-2xl p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput placeholder={tr("calendar.searchClients")} />
            <CommandList>
              <CommandEmpty>{tr("calendar.noClientFound")}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="new-client"
                  onSelect={() => {
                    setForm((prev) => ({ ...prev, clientId: "", clientName: "", clientPhone: "", clientEmail: "" }));
                    setClientSearchOpen(false);
                  }}
                >
                  <User className="mr-2 h-4 w-4" />
                  {tr("calendar.newClientEnterManually")}
                </CommandItem>
                {clients.map((client, idx) => {
                  const isSelected = form.clientId === client.id.toString();
                  const full = `${client.firstName} ${client.lastName || ""}`.trim();
                  return (
                    <CommandItem
                      // Clients built from walk-in bookings come back with id 0, so the id alone repeats.
                      key={`${client.id}-${idx}`}
                      value={`${client.firstName} ${client.lastName || ""} ${client.email || ""} ${client.phone || ""}`}
                      onSelect={() => {
                        setForm((prev) => ({
                          ...prev,
                          clientId: client.id.toString(),
                          clientName: full,
                          clientPhone: client.phone || "",
                          clientEmail: client.email || "",
                        }));
                        setClientSearchOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="row gap12" style={{ minWidth: 0 }}>
                        <Avatar initials={initialsOf(full)} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <b style={{ display: "block", fontSize: 15 }}>{full}</b>
                          {client.email || client.phone ? <span className="sm t-m b7">{client.email || client.phone}</span> : null}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!form.clientId && (
        <>
          <AF label={tr("common.name")}>
            <input placeholder={tr("calendar.clientName")} value={form.clientName} onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))} />
          </AF>
          <div className="a-g2">
            <AF label={tr("common.phone")} icon={<Phone className="ic" aria-hidden />}>
              <input placeholder={tr("common.phone")} value={form.clientPhone} onChange={(e) => setForm((prev) => ({ ...prev, clientPhone: e.target.value }))} />
            </AF>
            <AF label={tr("common.email")} icon={<Mail className="ic" aria-hidden />}>
              <input type="email" placeholder={tr("common.email")} value={form.clientEmail} onChange={(e) => setForm((prev) => ({ ...prev, clientEmail: e.target.value }))} />
            </AF>
          </div>
        </>
      )}
    </>
  );
}
