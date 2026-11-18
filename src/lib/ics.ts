/**
 * Minimal ICS (RFC 5545) reader for FG-W2-03: one row per VEVENT. The table has a header row so the
 * import dialog maps it like a CSV. Times are read in the salon's zone when the value is UTC (Z);
 * a floating or TZID time is taken as written.
 */
export const ICS_HEADER = ["date", "start", "end", "staff", "service", "client", "note"];

function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function localParts(value: string, zone: string): { date: string; time: string } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return { date, time: "" };
  if (!m[7]) return { date, time: `${m[4]}:${m[5]}` };
  const instant = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  return { date: `${p("year")}-${p("month")}-${p("day")}`, time: `${p("hour")}:${p("minute")}` };
}

export function parseIcs(text: string, zone: string): string[][] {
  const rows: string[][] = [ICS_HEADER];
  let ev: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      ev = {};
    } else if (line === "END:VEVENT") {
      const start = ev ? localParts(ev.DTSTART ?? "", zone) : null;
      const end = ev ? localParts(ev.DTEND ?? "", zone) : null;
      if (ev && start && start.time) {
        rows.push([start.date, start.time, end?.time ?? "", "", ev.SUMMARY ?? "", ev.CLIENT ?? "", ev.DESCRIPTION ?? ""]);
      }
      ev = null;
    } else if (ev) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const head = line.slice(0, i);
      const value = line.slice(i + 1);
      const name = head.split(";")[0].toUpperCase();
      if (name === "DTSTART" || name === "DTEND") ev[name] = value;
      else if (name === "SUMMARY" || name === "DESCRIPTION") ev[name] = unescapeText(value);
      else if (name === "ATTENDEE" && !ev.CLIENT) {
        const cn = /CN=([^;:]+)/i.exec(head);
        if (cn) ev.CLIENT = unescapeText(cn[1].replace(/^"|"$/g, ""));
      }
    }
  }
  return rows;
}
