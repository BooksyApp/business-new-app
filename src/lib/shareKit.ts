/**
 * The salon's share kit, drawn in the browser (no server cost): an Instagram story (1080×1920)
 * and an A5 desk poster (300 dpi), with the salon's name, its booking link and a QR code that
 * opens the link tagged `src=qr`. Same design as brand/share-kit/v2; the watermark is the v4.1
 * logo-light, no box behind it (brand/watermark-rules.md).
 */

const INK = "#1D1730";
const MUTED = "#6B6158";
const CANVAS = "#FBF7F2";
const LINE = "#E3DACE";
const BRAND = "#6F52ED";
const BRAND_STRONG = "#5B3FD6";
const GLOW_TO = "#E83E63";
const FONT = '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

/** booqi v4.1 logo-light (brand/v4/logo/final/v4.1/for-product/public/brand/logo-light.svg). */
const LOGO_LIGHT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 467.19 200"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="116" y1="0" x2="308" y2="0"><stop offset="0" stop-color="#5B3FD6"/><stop offset="1" stop-color="#E83E63"/></linearGradient></defs><path d="M12 12L12 100M12 100A42 42 0 1 0 96 100A42 42 0 1 0 12 100ZM328 100A42 42 0 1 0 412 100A42 42 0 1 0 328 100ZM412 100L412 188M452 58L452 142" fill="none" stroke="#1D1730" stroke-width="24" stroke-linecap="round"/><path d="M436.81 21.81A15.19 15.19 0 1 0 467.19 21.81A15.19 15.19 0 1 0 436.81 21.81Z" fill="#1D1730"/><path d="M181.32 140.45A42 42 0 0 1 128 100A42 42 0 0 1 212 100A42 42 0 0 0 296 100A42 42 0 0 0 242.68 59.55" fill="none" stroke="url(#g)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LOGO_RATIO = 467.19 / 200;

export type ShareTexts = {
  pill: string;
  posterLead: string;
  posterAccent: string;
  posterScan: string;
  steps: [string, string, string];
  posterFoot: string;
  storyLead: string;
  storyAccent: string;
  storyBody: string;
  storyToday: string;
  storyCta: string;
};

async function ensureFont() {
  if (typeof document === "undefined") return;
  if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }
  try {
    await Promise.all(["500", "700", "800"].map((w) => document.fonts.load(`${w} 40px "Plus Jakarta Sans"`)));
  } catch {
    /* falls back to Inter */
  }
}

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_LIGHT)}`;
  });
}

function mesh(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = CANVAS;
  ctx.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(251,247,242,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  blob(w * 0.05, h * 0.02, w * 0.85, "rgba(216,204,255,0.95)");
  blob(w * 1.02, h * 0.36, w * 0.7, "rgba(255,194,207,0.75)");
  blob(w * 0.45, h * 1.05, w * 0.9, "rgba(255,217,161,0.8)");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function softShadow(ctx: CanvasRenderingContext2D, blur: number, y: number) {
  ctx.shadowColor = "rgba(160,80,50,0.28)";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = y;
}
function noShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Words onto at most `max` lines; the size steps down until the text fits. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, min: number, width: number, max: number) {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= max && lines.every((l) => ctx.measureText(l).width <= width)) return { size, lines };
  }
  ctx.font = `${weight} ${min}px ${FONT}`;
  return { size: min, lines: [text] };
}

function glowFill(ctx: CanvasRenderingContext2D, x: number, width: number) {
  const g = ctx.createLinearGradient(x, 0, x + width, 0);
  g.addColorStop(0, BRAND);
  g.addColorStop(0.35, BRAND_STRONG);
  g.addColorStop(1, GLOW_TO);
  return g;
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alignRight = false) {
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.6;
  const h = size * 2.1;
  const left = alignRight ? x - w : x;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  roundRect(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = BRAND_STRONG;
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + size * 0.8, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

/** A5 at 300 dpi. */
export async function renderPoster(o: { name: string; qrUrl: string; shortUrl: string; texts: ShareTexts }) {
  await ensureFont();
  const [logo, QR] = await Promise.all([loadLogo(), import("qrcode")]);
  const W = 1748;
  const H = 2480;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  mesh(ctx, W, H);
  const m = 130;

  // watermark top-left, 9% of the width
  const lw = Math.round(W * 0.09);
  ctx.drawImage(logo, m, m, lw, lw / LOGO_RATIO);
  pill(ctx, o.texts.pill, W - m, m - 4, 38, true);

  // salon name (two lines at most) and the headline
  ctx.fillStyle = MUTED;
  const name = fitLines(ctx, o.name, 700, 64, 40, W - 2 * m, 2);
  let y = 420;
  for (const l of name.lines) {
    ctx.fillText(l, m, y);
    y += name.size * 1.2;
  }
  y += 40;
  ctx.font = `800 150px ${FONT}`;
  ctx.fillStyle = INK;
  const lead = fitLines(ctx, o.texts.posterLead, 800, 150, 100, W - 2 * m, 1);
  ctx.fillText(lead.lines[0], m, y + 110);
  ctx.font = `800 ${lead.size}px ${FONT}`;
  const aw = ctx.measureText(o.texts.posterAccent).width;
  ctx.fillStyle = glowFill(ctx, m, aw);
  ctx.fillText(o.texts.posterAccent, m, y + 110 + lead.size * 1.02);
  y += 110 + lead.size * 1.02 + 90;

  // QR card
  const cw = 920;
  const cx = (W - cw) / 2;
  const qs = 780;
  const ch = qs + 70 + 150;
  softShadow(ctx, 70, 26);
  ctx.fillStyle = "#fff";
  roundRect(ctx, cx, y, cw, ch, 80);
  ctx.fill();
  noShadow(ctx);
  const qc = document.createElement("canvas");
  await QR.toCanvas(qc, o.qrUrl, { margin: 0, width: qs, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });
  ctx.drawImage(qc, cx + (cw - qs) / 2, y + 70, qs, qs);
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(o.texts.posterScan, W / 2, y + 70 + qs + 95);
  ctx.textAlign = "left";

  // three steps
  const sy = H - 400;
  const gap = 28;
  const sw = (W - 2 * m - 2 * gap) / 3;
  o.texts.steps.forEach((s, i) => {
    const sx = m + i * (sw + gap);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    roundRect(ctx, sx, sy, sw, 190, 46);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(sx + 62, sy + 62, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 32px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), sx + 62, sy + 73);
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    const st = fitLines(ctx, s, 700, 38, 28, sw - 64, 2);
    st.lines.forEach((l, k) => ctx.fillText(l, sx + 32, sy + 135 + k * st.size * 1.15));
  });

  // footer
  ctx.font = `600 34px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(o.texts.posterFoot, m, H - 120);
  ctx.textAlign = "right";
  ctx.fillText(o.shortUrl, W - m, H - 120);
  ctx.textAlign = "left";
  return c;
}

