import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as lightColors } from './colors';

const darkColors = {
  primary: '#6BD8CB',
  primaryLight: '#89F5E7',
  primaryContainer: '#005049',
  secondary: '#FC79BD',
  secondaryContainer: '#85145A',
  tertiary: '#3CDDC7',
  tertiaryContainer: '#005047',
  warning: '#F59E0B',
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
      if (saved === 'dark' || saved === 'light') setTheme(saved);
      else if (systemScheme === 'dark') setTheme('dark');
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    AsyncStorage.setItem('famicare_theme', next);
  };

  const colors = theme === 'dark' ? darkColors : lightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
