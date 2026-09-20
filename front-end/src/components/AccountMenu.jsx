import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';

const USER_KEY = 'transly-user-v1';

function readUser() {
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    setUser(readUser());
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const signIn = () => {
    const next = {
      name: 'Google account',
      email: 'signed-in@gmail.com',
    };
    window.localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
    setOpen(false);
  };

  const signOut = () => {
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
    setOpen(false);
  };

  if (user) {
    const initial = (user.name ?? user.email ?? 'A').charAt(0).toUpperCase();
    return (
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Account"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-11 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-sm text-fg hover:border-border-strong"
        >
          {initial}
        </button>
        {open ? (
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-elevated p-2 shadow-lg">
            <div className="px-2 py-2">
              <p className="truncate text-sm">{user.name}</p>
              <p className="truncate text-xs text-fg-subtle">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-surface"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Sign in"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface hover:text-fg"
      >
        <User className="size-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-elevated p-2 shadow-lg">
          <p className="px-2 py-1.5 text-xs tracking-wide text-fg-subtle uppercase">Account</p>
          <button
            type="button"
            onClick={signIn}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-sm px-2 text-sm hover:bg-surface"
          >
            <GoogleMark />
            Sign in with Google
          </button>
        </div>
      ) : null}
    </div>
  );
}
