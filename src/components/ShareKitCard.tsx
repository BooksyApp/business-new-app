import { useState } from "react";
import { Download, FileText, Image as ImageIcon } from "lucide-react";

import { salonShareUrl } from "@/config/api";
import { t } from "@/i18n";
import type { ShareTexts } from "@/lib/shareKit";

/** Set once the owner has taken their link out into the world (the setup guide's last step). */
export const shareDoneKey = (id: string) => `share-kit-done:${id}`;

/**
 * "Share your link": an Instagram story and an A5 desk poster with this salon's name, link and
 * QR code, drawn in the browser on demand (the generator is loaded only when a button is pressed).
 */
export function ShareKitCard({ salonUrl, salonName, businessId }: { salonUrl: string; salonName: string; businessId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const shortUrl = salonUrl.replace(/^https?:\/\//, "");
  const texts: ShareTexts = {
    pill: t("shareKit.pill"),
    posterLead: t("shareKit.posterLead"),
    posterAccent: t("shareKit.posterAccent"),
    posterScan: t("shareKit.posterScan"),
    steps: [t("shareKit.step1"), t("shareKit.step2"), t("shareKit.step3")],
    posterFoot: t("shareKit.posterFoot"),
    storyLead: t("shareKit.storyLead"),
    storyAccent: t("shareKit.storyAccent"),
    storyBody: t("shareKit.storyBody", { name: salonName }),
    storyToday: t("shareKit.storyToday"),
    storyCta: t("shareKit.storyCta"),
  };
  const slug = salonName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "salon";

  const run = (kind: "story" | "png" | "pdf") => async () => {
    if (!salonUrl || busy) return;
    setBusy(kind);
    try {
      const kit = await import("@/lib/shareKit");
      if (kind === "story") {
        await kit.downloadPng(await kit.renderStory({ name: salonName, shortUrl, texts }), `booqi-story-${slug}.png`);
      } else {
        const poster = await kit.renderPoster({ name: salonName, qrUrl: salonShareUrl(salonUrl, "qr"), shortUrl, texts });
        if (kind === "png") await kit.downloadPng(poster, `booqi-poster-a5-${slug}.png`);
        else await kit.downloadA5Pdf(poster, `booqi-poster-a5-${slug}.pdf`);
      }
      try {
        localStorage.setItem(shareDoneKey(businessId), "1");
      } catch {
        /* private mode */
      }
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[rgb(var(--reg-line))] transition hover:bg-[rgb(var(--reg-canvas))] disabled:opacity-50";
  return (
    <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
      <h3 className="text-base font-bold">{t("shareKit.title")}</h3>
      <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{t("shareKit.body")}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={!salonUrl || !!busy} onClick={run("story")} className={btn}>
          <ImageIcon size={16} aria-hidden />
          {busy === "story" ? t("shareKit.preparing") : t("shareKit.story")}
        </button>
        <button type="button" disabled={!salonUrl || !!busy} onClick={run("png")} className={btn}>
          <Download size={16} aria-hidden />
          {busy === "png" ? t("shareKit.preparing") : t("shareKit.posterPng")}
        </button>
        <button type="button" disabled={!salonUrl || !!busy} onClick={run("pdf")} className={btn}>
          <FileText size={16} aria-hidden />
          {busy === "pdf" ? t("shareKit.preparing") : t("shareKit.posterPdf")}
        </button>
      </div>
    </section>
  );
}
