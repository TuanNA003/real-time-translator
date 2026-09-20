import { useEffect, useSyncExternalStore } from 'react';
import { getTheme, hydrateTheme, subscribeTheme, toggleTheme } from '../lib/theme';

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'dark');

  useEffect(() => {
    hydrateTheme();
  }, []);

  return {
    theme,
    isLight: theme === 'light',
    toggle: toggleTheme,
  };
}
