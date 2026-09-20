import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { isLight, toggle } = useTheme();
  const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={label}
      title={label}
      onClick={toggle}
      className="relative h-11 w-[4.25rem] shrink-0 rounded-full border border-border bg-surface"
    >
      <span
        className={`absolute top-2 left-1 size-7 rounded-full border border-border bg-elevated shadow-sm transition-transform duration-200 ${isLight ? 'translate-x-8' : ''}`}
        aria-hidden
      />
      <Moon
        className={`pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 ${isLight ? 'text-fg-subtle' : 'text-fg'}`}
      />
      <Sun
        className={`pointer-events-none absolute top-1/2 right-2.5 z-10 size-3.5 -translate-y-1/2 ${isLight ? 'text-fg' : 'text-fg-subtle'}`}
      />
    </button>
  );
}
