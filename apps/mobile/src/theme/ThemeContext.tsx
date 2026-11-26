import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light, Theme } from './tokens';

type Mode = 'system' | 'light' | 'dark';
const Ctx = createContext<{ t: Theme; mode: Mode; setMode: (m: Mode) => void }>({ t: light, mode: 'system', setMode: () => {} });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');
  useEffect(() => { AsyncStorage.getItem('booqi.theme').then((v) => v && setModeState(v as Mode)).catch(() => {}); }, []);
  const setMode = (m: Mode) => { setModeState(m); AsyncStorage.setItem('booqi.theme', m).catch(() => {}); };
  const isDark = mode === 'system' ? sys === 'dark' : mode === 'dark';
  return <Ctx.Provider value={{ t: isDark ? dark : light, mode, setMode }}>{children}</Ctx.Provider>;
}
