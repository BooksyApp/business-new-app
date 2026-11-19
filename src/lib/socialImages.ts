/**
 * Ready-made social images (FG-W1-04's sibling): an Instagram story (1080×1920) or a square post
 * (1080×1080), drawn in the browser from a template, with the salon's name, logo or photo, a QR
 * code and short link to its booking page (tagged `src=social`), and the booqi watermark
 * (logo-dark.svg, the v4.1 mark for dark grounds, bottom-right, no box). No server cost.
 */
import { ensureFont, fitLines, roundRect } from "@/lib/shareKit";
import { CTA, DEFAULTS, PILL, SCAN, SLOTS_LABEL, type SocialLang, type SocialTemplate } from "@/lib/socialCopy";

export type SocialFormat = "story" | "post";

export const SOCIAL_SIZES: Record<SocialFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1080 },
};

const INK = "#1D1730";
const BRAND = "#6F52ED";
const BRAND_STRONG = "#5B3FD6";
const GLOW_TO = "#E83E63";
const GOLD = "#FFC857";
const FONT = '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
const LOGO_RATIO = 467.19 / 200;

/** The salon's page as a customer should reach it from a social post: tagged so booqi counts it. */
export function socialLink(salonUrl: string): string {
  if (!salonUrl) return "";
  return `${salonUrl}${salonUrl.includes("?") ? "&" : "?"}src=social`;
}

/** "11:00, 13:30 15:00" -> the valid HH:MM times, at most six. */
export function parseSlots(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(raw);
    if (!m) continue;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    const t = `${String(h).padStart(2, "0")}:${m[2]}`;
    if (!out.includes(t)) out.push(t);
    if (out.length === 6) break;
  }
  return out;
}

export interface SocialInput {
  template: SocialTemplate;
  format: SocialFormat;
  lang: SocialLang;
  name: string;
  /** Salon logo and/or photo (same-origin or CORS-enabled URLs; a failed load is skipped). */
  logoUrl?: string;
  photoUrl?: string;
  /** The salon page without scheme, for reading: getbooqi.tech/salon/<slug>. */
  shortUrl: string;
  /** What the QR code opens (with ?src=social). */
  qrUrl: string;
  headline: string;
  body: string;
  /** Offer validity, the open times, the price, or the reviewer, depending on the template. */
  extra: string;
  /** Review stars, 1 to 5. */
  stars?: number;
}

