import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as lightColors } from './colors';
const originalLightColors = { ...lightColors };

const darkColors = {
  primary: '#6BD8CB',
  onPrimary: '#003731',
  primaryLight: '#89F5E7',
  primaryContainer: '#005049',
  secondary: '#FC79BD',
  onSecondary: '#4A0027',
  secondaryContainer: '#85145A',
  tertiary: '#3CDDC7',
  tertiaryContainer: '#005047',
  warning: '#F59E0B',
  onWarning: '#3B2300',
  danger: '#FFB4AB',
  dangerLight: '#93000A',
  gray: '#94A3B8',
  background: '#0B1C30',
  surface: '#1E293B',
  surfaceVariant: '#334155',
  text: '#EAF1FF',
  textSecondary: '#BCC9C6',
  textLight: '#94A3B8',
  border: '#334155',
  outline: '#6D7A77',
};

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  colors: typeof lightColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: lightColors,
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    AsyncStorage.getItem('famicare_theme').then(saved => {
      const selected = saved === 'dark' || saved === 'light' ? saved : systemScheme === 'dark' ? 'dark' : 'light';
      Object.assign(lightColors, selected === 'dark' ? darkColors : originalLightColors);
      setTheme(selected);
    });
  }, [systemScheme]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    Object.assign(lightColors, next === 'dark' ? darkColors : originalLightColors);
    setTheme(next);
    AsyncStorage.setItem('famicare_theme', next);
  };

  const colors = theme === 'dark' ? darkColors : originalLightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function useThemedStyles<T extends Record<string, any>>(baseStyles: T): T {
  const { colors, theme } = useTheme();
  return useMemo(() => {
    const colorMap = new Map(
      Object.keys(originalLightColors).map(key => [
        originalLightColors[key as keyof typeof originalLightColors],
        colors[key as keyof typeof colors],
      ])
    );
    const transform = (value: any): any => {
      if (Array.isArray(value)) return value.map(transform);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, transform(child)]));
      }
      if (typeof value === 'string') {
        for (const [light, themed] of colorMap) {
          if (value === light) return themed;
          if (value.startsWith(light) && value.length > light.length) return `${themed}${value.slice(light.length)}`;
        }
      }
      return value;
    };
    return transform(baseStyles);
  }, [baseStyles, colors, theme]);
}
