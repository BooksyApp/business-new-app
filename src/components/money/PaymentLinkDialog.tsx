import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/currency";
import { paymentLinkService } from "@/services/moneyService";
import { t } from "@/i18n";

interface PaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  clientName?: string | null;
  clientPhone?: string | null;
}

/**
 * FG-W6-04: the link and QR a customer pays a booking with on their own phone. The server works
 * the amount out; the salon can send the link over WhatsApp or show the QR at the till.
 */
export function PaymentLinkDialog({ open, onOpenChange, bookingId, clientName, clientPhone }: PaymentLinkDialogProps) {
  const [link, setLink] = useState<{ url: string; amount: number } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    let live = true;
    setBusy(true);
    setLink(null);
    setQr(null);
    paymentLinkService
      .create(bookingId)
      .then(async (l) => {
        if (!live) return;
        setLink({ url: l.url, amount: l.amount });
        const QR = await import("qrcode");
        const data = await QR.toDataURL(l.url, { width: 320, margin: 2, errorCorrectionLevel: "M" });
        if (live) setQr(data);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : t("paymentLink.failed")))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [open, bookingId]);

  const message = link ? t("paymentLink.whatsappText", { amount: formatPrice(link.amount), url: link.url }) : "";
  const phone = (clientPhone || "").replace(/[^0-9]/g, "");
  const whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("paymentLink.title")}</DialogTitle>
          <DialogDescription>
            {clientName ? `${clientName} · ` : ""}
            {link ? formatPrice(link.amount) : t("paymentLink.preparing")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {busy && <p className="text-sm text-muted-foreground">{t("paymentLink.preparing")}</p>}
          {qr && <img src={qr} alt={t("paymentLink.qrAlt")} className="h-56 w-56 rounded-lg border" />}
          {link && (
            <div className="flex w-full flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard
                    .writeText(link.url)
                    .then(() => toast.success(t("paymentLink.copied")))
                    .catch(() => toast.error(t("paymentLink.failed")));
                }}
              >
                {t("paymentLink.copy")}
              </Button>
              <Button asChild>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  {t("paymentLink.sendWhatsapp")}
                </a>
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t("paymentLink.hint")}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
