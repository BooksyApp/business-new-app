import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicSiteUrl, salonShareUrl } from "@/config/api";
import { t as tr } from "@/i18n";
import { businessService } from "@/services/businessService";
import type { Id } from "@/types/id";

/**
 * Instagram / Facebook "Book" button: the salon's booking link tagged ?src=instagram or
 * ?src=facebook (booqi-web counts both as the salon's own link), with copy and a short how-to.
 */
export function BookingLinkCard({ businessId }: { businessId: Id }) {
  const [base, setBase] = useState("");

  useEffect(() => {
    businessService
      .getBusiness(businessId)
      .then((b) => setBase(`${publicSiteUrl()}/salon/${b.slug ?? b.id}`))
      .catch(() => setBase(""));
  }, [businessId]);

  if (!base) return null;
  const rows: { key: "instagram" | "facebook"; label: string }[] = [
    { key: "instagram", label: tr("bookButton.instagram") },
    { key: "facebook", label: tr("bookButton.facebook") },
  ];
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(tr("bookButton.copied"));
    } catch {
      toast.error(url);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <div>
        <p className="text-sm font-semibold">{tr("bookButton.title")}</p>
        <p className="text-xs text-muted-foreground">{tr("bookButton.hint")}</p>
      </div>
      {rows.map((r) => {
        const url = salonShareUrl(base, r.key);
        return (
          <div key={r.key} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{r.label}</p>
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full truncate rounded-lg border bg-transparent px-2 py-1.5 text-xs" />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(url)}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              {tr("bookButton.copy")}
            </Button>
          </div>
        );
      })}
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>{tr("bookButton.step1")}</li>
        <li>{tr("bookButton.step2")}</li>
        <li>{tr("bookButton.step3")}</li>
      </ol>
    </div>
  );
}
