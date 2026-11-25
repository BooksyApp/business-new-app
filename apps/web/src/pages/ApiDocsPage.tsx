import { Link, useParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { myAccess } from "@/components/layout/navigation";
import { BooqiScope, EmptyState, PageHeader } from "@/components/page/booqi";
import { pageBody, secondaryBtn } from "@/components/page/booqiStyles";
import { t } from "@/i18n";

const card = "rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]";
const pre = "overflow-x-auto rounded-xl bg-[rgb(var(--reg-ink))] p-4 text-xs leading-relaxed text-white";

const ENDPOINTS: { method: string; path: string; scope: string; label: string }[] = [
  { method: "GET", path: "/services", scope: "read:services", label: "apiDocs.ep.services" },
  { method: "GET", path: "/staff", scope: "read:services", label: "apiDocs.ep.staff" },
  { method: "GET", path: "/bookings", scope: "read:bookings", label: "apiDocs.ep.bookingsList" },
  { method: "POST", path: "/bookings", scope: "write:bookings", label: "apiDocs.ep.bookingsCreate" },
  { method: "GET", path: "/clients", scope: "read:clients", label: "apiDocs.ep.clients" },
];

const VERIFY = `import crypto from "node:crypto";

// rawBody: the request body exactly as received (a string or Buffer)
function isFromBooqi(headers, rawBody, secret) {
  const ts = headers["x-booqi-timestamp"];
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(ts + "." + rawBody).digest("hex");
  const given = headers["x-booqi-signature"] || "";
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected)) &&
    Math.abs(Date.now() / 1000 - Number(ts)) < 300;
}`;

/** Owner: the endpoints, how to sign in with a key, an example and how to check a webhook. */
export default function ApiDocsPage() {
  const { salonKey } = useParams<{ salonKey?: string }>();
  const isOwner = myAccess().isOwner;
  const base = `${window.location.origin}/api/v1/ext`;

  const example = `curl -X POST ${base}/bookings \\
  -H "Authorization: Bearer bqk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": "<service id from GET /services>",
    "staffId": "<team member id from GET /staff>",
    "date": "2026-12-01",
    "startTime": "14:30",
    "clientName": "Aysel Mammadova",
    "clientPhone": "+994501234567",
    "clientEmail": "aysel@example.com",
    "idempotencyKey": "order-1042"
  }'`;

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("apiDocs.title")}
          subtitle={t("apiDocs.subtitle")}
          actions={
            isOwner ? (
              <Link to={`/${salonKey ?? ""}/integrations`} className={`${secondaryBtn} inline-flex items-center`}>
                {t("apiDocs.manageKeys")}
              </Link>
            ) : undefined
          }
        />
        <div className={pageBody}>
          {!isOwner ? (
            <EmptyState icon={KeyRound} title={t("apiDocs.ownerOnly")} />
          ) : (
            <>
              <section className={`${card} space-y-2`}>
                <h2 className="text-lg font-bold">{t("apiDocs.baseUrl")}</h2>
                <pre className={pre}>{base}</pre>
              </section>

              <section className={`${card} space-y-2`}>
                <h2 className="text-lg font-bold">{t("apiDocs.auth")}</h2>
                <p className="text-sm">{t("apiDocs.authBody")}</p>
                <h3 className="pt-2 font-semibold">{t("apiDocs.limits")}</h3>
                <p className="text-sm">{t("apiDocs.limitsBody")}</p>
              </section>

              <section className={`${card} space-y-3`}>
                <h2 className="text-lg font-bold">{t("apiDocs.endpoints")}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="text-xs font-semibold text-[rgb(var(--reg-muted))]">
                      <tr>
                        <th className="py-2 pr-3" />
                        <th className="py-2 pr-3" />
                        <th className="py-2 pr-3" />
                        <th className="py-2">{t("apiDocs.colScope")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENDPOINTS.map((e) => (
                        <tr key={`${e.method} ${e.path}`} className="border-t border-[rgb(var(--reg-line)/0.8)]">
                          <td className="py-2 pr-3 font-mono text-xs font-bold">{e.method}</td>
                          <td className="py-2 pr-3 font-mono text-xs">/api/v1/ext{e.path}</td>
                          <td className="py-2 pr-3">{t(e.label as Parameters<typeof t>[0])}</td>
                          <td className="py-2 font-mono text-xs">{e.scope}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${card} space-y-3`}>
                <h2 className="text-lg font-bold">{t("apiDocs.example")}</h2>
                <pre className={pre}>{example}</pre>
                <p className="text-sm">{t("apiDocs.exampleNote")}</p>
              </section>

              <section className={`${card} space-y-3`}>
                <h2 className="text-lg font-bold">{t("apiDocs.webhooks")}</h2>
                <p className="text-sm">{t("apiDocs.webhooksBody")}</p>
                <h3 className="font-semibold">{t("apiDocs.verify")}</h3>
                <pre className={pre}>{VERIFY}</pre>
              </section>

              <section className={`${card} space-y-2`}>
                <h2 className="text-lg font-bold">{t("apiDocs.errors")}</h2>
                <p className="text-sm">{t("apiDocs.errorsBody")}</p>
              </section>
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