/** What the template says when the salon has typed nothing. */
export function defaultsFor(template: SocialTemplate, lang: SocialLang) {
  const d = DEFAULTS[template][lang];
  return { headline: d.headline, body: d.sub, extra: d.extra };
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, photo: HTMLImageElement | null) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  if (photo) {
    drawCover(ctx, photo, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(29,23,48,0.55)");
    g.addColorStop(0.45, "rgba(29,23,48,0.78)");
    g.addColorStop(1, "rgba(29,23,48,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const blob = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(29,23,48,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  blob(w * 0.1, h * 0.05, w * 0.95, "rgba(111,82,237,0.75)");
  blob(w * 1.0, h * 0.5, w * 0.8, "rgba(232,62,99,0.45)");
  blob(w * 0.3, h * 1.02, w * 0.9, "rgba(91,63,214,0.6)");
}

/** Chip rows for the open times: x offsets per row, fixed-height chips, wrapping at `width`. */
function chipRows(ctx: CanvasRenderingContext2D, times: string[], width: number) {
  ctx.font = `700 40px ${FONT}`;
  const rows: { time: string; x: number; w: number }[][] = [[]];
  let x = 0;
  for (const time of times) {
    const w = ctx.measureText(time).width + 72;
    if (x + w > width && rows[rows.length - 1].length) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push({ time, x, w });
    x += w + 18;
  }
  return rows;
}

/** The text wrapped at exactly this size (never shrunk): the caller decides whether the lines fit. */
function wrap(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, width: number): string[] {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const CHIP_H = 84;
const CHIP_GAP = 16;

export async function renderSocial(i: SocialInput): Promise<HTMLCanvasElement> {
  await ensureFont();
  const { w: W, h: H } = SOCIAL_SIZES[i.format];
  const story = i.format === "story";
  const base = import.meta.env.BASE_URL || "/";
  const [photo, logo, mark, QR] = await Promise.all([
    i.photoUrl ? loadImage(i.photoUrl, true) : Promise.resolve(null),
    i.logoUrl ? loadImage(i.logoUrl, true) : Promise.resolve(null),
    loadImage(`${base}brand/logo-dark.svg`, false),
    import("qrcode"),
  ]);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  background(ctx, W, H, photo);
  ctx.textBaseline = "alphabetic";

  const m = 80;
  const inner = W - 2 * m;

  // ---- top: salon logo (round) and name
  let y = story ? 150 : 80;
  let nameX = m;
  if (logo) {
    const d = 96;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(d / logo.width, d / logo.height);
    ctx.drawImage(logo, m + (d - logo.width * s) / 2, y + (d - logo.height * s) / 2, logo.width * s, logo.height * s);
    ctx.restore();
    nameX = m + d + 28;
  }
  ctx.fillStyle = "#FFFFFF";
  const nm = fitLines(ctx, i.name, 700, 46, 30, W - nameX - m, 2);
  const nameBlock = nm.lines.length * nm.size * 1.2;
  const nameTop = y + Math.max(0, (96 - nameBlock) / 2) + nm.size;
  nm.lines.forEach((l, k) => ctx.fillText(l, nameX, nameTop + k * nm.size * 1.2));
  y += 96 + (story ? 110 : 56);

  // ---- bottom block geometry (QR card left, link text right, watermark bottom-right)
  const qs = story ? 250 : 190;
  const qrBlockH = qs + 40;
  const qrY = story ? H - 700 : H - m - qrBlockH + 20;
  const avail = qrY - 50 - y;

  // ---- the pill and the text, shrunk until the whole stack fits above the QR block
  const pillSize = 32;
  const pillH = pillSize * 2.1;
  const times = i.template === "slots" ? parseSlots(i.extra) : [];
  const isReview = i.template === "review";
  const maxHead = story ? 124 : 96;
  const maxLines = story ? 5 : 4;
  let hs = maxHead;
  let headLines: string[] = [];
  let body = { size: 0, lines: [] as string[] };
  let extraH = 0;
  let total = 0;
  for (; hs >= 40; hs -= 4) {
    headLines = wrap(ctx, i.headline, 800, hs, inner);
    const bodySize = Math.min(hs / 2.6 + 4, 44);
    body = i.body.trim() && !isReview ? { size: bodySize, lines: wrap(ctx, i.body, 500, bodySize, inner).slice(0, 3) } : { size: 0, lines: [] };
    const rows = chipRows(ctx, times, inner).length;
    extraH =
      i.template === "slots" ? (times.length ? 56 + rows * (CHIP_H + CHIP_GAP) : 0)
      : isReview ? 150
      : i.extra.trim() ? 120
      : 0;
    total = pillH + 44 + headLines.length * hs * 1.12 + (body.lines.length ? 30 + body.lines.length * body.size * 1.4 : 0) + (extraH ? 40 + extraH : 0);
    if (headLines.length <= maxLines && total <= avail) break;
  }
  const head = { size: Math.max(hs, 40), lines: headLines.slice(0, maxLines + 2) };
  // On a story the stack sits a little lower, so the gap above the QR block is not all at the bottom.
  if (story && total < avail) y += Math.min((avail - total) * 0.35, 150);

  // pill
  const label = PILL[i.template][i.lang].toUpperCase();
  ctx.font = `700 ${pillSize}px ${FONT}`;
  const pw = ctx.measureText(label).width + pillSize * 1.8;
  const pg = ctx.createLinearGradient(m, 0, m + pw, 0);
  pg.addColorStop(0, BRAND);
  pg.addColorStop(1, GLOW_TO);
  ctx.fillStyle = pg;
  roundRect(ctx, m, y, pw, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(label, m + pillSize * 0.9, y + pillH / 2 + 1);
  ctx.textBaseline = "alphabetic";
  y += pillH + 44;

  // headline (a review's headline is the quote)
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 ${head.size}px ${FONT}`;
  head.lines.forEach((l, k) => {
    const text = isReview ? (k === 0 ? "“" + l : l) + (k === head.lines.length - 1 ? "”" : "") : l;
    ctx.fillText(text, m, y + head.size * 0.92 + k * head.size * 1.12);
  });
  y += head.lines.length * head.size * 1.12;

  if (body.lines.length) {
    y += 30;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = `500 ${body.size}px ${FONT}`;
    body.lines.forEach((l, k) => ctx.fillText(l, m, y + body.size + k * body.size * 1.4));
    y += body.lines.length * body.size * 1.4;
  }

  // template block
  if (extraH) {
    y += 40;
    if (i.template === "slots") {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(SLOTS_LABEL[i.lang], m, y + 30);
      let cy = y + 56;
      for (const row of chipRows(ctx, times, inner)) {
        for (const chip of row) {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          roundRect(ctx, m + chip.x, cy, chip.w, CHIP_H, 28);
          ctx.fill();
          ctx.fillStyle = INK;
          ctx.font = `700 40px ${FONT}`;
          ctx.fillText(chip.time, m + chip.x + 36, cy + 56);
        }
        cy += CHIP_H + CHIP_GAP;
      }
    } else if (isReview) {
      const stars = Math.max(1, Math.min(5, Math.round(i.stars ?? 5)));
      ctx.font = `700 56px ${FONT}`;
      ctx.fillStyle = GOLD;
      ctx.fillText("★".repeat(stars), m, y + 56);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `700 40px ${FONT}`;
      if (i.extra.trim()) ctx.fillText(`— ${i.extra.trim()}`, m, y + 120);
    } else {
      const label2 = i.extra.trim();
      const price = i.template === "service";
      const f = fitLines(ctx, label2, 800, price ? 64 : 48, 28, inner - 80, 1);
      ctx.font = `800 ${f.size}px ${FONT}`;
      const bw = Math.min(inner, ctx.measureText(label2).width + 80);
      ctx.fillStyle = price ? "#FFFFFF" : "rgba(255,255,255,0.14)";
      roundRect(ctx, m, y, bw, 100, 32);
      ctx.fill();
      if (!price) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = price ? INK : "#FFFFFF";
      ctx.textBaseline = "middle";
      ctx.fillText(f.lines[0], m + 40, y + 52);
      ctx.textBaseline = "alphabetic";
    }
  }

  // ---- QR card and the link
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, m, qrY, qs + 40, qs + 40, 36);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const qc = document.createElement("canvas");
  await QR.toCanvas(qc, i.qrUrl, { margin: 0, width: qs, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });
  ctx.drawImage(qc, m + 20, qrY + 20, qs, qs);

  const tx = m + qs + 40 + 40;
  const markW = story ? 0 : 140 + 30;   // on a post the watermark shares the bottom row with the link
  const tw = W - tx - m - markW;
  ctx.fillStyle = "#FFFFFF";
  const cta = fitLines(ctx, CTA[i.lang], 800, story ? 54 : 44, 28, tw, 2);
  cta.lines.forEach((l, k) => ctx.fillText(l, tx, qrY + 70 + k * cta.size * 1.15));
  const ctaBottom = qrY + 70 + (cta.lines.length - 1) * cta.size * 1.15;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(SCAN[i.lang], tx, ctaBottom + 52);
  const link = fitLines(ctx, i.shortUrl, 700, 30, 18, tw, 2);
  ctx.fillStyle = "#FFFFFF";
  link.lines.forEach((l, k) => ctx.fillText(l, tx, ctaBottom + 104 + k * link.size * 1.25));

  // ---- watermark: the booqi mark, bottom-right, no box (above the IG interface zone on a story)
  if (mark) {
    const lw = story ? 150 : 140;
    const lh = lw / LOGO_RATIO;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(mark, W - m - lw, story ? H - 330 - lh : H - m - lh + 6, lw, lh);
    ctx.globalAlpha = 1;
  }
  return c;
}

export function downloadSocialPng(c: HTMLCanvasElement, filename: string) {
  return new Promise<void>((resolve, reject) =>
    c.toBlob((b) => {
      if (!b) return reject(new Error("toBlob failed")); // i18n-ignore
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      resolve();
    }, "image/png"),
  );
}
