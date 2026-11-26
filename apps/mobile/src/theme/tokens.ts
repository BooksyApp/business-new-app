// Final v2 tokens, ported literally from artifacts/app-redesign-final-v2/index.html (:root + .dk)
export const light = {
  canvas: '#fbf7f2', ink: '#1d1730', violet: '#6f52ed', guava: '#e83e63', lilac: '#d8ccff', blush: '#ffc2cf',
  muted: '#6b6158', ink3: '#8c8177', line: '#e3dace', white: '#ffffff', surface: '#ffffff', fill: '#f6f1ea', fill2: '#efe8df',
  vsoft: '#f4f1ff', vtext: '#5b3fd6', vstrong: '#5b3fd6', gsoft: '#fff1f3', gink: '#c4294f', ok: '#12704b', oksoft: '#e9f7f0', star: '#ffb547',
  tabBg: 'rgba(251,247,242,.94)', tabText: '#6b6158', dark: false,
};
export const dark: typeof light = {
  ...light, canvas: '#14111d', ink: '#f5f2fa', muted: '#bdb4aa', ink3: '#8f857b', line: '#332d40', surface: '#1f1b2b', fill: '#2a2538', fill2: '#342e44',
  vsoft: 'rgba(111,82,237,.22)', vtext: '#b4a4ff', gsoft: 'rgba(232,62,99,.16)', gink: '#ff8aa3', oksoft: 'rgba(18,112,75,.25)', ok: '#7fd8a4',
  tabBg: 'rgba(20,17,29,.92)', dark: true,
};
export type Theme = typeof light;
export const ctaShadow = { boxShadow: '0 10px 24px -8px rgba(91,63,214,.6)' } as const; // --cta, real blurred CSS shadow (RN 0.86 boxShadow)
export const cardShadow = { boxShadow: '0 1px 2px rgba(29,23,48,.04), 0 8px 24px -8px rgba(29,23,48,.10)' } as const; // --sh
export const photoShadow = { boxShadow: '0 16px 32px -18px rgba(29,23,48,.5)' } as const; // --sh-photo
export const circShadow = { boxShadow: '0 1px 2px rgba(29,23,48,.08), 0 6px 16px -6px rgba(29,23,48,.25)' } as const;
export const mesh = 'radial-gradient(60% 70% at 12% 10%, rgba(216,204,255,.9) 0%, rgba(216,204,255,0) 62%), radial-gradient(50% 60% at 92% 0%, rgba(255,194,207,.8) 0%, rgba(255,194,207,0) 60%), radial-gradient(55% 60% at 70% 100%, rgba(255,217,161,.45) 0%, rgba(255,217,161,0) 62%)';
export const aura = ['#e6deff', '#ffe0e7'] as const;
export const ringColors = ['#6f52ed', '#a98fff', '#ffa8bb', '#ffd2a1', '#6f52ed'] as const;
export const font = { r: 'PlusJakartaSans_400Regular', m: 'PlusJakartaSans_500Medium', s: 'PlusJakartaSans_600SemiBold', b: 'PlusJakartaSans_700Bold', x: 'PlusJakartaSans_800ExtraBold' };