/** Instagram story, 1080×1920. The bottom ~420 px stay calm for the link sticker. */
export async function renderStory(o: { name: string; shortUrl: string; texts: ShareTexts }) {
  await ensureFont();
  const logo = await loadLogo();
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  mesh(ctx, W, H);
  const m = 90;

  pill(ctx, o.texts.pill, m, 150, 30);
  ctx.fillStyle = MUTED;
  const name = fitLines(ctx, o.name, 700, 46, 32, W - 2 * m, 2);
  let y = 330;
  for (const l of name.lines) {
    ctx.fillText(l, m, y);
    y += name.size * 1.2;
  }
  y += 20;
  ctx.fillStyle = INK;
  ctx.font = `800 128px ${FONT}`;
  ctx.fillText(o.texts.storyLead, m, y + 100);
  const acc = fitLines(ctx, o.texts.storyAccent, 800, 128, 84, W - 2 * m, 1);
  ctx.font = `800 ${acc.size}px ${FONT}`;
  ctx.fillStyle = glowFill(ctx, m, ctx.measureText(o.texts.storyAccent).width);
  ctx.fillText(o.texts.storyAccent, m, y + 100 + 128);
  y += 100 + 128 + 70;

  ctx.fillStyle = INK;
  const body = fitLines(ctx, o.texts.storyBody, 500, 40, 30, W - 2 * m, 4);
  ctx.globalAlpha = 0.82;
  body.lines.forEach((l, k) => ctx.fillText(l, m, y + k * body.size * 1.4));
  ctx.globalAlpha = 1;
  y += body.lines.length * body.size * 1.4 + 50;

  // the "free today" moment card
  const pw = W - 2 * m;
  softShadow(ctx, 60, 22);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  roundRect(ctx, m, y, pw, 230, 48);
  ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = MUTED;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(o.texts.storyToday, m + 48, y + 70);
  let cx = m + 48;
  ["11:00", "15:30", "17:00", "18:30"].forEach((time, i) => {
    ctx.font = `700 38px ${FONT}`;
    const tw = ctx.measureText(time).width + 64;
    if (i === 1) {
      ctx.fillStyle = BRAND;
      roundRect(ctx, cx, y + 100, tw, 84, 26);
      ctx.fill();
      ctx.fillStyle = "#fff";
    } else {
      ctx.fillStyle = "#fff";
      roundRect(ctx, cx, y + 100, tw, 84, 26);
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = INK;
    }
    ctx.fillText(time, cx + 32, y + 156);
    cx += tw + 18;
  });
  y += 230 + 70;

  // the call to action, the link, and the watermark (bottom-right, above the IG UI zone)
  ctx.fillStyle = BRAND;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`↓  ${o.texts.storyCta}`, m, y + 40);
  ctx.fillStyle = MUTED;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(o.shortUrl, m, y + 100);
  const lw = 97;
  ctx.drawImage(logo, W - 72 - lw, H - 360 - lw / LOGO_RATIO, lw, lw / LOGO_RATIO);
  return c;
}

function save(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function downloadPng(c: HTMLCanvasElement, filename: string) {
  return new Promise<void>((resolve) =>
    c.toBlob((b) => {
      if (b) save(b, filename);
      resolve();
    }, "image/png"),
  );
}

/** A one-page A5 PDF holding the poster as a JPEG — no PDF library needed. */
export async function downloadA5Pdf(c: HTMLCanvasElement, filename: string) {
  const jpeg = await new Promise<Uint8Array>((resolve, reject) =>
    c.toBlob(async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92), // i18n-ignore
  );
  const enc = new TextEncoder();
  const pw = 419.53; // A5 in points
  const ph = 595.28;
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const objs: (string | Uint8Array)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`],
    [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, "\nendstream"],
    [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`],
  ];
  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (p: string | Uint8Array) => {
    const bytes = typeof p === "string" ? enc.encode(p) : p;
    parts.push(bytes);
    offset += bytes.length;
  };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const xref: number[] = [];
  objs.forEach((o, i) => {
    xref.push(offset);
    push(`${i + 1} 0 obj\n`);
    o.forEach(push);
    push("\nendobj\n");
  });
  const xrefAt = offset;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
  save(new Blob(parts, { type: "application/pdf" }), filename);
}
