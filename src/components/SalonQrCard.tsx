import { useEffect, useState } from "react";
import { Download, QrCode } from "lucide-react";

import { salonShareUrl } from "@/config/api";
import { t } from "@/i18n";

/**
 * R02: the salon's QR code for print (window, mirror, cards). It encodes the salon page tagged
 * ?src=qr, so the bookings it brings are counted as the salon's own. The qrcode library is
 * loaded only when this card renders, not with the rest of the hub.
 */
export function SalonQrCard({ salonUrl, salonName }: { salonUrl: string; salonName?: string }) {
  const qrUrl = salonUrl ? salonShareUrl(salonUrl, "qr") : "";
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!qrUrl) return;
    let live = true;
    setFailed(false);
    import("qrcode")
      .then((QR) => QR.toDataURL(qrUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" }))
      .then((data) => live && setPreview(data))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [qrUrl]);

  const download = async () => {
    try {
      const QR = await import("qrcode");
      // 1024 px with a quiet zone: sharp on an A5/A4 print.
      const data = await QR.toDataURL(qrUrl, { width: 1024, margin: 4, errorCorrectionLevel: "M" });
      const a = document.createElement("a");
      a.href = data;
      const slug = (salonName || "salon").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salon";
      a.download = `booqi-qr-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setFailed(true);
    }
  };

  if (!qrUrl) return null;

  return (
    <section className="flex flex-col gap-4 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] sm:flex-row sm:items-center md:p-6">
      <div className="mx-auto flex h-40 w-40 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] sm:mx-0">
        {preview ? (
          <img src={preview} alt={t("business.qrAlt")} className="h-36 w-36" />
        ) : (
          <QrCode size={40} className={failed ? "text-rose-400" : "animate-pulse text-[rgb(var(--reg-muted))]"} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("business.qrTitle")}</p>
        <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{failed ? t("business.qrFailed") : t("business.qrHint")}</p>
        <button
          type="button"
          onClick={download}
          disabled={!preview}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--reg-ink))] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Download size={15} aria-hidden /> {t("business.qrDownload")}
        </button>
      </div>
    </section>
  );
}
