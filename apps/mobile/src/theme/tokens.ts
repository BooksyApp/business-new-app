// Final v2 tokens, ported literally from artifacts/app-redesign-final-v2/index.html (:root + .dk)
export const light = {
  canvas: '#fbf7f2', ink: '#1d1730', violet: '#6f52ed', guava: '#e83e63', lilac: '#d8ccff', blush: '#ffc2cf',
  muted: '#6b6158', ink3: '#8c8177', line: '#e9e4df', white: '#ffffff', surface: '#ffffff', fill: '#f4efe8', fill2: '#e9e2d8',
  vsoft: '#f3f0ff', vtext: '#5b3fd6', vstrong: '#5b3fd6', gsoft: '#fff1f3', gink: '#c4294f', ok: '#12704b', oksoft: '#e8f5ee', star: '#f5a623',
  /** v2 (business-mobile-v2 artifact): hairline .08 ink, ring track, mute day digits */
  hair: 'rgba(29,23,48,.08)', track: '#efe9e1', faint: '#c9c0b5',
  tabBg: 'rgba(251,247,242,.94)', tabText: '#6b6158', dark: false,
};
export const dark: typeof light = {
  ...light, canvas: '#14111d', ink: '#f5f2fa', muted: '#bdb4aa', ink3: '#8f857b', line: '#332d40', surface: '#1f1b2b', fill: '#2a2538', fill2: '#342e44',
  hair: 'rgba(255,255,255,.1)', track: '#2a2538', faint: '#5d5468',
  vsoft: 'rgba(111,82,237,.22)', vtext: '#b4a4ff', gsoft: 'rgba(232,62,99,.16)', gink: '#ff8aa3', oksoft: 'rgba(18,112,75,.25)', ok: '#7fd8a4',
  tabBg: 'rgba(20,17,29,.92)', dark: true,
};
export type Theme = typeof light;
export const ctaShadow = { boxShadow: '0 10px 22px -10px rgba(91,63,214,.7)' } as const; // --cta, real blurred CSS shadow (RN 0.86 boxShadow)
export const cardShadow = { boxShadow: '0 1px 2px rgba(29,23,48,.04), 0 6px 20px -10px rgba(29,23,48,.14)' } as const; // --sh
export const photoShadow = { boxShadow: '0 16px 32px -18px rgba(29,23,48,.5)' } as const; // --sh-photo
export const circShadow = { boxShadow: '0 1px 2px rgba(29,23,48,.08), 0 6px 16px -6px rgba(29,23,48,.25)' } as const;
export const mesh = 'radial-gradient(60% 70% at 12% 10%, rgba(216,204,255,.9) 0%, rgba(216,204,255,0) 62%), radial-gradient(50% 60% at 92% 0%, rgba(255,194,207,.8) 0%, rgba(255,194,207,0) 60%), radial-gradient(55% 60% at 70% 100%, rgba(255,217,161,.45) 0%, rgba(255,217,161,0) 62%)';
export const aura = ['#e6deff', '#ffe0e7'] as const;
export const ringColors = ['#6f52ed', '#a98fff', '#ffa8bb', '#ffd2a1', '#6f52ed'] as const;
export const font = { r: 'PlusJakartaSans_400Regular', m: 'PlusJakartaSans_500Medium', s: 'PlusJakartaSans_600SemiBold', b: 'PlusJakartaSans_700Bold', x: 'PlusJakartaSans_800ExtraBold' };

// Brand constants used outside the light/dark theme objects (gradients, the dark action bar, text on violet).
export const gradCta = ['#6f52ed', '#a24cd8'] as const;
export const gradRing = ['#6f52ed', '#ff7aa2'] as const;
export const brandInk = '#1d1730';
export const onViolet = '#ffffff';
export const wordmarkOnDark = '#f5f2fa';
export const barBg = (dark: boolean) => (dark ? '#2a2538' : '#1d1730');

/** v2 type scale (artifact .ph): h1 26/700, top-bar title 22/700, h2 16/700, body 14-15, meta 12.5 / 11.5. */
export const type = {
  h1: { fontFamily: font.b, fontSize: 26, lineHeight: 30, letterSpacing: -0.65 },
  bar: { fontFamily: font.b, fontSize: 22, lineHeight: 28, letterSpacing: -0.44 },
  h2: { fontFamily: font.b, fontSize: 16, lineHeight: 21, letterSpacing: -0.16 },
  h3: { fontFamily: font.b, fontSize: 15, lineHeight: 20 },
  t1: { fontFamily: font.s, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.r, fontSize: 14, lineHeight: 20 },
  t2: { fontFamily: font.r, fontSize: 13, lineHeight: 18 },
  sm: { fontFamily: font.r, fontSize: 12.5, lineHeight: 17 },
  xs: { fontFamily: font.r, fontSize: 11.5, lineHeight: 15 },
} as const;
/** v2 spacing: 20 page gutter, 22 section gap. */
export const space = { gutter: 20, section: 22 } as const;
export const radius = { card: 22, hero: 26, tile: 20, chip: 18, field: 16, sheet: 30 } as const;
export const heroShadow = { boxShadow: '0 18px 36px -22px rgba(29,23,48,.6)' } as const;
export const dockShadow = '0 0 0 .5px rgba(29,23,48,.08), 0 2px 4px rgba(29,23,48,.06), 0 8px 16px -4px rgba(29,23,48,.12), 0 24px 44px -10px rgba(29,23,48,.28)';
/** Story ring stops (artifact --ring conic: violet, lilac, pink, peach). */
export const storyRing = ['#6f52ed', '#a98fff', '#ffa8bb', '#ffd2a1'] as const;
/** Calendar event tints c1..c5 (artifact .ev.cN). */
export const evTint = ['#f1edff', '#fdeef2', '#eaf5ef', '#fdf3e4', '#eef2f7'] as const;
/** Brand pill gradient (BİZNES ÜÇÜN): violet to guava. */
export const gradBiz = ['#6f52ed', '#e83e63'] as const;
